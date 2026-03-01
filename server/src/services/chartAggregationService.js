// server/src/services/chartAggregationService.js

import { fetchLastfmGeoTopTracks, fetchLastfmTrackInfo } from '../apiClient/lastfmClient.js';
import { searchTrack } from '../apiClient/spotifyClient.js'
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
 * Helper function to parse Spotify release year
 */

function yearFromSpotifyReleaseDate(releaseDate) {
    // Spotify can return "YYYY", "YYYY-MM", or "YYYY-MM-DD"
    if (!releaseDate || typeof releaseDate !== 'string') return null
    const y = parseInt(releaseDate.slice(0, 4), 10)
    return Number.isFinite(y) ? y : null
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

    // limit attempts of concurrency using 4 workers total doing 2 API calls each (Last.fm->Spotify)

    const enriched = await mapLimit(tracks, 4, async (t) => {
        const trackName = t?.name ?? null
        const artistName = t?.artist?.name ?? t?.artist ?? null
        const lastfmMbid = t?.mbid || null

        // From Last.fm getInfo
        let albumNameLastfm = null
        let releaseYearLastfm = null

        // From Spotify
        let spotifyTrackId = null
        let spotifyPopularity = null
        let previewUrl = null
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
        } catch (e) {
            // swallow to avoid failing ingestion
        }

        // Spotify enrichment to provide greater song detail
        try {
            const s = await searchTrack(trackName, artistName)
            if (s) {
                spotifyTrackId = s.id ?? null
                spotifyPopularity = (s.popularity ?? null)
                previewUrl = s.preview_url ?? null
                externalUrl = s.external_urls?.spotify ?? null

                albumNameSpotify = s.album?.name ?? null
                releaseYearSpotify = yearFromSpotifyReleaseDate(s.album?.release_date)
            }
        } catch (e) {
            // swallow to avoid failing ingestion
        }

        // Prefer Spotify if present; fallback to Last.fm
        const albumName = albumNameSpotify ?? albumNameLastfm
        const releaseYear = releaseYearSpotify ?? releaseYearLastfm

        return {
            t,
            trackName,
            artistName,
            lastfmMbid,
            albumName,
            releaseYear,
            spotifyTrackId,
            spotifyPopularity,
            previewUrl,
            externalUrl
        }
    })

    const rows = enriched.map((e, idx) => {
        const rank = idx + 1

        const chart_key = buildChartKey({
            chartDate,
            country,
            chartType,
            source,
            rank,
            spotifyTrackId: e.spotifyTrackId,
            lastfmMbid: e.lastfmMbid,
            trackName: e.trackName,
            artistName: e.artistName
        })

        if (!chart_key) {
            throw new Error(
                `chart_key missing. chartDate=${chartDate} country=${country} chartType=${chartType} source=${source} rank=${rank} ` +
                `spotifyTrackId=${e.spotifyTrackId} lastfmMbid=${e.lastfmMbid} trackName=${e.trackName} artistName=${e.artistName}`
            )
        }

        return {
            chart_key,
            source,
            chart_date: chartDate,
            country,
            chart_type: chartType,
            rank,

            track_name: e.trackName,
            artist_name: e.artistName,
            album_name: e.albumName,
            release_year: e.releaseYear,

            spotify_track_id: e.spotifyTrackId,
            spotify_popularity: Number.isFinite(e.spotifyPopularity) ? e.spotifyPopularity : null,
            preview_url: e.previewUrl,
            external_url: e.externalUrl ?? e.t?.url ?? null, // prefer Spotify URL; fallback to Last.fm URL

            playcount: e.t?.playcount ? Number(e.t.playcount) : null,
            lastfm_mbid: e.lastfmMbid,
            raw: e.t
        }
    })

    // testing to find broken chart_key (delete later in project / Lance)
    console.log('First row sample:', rows[0]);
    console.log('chart_key sample:', rows[0]?.chart_key);

    return await upsertMusicCharts({ supabase, rows })
}
