// server/src/services/chartAggregationService.js

/**
 * Audio-Atlas chart aggregation service
 * ------------------------------------
 *
 * Responsibility:
 * - fetch chart rankings from the source provider
 * - enrich rows with metadata from other providers when appropriate
 * - normalize all rows into a single DB-ready structure
 * - validate the final rows before writing to Supabase
 *
 * Current provider strategy:
 * - Last.fm = authoritative chart source for Last.fm charts
 * - KWORB   = authoritative chart source for Spotify charts
 * - Spotify = metadata enrichment provider only
 *
 * Important design note:
 * We do NOT use Spotify as a direct chart source anymore because Spotify-owned
 * chart/editorial playlists are not reliably accessible via our current API access.
 * Instead, Spotify is used to enrich tracks with:
 *   - spotify_track_id
 *   - spotify_popularity
 *   - album metadata
 *   - release year
 *   - external Spotify URL
 *   - album art image_url
 */

import { fetchLastfmGeoTopTracks, fetchLastfmTrackInfo } from '../apiClient/lastfmClient.js'
import { searchTrack } from '../apiClient/spotifyClient.js'
import { buildChartKey, upsertMusicCharts } from '../database/chartsInsertRepo.js'
import { toLastfmCountryName, toKworbCountryCode} from '../config/countryMappings.js'

/**
 * Return YYYY-MM-DD from a JS Date.
 * Used as the default chart date if one is not supplied by the caller.
 */
function isoDate(d = new Date()) {
    return d.toISOString().slice(0, 10)
}

/**
 * Extract a 4-digit release year from Spotify's release_date field.
 *
 * Spotify album release_date can appear as:
 * - YYYY
 * - YYYY-MM
 * - YYYY-MM-DD
 *
 * We only need the year for this project, so we normalize to a single integer.
 */
function yearFromSpotifyReleaseDate(releaseDate) {
    if (!releaseDate) return null
    const m = String(releaseDate).match(/^(19|20)\d{2}/)
    return m ? Number(m[0]) : null
}

/**
 * Extract a 4-digit year from arbitrary strings.
 *
 * Used for Last.fm fallback sources like:
 * - wiki.published
 * - album.releasedate
 */
function parseYearFromString(s) {
    if (!s) return null
    const m = String(s).match(/\b(19|20)\d{2}\b/)
    return m ? Number(m[0]) : null
}

/**
 * Lightweight concurrency limiter used inside this service layer.
 *
 * We use this to avoid overly aggressive provider bursts during per-country ingestion.
 * This limiter is local to the service execution and independent of the global Spotify
 * client-side limiter already implemented in spotifyClient.js.
 */
async function mapLimit(items, limit, fn) {
    const results = new Array(items.length)
    let i = 0

    const workers = Array.from({ length: limit }, async () => {
        while (i < items.length) {
            const idx = i++
            results[idx] = await fn(items[idx], idx)
        }
    })

    await Promise.all(workers)
    return results
}

/**
 * Validate DB-bound chart rows before upsert.
 *
 * Exists to:
 * - Prevent malformed data from reaching Supabase
 * - Catch provider/parser bugs early
 * - Enforce deterministic chart semantics
 *
 * Validation strategy:
 * - Hard fail on required-field issues
 * - Hard fail on rank collisions / bad bounds
 * - Soft-normalize optional numeric fields
 */
