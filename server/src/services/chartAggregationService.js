// server/src/services/chartAggregationService.js

import { fetchLastfmGeoTopTracks, fetchLastfmTrackInfo } from '../apiClient/lastfmClient.js';
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

/**
 * Minimize concurrency on the track.getInfo calls
 * Limit concurrency to ~3-5 to prevent getting rate-limited
 */

function parsePublishedYear(published) {
  // Example: "15 Jan 2007, 00:00"
  if (!published) return null
  const m = String(published).match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : null
}

/**
 * Additional fallback attempting to populate release date
 */

function parseYearFromString(s) {
  if (!s) return null
  const m = String(s).match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : null
}



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
    const tracks = payload?.toptracks?.track ?? payload?.tracks?.track ?? []

    // limit attempts of concurrency

    const enriched = await mapLimit(tracks, 4, async (t) => {
        const trackName = t?.name ?? null
        const artistName = t?.artist?.name ?? t?.artist ?? null
        const lastfmMbid = t?.mbid || null

        let albumName = null
        let releaseYear = null

        try {
            const info = await fetchLastfmTrackInfo({ mbid: lastfmMbid, artistName, trackName })
            const track = info?.track

            albumName = track?.album?.title ?? null
            // Year is often only available via wiki.published (not always present)
            releaseYear =
                parseYearFromString(track?.wiki?.published) ??
                parseYearFromString(track?.album?.releasedate) ??
                null
                
        } catch (e) {
            // Swallow enrichment failures to avoid failing ingestion
        }

        return { t, trackName, artistName, lastfmMbid, albumName, releaseYear }
    })

    const rows = enriched.map(({ t, trackName, artistName, lastfmMbid, albumName, releaseYear }, idx) => {
        const rank = idx + 1

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

        return {
            chart_key,
            source,
            chart_date: chartDate,
            country,
            chart_type: chartType,
            rank,

            track_name: trackName,
            artist_name: artistName,
            album_name: albumName,
            release_year: releaseYear,

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
