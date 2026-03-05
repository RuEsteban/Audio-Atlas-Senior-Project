// server/src/services/chartAggregationService.js

// server/src/services/chartAggregationService.js

import { fetchLastfmGeoTopTracks, fetchLastfmTrackInfo } from '../apiClient/lastfmClient.js'
import { searchTrack } from '../apiClient/spotifyClient.js'
import { buildChartKey, upsertMusicCharts } from '../database/chartsInsertRepo.js'

function isoDate(d = new Date()) {
    return d.toISOString().slice(0, 10)
}

/**
 * Country mapping for Last.fm geo endpoint
 */
const ISO2_TO_LASTFM_COUNTRY = {
    US: 'United States',
    GB: 'United Kingdom',
    BR: 'Brazil',
    CA: 'Canada',
    DE: 'Germany',
    FR: 'France',
    JP: 'Japan',
    AU: 'Australia',
    MX: 'Mexico',
    IN: 'India'
}

function toLastfmCountryName(iso2) {
    const key = (iso2 ?? '').toUpperCase()
    return ISO2_TO_LASTFM_COUNTRY[key] ?? null
}

/**
 * Helpers
 */
function yearFromSpotifyReleaseDate(releaseDate) {
    // Spotify release_date can be "YYYY", "YYYY-MM", or "YYYY-MM-DD"
    if (!releaseDate) return null
    const m = String(releaseDate).match(/^(19|20)\d{2}/)
    return m ? Number(m[0]) : null
}

function parseYearFromString(s) {
    if (!s) return null
    const m = String(s).match(/\b(19|20)\d{2}\b/)
    return m ? Number(m[0]) : null
}

/**
 * Simple concurrency limiter
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
 * Service-layer data validation (Epic 2.5)
 * Hard-fails before DB if shape/ranks are invalid.
 */
export function validateChartRows(rows, { source, country, chartDate, chartType, limit }) {
    if (!Array.isArray(rows)) throw new Error('Rows must be an array')
    if (rows.length === 0) throw new Error('No rows generated from provider')

    // If provider returns too many, trim to limit deterministically.
    const trimmed = rows.length > limit ? rows.slice(0, limit) : rows

    const rankSet = new Set()

    for (const r of trimmed) {
        if (!r) throw new Error('Row is null/undefined')

        // Required fields aligned with DB NOT NULL constraints and product semantics
        if (!r.chart_key || typeof r.chart_key !== 'string') throw new Error('chart_key missing/invalid')
        if (!r.source || r.source !== source) throw new Error(`source mismatch or missing (expected ${source})`)
        if (!r.chart_date || r.chart_date !== chartDate) throw new Error(`chart_date missing/mismatch (expected ${chartDate})`)
        if (!r.chart_type || r.chart_type !== chartType) throw new Error(`chart_type missing/mismatch (expected ${chartType})`)
        if (!r.country || r.country !== country) throw new Error(`country missing/mismatch (expected ${country})`)

        if (!Number.isInteger(r.rank)) throw new Error(`rank must be integer (got ${r.rank})`)
        if (r.rank < 1 || r.rank > limit) throw new Error(`rank out of bounds: ${r.rank} (limit=${limit})`)
        if (rankSet.has(r.rank)) throw new Error(`duplicate rank detected: ${r.rank}`)
        rankSet.add(r.rank)

        if (!r.track_name || typeof r.track_name !== 'string') throw new Error(`track_name missing at rank ${r.rank}`)
        if (!r.artist_name || typeof r.artist_name !== 'string') throw new Error(`artist_name missing at rank ${r.rank}`)

        // Normalize / bound-check optional numeric fields (do not fail ingestion)
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

        // Ensure JSONB field is an object or null
        if (r.raw != null && typeof r.raw !== 'object') r.raw = null
    }

    // Optional: enforce exact row count for strict top-N ingestion.
    // Need to discuss if we prefer allowing "short charts" >> remove this check.
    if (trimmed.length !== limit) {
        throw new Error(`expected ${limit} rows, got ${trimmed.length}`)
    }

    return trimmed
}

/**
 * LAST.FM ingestion (with Spotify enrichment)
 */