export function validateChartRows(rows, { source, country, chartDate, chartType, limit }) {
    if (!Array.isArray(rows)) throw new Error('Rows must be an array')
    if (rows.length === 0) throw new Error('No rows generated from provider')

    // Trim defensively if something upstream returned too many rows.
    const trimmed = rows.length > limit ? rows.slice(0, limit) : rows

    const rankSet = new Set()

    for (const r of trimmed) {
        if (!r) throw new Error('Row is null/undefined')

        // Required structural fields
        if (!r.chart_key || typeof r.chart_key !== 'string') {
            throw new Error('chart_key missing/invalid')
        }

        if (!r.source || r.source !== source) {
            throw new Error(`source mismatch or missing (expected ${source})`)
        }

        if (!r.chart_date || r.chart_date !== chartDate) {
            throw new Error(`chart_date missing/mismatch (expected ${chartDate})`)
        }

        if (!r.chart_type || r.chart_type !== chartType) {
            throw new Error(`chart_type missing/mismatch (expected ${chartType})`)
        }

        if (!r.country || r.country !== country) {
            throw new Error(`country missing/mismatch (expected ${country})`)
        }

        // Rank semantics
        if (!Number.isInteger(r.rank)) {
            throw new Error(`rank must be integer (got ${r.rank})`)
        }

        if (r.rank < 1 || r.rank > limit) {
            throw new Error(`rank out of bounds: ${r.rank} (limit=${limit})`)
        }

        if (rankSet.has(r.rank)) {
            throw new Error(`duplicate rank detected: ${r.rank}`)
        }

        rankSet.add(r.rank)

        // Required chart content
        if (!r.track_name || typeof r.track_name !== 'string') {
            throw new Error(`track_name missing at rank ${r.rank}`)
        }

        if (!r.artist_name || typeof r.artist_name !== 'string') {
            throw new Error(`artist_name missing at rank ${r.rank}`)
        }

        // Optional numeric normalization
        if (r.spotify_popularity != null) {
            const n = Number(r.spotify_popularity)
            r.spotify_popularity = Number.isFinite(n) && n >= 0 && n <= 100 ? Math.trunc(n) : null
        }

        if (r.release_year != null) {
            const y = Number(r.release_year)
            r.release_year = Number.isFinite(y) && y >= 1900 && y <= 2100 ? Math.trunc(y) : null
        }

        if (r.playcount != null) {
            const pc = Number(r.playcount)
            r.playcount = Number.isFinite(pc) ? Math.trunc(pc) : null
        }

        // Optional JSONB field normalization
        if (r.raw != null && typeof r.raw !== 'object') {
            r.raw = null
        }

        // image_url is intentionally optional
        if (r.image_url != null && typeof r.image_url !== 'string') {
            r.image_url = null
        }
    }

    // Strict top-N ingestion rule
    if (trimmed.length !== limit) {
        throw new Error(`expected ${limit} rows, got ${trimmed.length}`)
    }

    return trimmed
}

/**
 * Parse KWORB tokenized lines into structured chart rows.
 *
 * Exists because:
 * - easy to unit test
 * - isolates HTML-token parsing from network fetching
 * - catches site-format regressions early
 *
 * Expected output:
 * {
 *   rows: [{ rank, trackName, artistName, streams }, ...],
 *   kworb_chart_date: 'YYYY-MM-DD' | null
 * }
 */
export function parseKworbTokenLines(lines, { limit = 10 } = {}) {
    if (!Array.isArray(lines)) throw new Error('lines must be an array')

    // Extract effective chart date from KWORB page text
    let kworb_chart_date = null
    for (const l of lines) {
        const m = String(l).match(/\b(20\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\b/)
        if (m) {
            kworb_chart_date = `${m[1]}-${m[2]}-${m[3]}`
            break
        }
    }

    // Token classification helpers
    const isRank = (s) => /^\d{1,3}$/.test(s)
    const isMove = (s) => /^(=|NEW|RE|[+-]\d+)$/.test(s)
    const isArtistTitle = (s) => /\s+-\s+/.test(s)
    const isStreams = (s) => /^\d{1,3}(?:,\d{3})+$/.test(s)

    // Find first actual chart row
    let start = 0
    for (let i = 0; i < lines.length - 3; i++) {
        if (isRank(lines[i]) && isMove(lines[i + 1]) && isArtistTitle(lines[i + 2])) {
            start = i
            break
        }
    }

    const out = []

    for (let i = start; i < lines.length && out.length < limit; i++) {
        if (!isRank(lines[i])) continue

        const rank = Number(lines[i])
        const move = lines[i + 1] ?? ''
        const artistTitle = lines[i + 2] ?? ''

        if (!Number.isFinite(rank) || rank < 1) continue
        if (!isMove(move)) continue
        if (!isArtistTitle(artistTitle)) continue

        const parts = String(artistTitle).split(/\s+-\s+/)
        const artistName = (parts[0] ?? '').trim()
        const trackName = (parts.slice(1).join(' - ') ?? '').trim()

        let streams = null
        for (let j = i + 3; j < Math.min(i + 30, lines.length); j++) {
            if (isStreams(lines[j])) {
                streams = Number(lines[j].replace(/,/g, ''))
                break
            }
        }

        out.push({ rank, trackName, artistName, streams })

        // Advance a little so we do not re-interpret tokens inside the same row
        i = i + 3
    }

    return { rows: out, kworb_chart_date }
}

/**
 * Strip HTML into a plain-text token stream suitable for KWORB parsing.
 *
 * This is intentionally simple:
 * - remove script/style content
 * - convert block-ish tags into line boundaries
 * - drop remaining tags
 * - decode basic entities
 */
function stripHtml(html) {
    let s = String(html ?? '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[\s\S]*?<\/style>/gi, '')

    s = s
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|tr|li|h\d|table|thead|tbody|tfoot)>/gi, '\n')

    s = s.replace(/<[^>]+>/g, '')

    s = s
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')

    return s
}

