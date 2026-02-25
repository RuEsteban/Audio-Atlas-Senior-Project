// server/src/services/chartAggregationService.js

import { fetchLastfmGeoTopTracks } from '../apiClient/lastfmClient.js';
import { buildChartKey, upsertMusicCharts } from '../database/chartsInsertRepo.js';

function isoDate(d = new Date()) {
    return d.toISOString().slice(0, 10)
}

/**
 * Create an initial set of countries needed to test
 * Will expand country/ISO list after functionality validate
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

export async function ingestLastfmCountryTopTracks({
    supabase,
    country,              // ISO2 stored in DB, e.g. "US"
    chartType = 'top_tracks',
    chartDate = isoDate(),
    limit = 10
} = {}) {
    if (!country) throw new Error('country (ISO2) is required')
    const source = 'lastfm'

    const countryName = toLastfmCountryName(country)
    if (!countryName) {
        throw new Error(`Unsupported country ISO2 for Last.fm mapping: ${country}. Add to ISO2_TO_LASTFM_COUNTRY.`)
    }

    const payload = await fetchLastfmGeoTopTracks({ countryName, limit })
    const tracks = payload?.toptracks?.track ?? payload?.tracks?.track ?? [] // defensive

    const rows = tracks.map((t, idx) => {
        const rank = idx + 1
        const trackName = t?.name ?? null
        const artistName = t?.artist?.name ?? t?.artist ?? null
        const lastfmMbid = t?.mbid || null

        const chart_key = buildChartKey({
            chartDate,
            country,
            chartType,
            source,
            rank,
            spotifyTrackId: null,
            lastfmMbid,
            trackName,
            artistName
        })

        // album/year are not reliably present in Last.fm geo top tracks
        return {
            chart_key,
            source,
            chart_date: chartDate,
            country,
            chart_type: chartType,
            rank,
            track_name: trackName,
            artist_name: artistName,
            album_name: null,
            release_year: null,

            spotify_track_id: null,
            spotify_popularity: null,
            preview_url: null,
            external_url: t?.url ?? null,

            playcount: t?.playcount ? Number(t.playcount) : null,
            lastfm_mbid: lastfmMbid,
            raw: t
        }
    })
    return await upsertMusicCharts({ supabase, rows })
}