// server/src/apiClient/spotifyClient.js

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

let accessToken = null;
let tokenExpiresAt = null;

async function getAccessToken() {
    const now = Date.now();

    if (accessToken && tokenExpiresAt && now < tokenExpiresAt) {
        return accessToken;
    }

    const credentials = Buffer
        .from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`)
        .toString('base64');

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials'
        })
    });

    if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status} url=${url}`);
    }

    const data = await response.json();

    accessToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in * 1000) - 5000;

    return accessToken;
}

async function spotifyRequest(endpoint, params = {}, retries = 1) {
    const token = await getAccessToken();

    const queryString = new URLSearchParams(params).toString();
    const url = `${SPOTIFY_API_BASE}${endpoint}${queryString ? `?${queryString}` : ''}`;

    // Manually implement timeout protection to keep ingestion pipeline from indefinite hang

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.status === 404) {
            throw new Error('Spotify charts playlists are not accessible via this API access level (404).')
}

        // Implement Spotify 429 handling to prevent ingestion failures and pipeline instability
        // Retry once after 10 seconds and then fail cleanly to prevent hang ups

        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10);

            if (retries > 0) {
                console.warn(`Spotify rate limited. Retrying after ${retryAfter}s...`);
                await new Promise(res => setTimeout(res, retryAfter * 1000));
                return spotifyRequest(endpoint, params, retries - 1);
            } else {
                throw new Error('Spotify rate limit exceeded');
            }
        }

        if (!response.ok) {
            throw new Error(`Spotify API error: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        clearTimeout(timeout);

        if (error.name === 'AbortError') {
            throw new Error('Spotify request timed out');
        }

        throw error;
    }
}

export async function getTrackById(trackId, { market } = {}) {
    if (!trackId) return null;
    return await spotifyRequest(`/tracks/${encodeURIComponent(trackId)}`, market ? { market } : {});
}

export async function getPlaylistTopTracks(playlistId, { limit = 10, market } = {}) {
    if (!playlistId) throw new Error('playlistId is required');

    // Spotify playlist tracks endpoint:
    // GET /v1/playlists/{playlist_id}/tracks
    // We request only what we need to reduce payload size.
    const fields =
        'items(added_at,track(id,name,artists(name),album(name,release_date),popularity,external_urls)),' +
        'total';

    const data = await spotifyRequest(
        `/playlists/${encodeURIComponent(playlistId)}/tracks`,
        {
            limit,
            ...(market ? { market } : {}),
            fields
        }
    );

    return data?.items ?? [];
}

async function searchTrack(trackName, artistName) {
    const query = `track:${trackName} artist:${artistName}`;

    const data = await spotifyRequest('/search', {
        q: query,
        type: 'track',
        limit: 1
    });

    return data.tracks?.items?.[0] || null;
}

export { searchTrack };