/**
 * Fetch and parse a KWORB Spotify country chart page.
 *
 * This function is intentionally narrow in responsibility:
 * - build URL
 * - fetch page
 * - tokenize page
 * - delegate parsing to parseKworbTokenLines()
 */
async function fetchKworbSpotifyCountryChart({ countryIso2, timespan = 'daily', limit = 10 } = {}) {
    const kw = toKworbCountryCode(countryIso2)
    if (!kw) {
        throw new Error(`Unsupported country ISO2 for KWORB mapping: ${countryIso2}. Add to config/countryMappings.js.`)
    }

    const span = timespan === 'weekly' ? 'weekly' : 'daily'
    const url = `https://kworb.net/spotify/country/${kw}_${span}.html`

    const res = await fetch(url, {
        headers: { 'User-Agent': 'Audio-Atlas/1.0 (charts ingestion)' }
    })

    if (!res.ok) {
        throw new Error(`KWORB fetch failed: ${res.status} url=${url}`)
    }

    const html = await res.text()
    const text = stripHtml(html)

    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)

    const { rows, kworb_chart_date } = parseKworbTokenLines(lines, { limit })

    if (rows.length === 0) {
        throw new Error(`KWORB returned 0 parsed rows. url=${url} (site format may have changed).`)
    }

    return { rows, kworb_chart_date, kworb_url: url }
}

/**
 * Ingest Last.fm country top tracks.
 *
 * Flow:
 * 1. Fetch chart rows from Last.fm
 * 2. Enrich each row with:
 *    - Last.fm track.getInfo fallback metadata
 *    - Spotify metadata (ID, popularity, album, year, URL, image_url)
 * 3. Normalize into DB rows
 * 4. Validate rows
 * 5. Upsert into Supabase
 */
export async function ingestLastfmCountryTopTracks({
    supabase,
    country,
    chartType = 'top_tracks',
    chartDate = isoDate(),
    limit = 10
} = {}) {
    if (!supabase) throw new Error('Supabase client is required')
    if (!country) throw new Error('country (ISO2) is required')

    const source = 'lastfm'
    const countryISO2 = String(country).toUpperCase()

    const countryName = toLastfmCountryName(countryISO2)
    if (!countryName) {
        throw new Error(`Unsupported country ISO2 for Last.fm mapping: ${countryISO2}. Add to config/countryMappings.js.`)
    }

    const payload = await fetchLastfmGeoTopTracks({ countryName, limit })
    const tracks = payload?.toptracks?.track ?? payload?.tracks?.track ?? []

    const enriched = await mapLimit(tracks.slice(0, limit), 4, async (t) => {
        const trackName = t?.name ?? null
        const artistName = t?.artist?.name ?? t?.artist ?? null
        const lastfmMbid = t?.mbid || null

        // Metadata from Last.fm track.getInfo
        let albumNameLastfm = null
        let releaseYearLastfm = null

        // Metadata from Spotify enrichment
        let spotifyTrackId = null
        let spotifyPopularity = null
        let externalUrl = null
        let albumNameSpotify = null
        let releaseYearSpotify = null
        let imageUrl = null

        // Last.fm secondary metadata lookup
        try {
            const info = await fetchLastfmTrackInfo({ mbid: lastfmMbid, artistName, trackName })
            const track = info?.track

            albumNameLastfm = track?.album?.title ?? null
            releaseYearLastfm =
                parseYearFromString(track?.wiki?.published) ??
                parseYearFromString(track?.album?.releasedate) ??
                null
        } catch {
            // Swallow provider-specific enrichment failures so one bad row does not kill the country ingest
        }

        // Spotify metadata enrichment
        try {
            const s = await searchTrack(trackName, artistName)
            if (s) {
                spotifyTrackId = s.id ?? null
                spotifyPopularity = Number.isFinite(s.popularity) ? s.popularity : null
                externalUrl = s.external_urls?.spotify ?? null
                albumNameSpotify = s.album?.name ?? null
                releaseYearSpotify = yearFromSpotifyReleaseDate(s.album?.release_date)
                imageUrl = s.album?.images?.[0]?.url ?? null
            }
        } catch {
            // Swallow Spotify enrichment failures for resilience
        }

        return {
            t,
            trackName,
            artistName,
            lastfmMbid,
            albumName: albumNameSpotify ?? albumNameLastfm,
            releaseYear: releaseYearSpotify ?? releaseYearLastfm,
            spotifyTrackId,
            spotifyPopularity,
            externalUrl,
            imageUrl
        }
    })

    const rows = enriched.map((e, idx) => {
        const rank = idx + 1

        const chart_key = buildChartKey({
            chartDate,
            country: countryISO2,
            chartType,
            source,
            rank,
            spotifyTrackId: e.spotifyTrackId,
            lastfmMbid: e.lastfmMbid,
            trackName: e.trackName,
            artistName: e.artistName
        })

        return {
            chart_key,
            source,
            chart_date: chartDate,
            country: countryISO2,
            chart_type: chartType,
            rank,

            track_name: e.trackName,
            artist_name: e.artistName,
            album_name: e.albumName,
            release_year: e.releaseYear,
            image_url: e.imageUrl,

            spotify_track_id: e.spotifyTrackId,
            spotify_popularity: e.spotifyPopularity,
            preview_url: null,
            external_url: e.externalUrl ?? e.t?.url ?? null,

            playcount: e.t?.playcount ? Number(e.t.playcount) : null,
            lastfm_mbid: e.lastfmMbid,
            raw: e.t ?? null
        }
    })

    const validated = validateChartRows(rows, {
        source,
        country: countryISO2,
        chartDate,
        chartType,
        limit
    })

    return await upsertMusicCharts({ supabase, rows: validated })
}

