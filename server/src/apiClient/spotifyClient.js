// server/src/apiClient/spotifyClient.js

/**
 * Spotify client for metadata enrichment only.
 *
 * Audio-Atlas does NOT use Spotify as the authoritative chart-ranking source.
 * Rankings come from:
 *   - Last.fm (geo.getTopTracks)
 *   - KWORB Spotify charts pages
 *
 * This client is used only to enrich tracks with Spotify catalog metadata such as:
 *   - spotify_track_id
 *   - popularity
 *   - album metadata
 *   - Spotify external URL
 *   - Spotify image URL (album art), if available
 *
 * A shared limiter is needed because:
 * Both Last.fm ingestion and KWORB/Spotify ingestion call Spotify for enrichment.
 * Without a single shared limiter at the client boundary, concurrent bulk jobs can
 * overwhelm Spotify's API and trigger frequent 429 rate-limit responses.
 */

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

/**
 * Cached client-credentials access token.
 * Spotify tokens are short-lived, so we cache until just before expiry.
 */
let accessToken = null
let tokenExpiresAt = null

/**
 * Shared Spotify request limiter.
 *
 * These defaults are intentionally conservative for bulk-ingestion stability.
 * They can be overridden via environment variables if needed.
 *
 * Example:
 *   SPOTIFY_MAX_CONCURRENT=1
 *   SPOTIFY_MIN_INTERVAL_MS=400
 */
const SPOTIFY_MAX_CONCURRENT = Number(process.env.SPOTIFY_MAX_CONCURRENT || 1)
const SPOTIFY_MIN_INTERVAL_MS = Number(process.env.SPOTIFY_MIN_INTERVAL_MS || 250)

let spotifyActiveRequests = 0
let spotifyLastStartedAt = 0
const spotifyWaitQueue = []

/**
 * Simple sleep helper used for:
 *   - limiter pacing
 *   - 429 retry backoff
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Acquire a single shared Spotify request slot.
 *
 * This enforces:
 *   1. maximum concurrent Spotify requests
 *   2. minimum spacing between request start times
 *
 * The limiter is intentionally implemented at the client layer so that ALL Spotify
 * requests share the same gate, regardless of which ingestion service triggered them.
 * Depending upon potential delays, we can modify concurrency and spacing to improve
 * response time
 */
async function acquireSpotifySlot() {
    if (spotifyActiveRequests < SPOTIFY_MAX_CONCURRENT) {
        spotifyActiveRequests += 1

        const now = Date.now()
        const waitMs = Math.max(0, SPOTIFY_MIN_INTERVAL_MS - (now - spotifyLastStartedAt))
        if (waitMs > 0) {
            await sleep(waitMs)
        }

        spotifyLastStartedAt = Date.now()
        return
    }

    await new Promise((resolve) => {
        spotifyWaitQueue.push(resolve)
    })

    spotifyActiveRequests += 1

    const now = Date.now()
    const waitMs = Math.max(0, SPOTIFY_MIN_INTERVAL_MS - (now - spotifyLastStartedAt))
    if (waitMs > 0) {
        await sleep(waitMs)
    }

    spotifyLastStartedAt = Date.now()
}

/**
 * Release a Spotify slot and wake the next waiting request, if any.
 */
function releaseSpotifySlot() {
    spotifyActiveRequests = Math.max(0, spotifyActiveRequests - 1)

    if (spotifyWaitQueue.length > 0) {
        const next = spotifyWaitQueue.shift()
        next()
    }
}

/**
 * Retrieve or refresh the Spotify client-credentials access token.
 *
 * Notes:
 * - This does NOT go through spotifyRequest() because the token endpoint is different
 *   from the catalog API and has a different auth pattern.
 * - We cache the token until shortly before expiration to reduce unnecessary token calls.
 */
async function getAccessToken() {
    const now = Date.now()

    if (accessToken && tokenExpiresAt && now < tokenExpiresAt) {
        return accessToken
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
        throw new Error('Spotify credentials missing: SPOTIFY_CLIENT_ID and/or SPOTIFY_CLIENT_SECRET not set')
    }

    const credentials = Buffer
        .from(`${clientId}:${clientSecret}`)
        .toString('base64')

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials'
        })
    })

    if (!response.ok) {
        throw new Error(`Spotify token error: ${response.status}`)
    }

    const data = await response.json()

    accessToken = data.access_token
    tokenExpiresAt = now + (data.expires_in * 1000) - 5000

    return accessToken
}

/**
 * Shared Spotify Web API request wrapper.
 *
 * Responsibilities:
 * - acquires the shared client limiter
 * - attaches bearer token
 * - applies timeout protection
 * - retries once on 429 using Retry-After
 * - throws clean errors for non-OK responses
 *
 * All Spotify catalog/search lookups should flow through this function.
 */
async function spotifyRequest(endpoint, params = {}, retries = 1) {
    await acquireSpotifySlot()

    try {
        const token = await getAccessToken()

        const queryString = new URLSearchParams(params).toString()
        const url = `${SPOTIFY_API_BASE}${endpoint}${queryString ? `?${queryString}` : ''}`

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        try {
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                signal: controller.signal
            })

            clearTimeout(timeout)

            /**
            * If Spotify rate-limits us, respect Retry-After and retry once.
            * This helps bulk ingestion complete gracefully instead of failing hard
            * on transient provider throttling.
            */
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10)

                if (retries > 0) {
                    console.warn(`Spotify rate limited. Retrying after ${retryAfter}s...`)
                    await sleep(retryAfter * 1000)
                    return spotifyRequest(endpoint, params, retries - 1)
                }

                throw new Error('Spotify rate limit exceeded')
            }

            if (!response.ok) {
                throw new Error(`Spotify API error: ${response.status}`)
            }

            return await response.json()
        } catch (error) {
            clearTimeout(timeout)

            if (error.name === 'AbortError') {
                throw new Error('Spotify request timed out')
            }

            throw error
        }
    } finally {
        releaseSpotifySlot()
    }
}

/**
 * Fetch a Spotify track by Spotify track ID.
 *
 * Useful for:
 * - future metadata refresh jobs
 * - targeted backfills
 * - any use case where the canonical Spotify ID is known
 */
export async function getTrackById(trackId, { market } = {}) {
    if (!trackId) return null

    return await spotifyRequest(
        `/tracks/${encodeURIComponent(trackId)}`,
        market ? { market } : {}
    )
}

/**
 * Search Spotify for a track by track name + artist name.
 *
 * This is the primary enrichment path used by both:
 * - Last.fm ingestion
 * - KWORB/Spotify ingestion
 *
 * We intentionally return only the first match because the ingestion services
 * need a deterministic, single-record enrichment result.
 */
export async function searchTrack(trackName, artistName) {
    const query = `track:${trackName} artist:${artistName}`

    const data = await spotifyRequest('/search', {
        q: query,
        type: 'track',
        limit: 1
    })

    return data.tracks?.items?.[0] || null
}