export async function ingestLastfmCountryTopTracks({
    supabase,
    country, // ISO2 stored in DB, e.g. "US"
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
        throw new Error(`Unsupported country ISO2 for Last.fm mapping: ${countryISO2}. Add to ISO2_TO_LASTFM_COUNTRY.`)
    }

    const payload = await fetchLastfmGeoTopTracks({ countryName, limit })
    const tracks = payload?.toptracks?.track ?? payload?.tracks?.track ?? []

    // Limit concurrency; each worker does up to 2 external calls (Last.fm getInfo + Spotify search)
    const enriched = await mapLimit(tracks.slice(0, limit), 4, async (t) => {
        const trackName = t?.name ?? null
        const artistName = t?.artist?.name ?? t?.artist ?? null
        const lastfmMbid = t?.mbid || null

        // From Last.fm getInfo
        let albumNameLastfm = null
        let releaseYearLastfm = null

        // From Spotify
        let spotifyTrackId = null
        let spotifyPopularity = null
        let externalUrl = null
        let albumNameSpotify = null
        let releaseYearSpotify = null

        // Last.fm enrichment
        try {
            const info = await fetchLastfmTrackInfo({ mbid: lastfmMbid, artistName, trackName })
            const track = info?.track
            albumNameLastfm = track?.album?.title ?? null
            releaseYearLastfm =
                parseYearFromString(track?.wiki?.published) ??
                parseYearFromString(track?.album?.releasedate) ??
                null
        } catch {
            // swallow
        }

        // Spotify enrichment
        try {
            const s = await searchTrack(trackName, artistName)
            if (s) {
                spotifyTrackId = s.id ?? null
                spotifyPopularity = Number.isFinite(s.popularity) ? s.popularity : null
                externalUrl = s.external_urls?.spotify ?? null
                albumNameSpotify = s.album?.name ?? null
                releaseYearSpotify = yearFromSpotifyReleaseDate(s.album?.release_date)
            }
        } catch {
            // swallow
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
            externalUrl
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

            spotify_track_id: e.spotifyTrackId,
            spotify_popularity: e.spotifyPopularity,
            preview_url: null, // Spotify preview_url effectively deprecated/unavailable for most tracks
            external_url: e.externalUrl ?? e.t?.url ?? null, // prefer Spotify URL; fallback to Last.fm URL

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
 * Spotify “Top 10 by country” via KWORB + Spotify enrichment
 */

/** KWORB mapping (verified pages exist for these codes) */
const ISO2_TO_KWORB_COUNTRY = {
    US: 'us',
    GB: 'gb',
    BR: 'br',
    CA: 'ca',
    DE: 'de',
    FR: 'fr',
    JP: 'jp',
    AU: 'au',
    MX: 'mx',
    IN: 'in'
}

function toKworbCountryCode(iso2) {
    const key = (iso2 ?? '').toUpperCase()
    return ISO2_TO_KWORB_COUNTRY[key] ?? null
}

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

export function parseKworbTokenLines(lines, { limit = 10 } = {}) {
    if (!Array.isArray(lines)) throw new Error('lines must be an array')

    // Extract page “effective date” (traceability)
    let kworb_chart_date = null
    for (const l of lines) {
        const m = String(l).match(/\b(20\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\b/)
        if (m) {
            kworb_chart_date = `${m[1]}-${m[2]}-${m[3]}`
            break
        }
    }

    // Token-stream parser helpers
    const isRank = (s) => /^\d{1,3}$/.test(s)
    const isMove = (s) => /^(=|NEW|RE|[+-]\d+)$/.test(s)
    const isArtistTitle = (s) => /\s+-\s+/.test(s)
    const isStreams = (s) => /^\d{1,3}(?:,\d{3})+$/.test(s)

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
        i = i + 3
    }

    return { rows: out, kworb_chart_date }
}

async function fetchKworbSpotifyCountryChart({ countryIso2, timespan = 'daily', limit = 10 } = {}) {
    const kw = toKworbCountryCode(countryIso2)
    if (!kw) throw new Error(`Unsupported country ISO2 for KWORB mapping: ${countryIso2}. Add to ISO2_TO_KWORB_COUNTRY.`)

    const span = timespan === 'weekly' ? 'weekly' : 'daily'
    const url = `https://kworb.net/spotify/country/${kw}_${span}.html`

    const res = await fetch(url, { headers: { 'User-Agent': 'Audio-Atlas/1.0 (charts ingestion)' } })
    if (!res.ok) throw new Error(`KWORB fetch failed: ${res.status} url=${url}`)

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

export async function ingestSpotifyCountryTopTracks({
    supabase,
    country, // ISO2, e.g. "US"
    chartType = 'top_tracks',
    chartDate = isoDate(),
    limit = 10,
    timespan = 'daily' // 'daily' | 'weekly'
} = {}) {
    if (!supabase) throw new Error('Supabase client is required')
    if (!country) throw new Error('country (ISO2) is required')

    const source = 'spotify'
    const countryISO2 = String(country).toUpperCase()

    const { rows: chart, kworb_chart_date, kworb_url } = await fetchKworbSpotifyCountryChart({
        countryIso2: countryISO2,
        timespan,
        limit
    })

    // Enrich with Spotify Web API search
    const enriched = await mapLimit(chart.slice(0, limit), 4, async (row) => {
        const trackName = row.trackName ?? null
        const artistName = row.artistName ?? null

        let spotifyTrackId = null
        let spotifyPopularity = null
        let externalUrl = null
        let albumName = null
        let releaseYear = null

        try {
            const s = await searchTrack(trackName, artistName)
            if (s) {
                spotifyTrackId = s.id ?? null
                spotifyPopularity = Number.isFinite(s.popularity) ? s.popularity : null
                externalUrl = s.external_urls?.spotify ?? null
                albumName = s.album?.name ?? null
                releaseYear = yearFromSpotifyReleaseDate(s.album?.release_date)
            }
        } catch {
            // swallow
        }

        return {
            ...row,
            spotifyTrackId,
            spotifyPopularity,
            externalUrl,
            albumName,
            releaseYear
        }
    })

    const rows = enriched.map((e) => {
        const rank = e.rank

        const chart_key = buildChartKey({
            chartDate,
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
            chart_date: chartDate,
            country: countryISO2,
            chart_type: chartType,
            rank,

            track_name: e.trackName,
            artist_name: e.artistName,
            album_name: e.albumName,
            release_year: e.releaseYear,

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
        chartDate,
        chartType,
        limit
    })

    return await upsertMusicCharts({ supabase, rows: validated })
}