/**
 * Ingest Spotify charts by country using KWORB rankings + Spotify enrichment.
 *
 * Flow:
 * 1. Fetch ranked chart rows from KWORB
 * 2. Use Spotify search to enrich each track
 * 3. Normalize rows into the shared DB structure
 * 4. Validate rows
 * 5. Upsert into Supabase
 *
 * This approach rationale:
 * - KWORB provides stable chart ranking pages
 * - Spotify Web API provides canonical metadata enrichment
 */
export async function ingestSpotifyCountryTopTracks({
    supabase,
    country,
    chartType = 'top_tracks',
    chartDate = isoDate(),
    limit = 10,
    timespan = 'daily'
} = {}) {
    if (!supabase) throw new Error('Supabase client is required')
    if (!country) throw new Error('country (ISO2) is required')

    const source = 'spotify'
    const countryISO2 = String(country).toUpperCase()

    const {
        rows: chart,
        kworb_chart_date,
        kworb_url
    } = await fetchKworbSpotifyCountryChart({
        countryIso2: countryISO2,
        timespan,
        limit
    })

    // Use the actual provider date when KWORB shows one to keep DB truthful
    const effectiveChartDate = kworb_chart_date ?? chartDate

    const enriched = await mapLimit(chart.slice(0, limit), 4, async (row) => {
        const trackName = row.trackName ?? null
        const artistName = row.artistName ?? null

        let spotifyTrackId = null
        let spotifyPopularity = null
        let externalUrl = null
        let albumName = null
        let releaseYear = null
        let imageUrl = null

        try {
            const s = await searchTrack(trackName, artistName)
            if (s) {
                spotifyTrackId = s.id ?? null
                spotifyPopularity = Number.isFinite(s.popularity) ? s.popularity : null
                externalUrl = s.external_urls?.spotify ?? null
                albumName = s.album?.name ?? null
                releaseYear = yearFromSpotifyReleaseDate(s.album?.release_date)
                imageUrl = s.album?.images?.[0]?.url ?? null
            }
        } catch {
            // Swallow Spotify enrichment failures so chart ranking itself can still be stored
        }

        return {
            ...row,
            spotifyTrackId,
            spotifyPopularity,
            externalUrl,
            albumName,
            releaseYear,
            imageUrl
        }
    })

    const rows = enriched.map((e) => {
        const rank = e.rank

        const chart_key = buildChartKey({
            chartDate: effectiveChartDate,
            country: countryISO2,
            chartType,
            source,
            rank,
            spotifyTrackId: e.spotifyTrackId,
            lastfmMbid: null,
            trackName: e.trackName,
            artistName: e.artistName
        })

        return {
            chart_key,
            source,
            chart_date: effectiveChartDate,
            country: countryISO2,
            chart_type: chartType,
            rank,

            track_name: e.trackName,
            artist_name: e.artistName,
            album_name: e.albumName,
            release_year: e.releaseYear,
            image_url: e.imageUrl,

            spotify_track_id: e.spotifyTrackId,
            spotify_popularity: e.spotifyPopularity,
            preview_url: null,
            external_url: e.externalUrl,

            playcount: null,
            lastfm_mbid: null,

            raw: {
                provider: 'kworb',
                timespan,
                streams: e.streams ?? null,
                kworb_url,
                kworb_chart_date
            }
        }
    })

    const validated = validateChartRows(rows, {
        source,
        country: countryISO2,
        chartDate: effectiveChartDate,
        chartType,
        limit
    })

    return await upsertMusicCharts({ supabase, rows: validated })
}