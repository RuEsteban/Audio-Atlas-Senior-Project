// server/src/services/chartAggregationService.js

import { fetchLastfmGeoTopTracks, fetchLastfmTrackInfo } from '../apiClient/lastfmClient.js';
import { searchTrack } from '../apiClient/spotifyClient.js'
import { getPlaylistTopTracks, getTrackById } from '../apiClient/spotifyClient.js';
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
 * Specific ISO2 conversions for Spotify
 * Legacy CSV downloads...may not be applicable any longer
 */

const ISO2_TO_SPOTIFYCHARTS_REGION = {
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
};

function toSpotifyChartsRegion(iso2) {
    const key = (iso2 ?? '').toUpperCase();
    return ISO2_TO_SPOTIFYCHARTS_REGION[key] ?? null;
}



/**
 * Spotify Top 50 playlist ID mapping
 */

const ISO2_TO_SPOTIFY_TOP50_PLAYLIST = {
    US: '37i9dQZEVXbLRQDuF5jeBp', // Top 50 - USA :contentReference[oaicite:1]{index=1}
    GB: '37i9dQZEVXbLnolsZ8PSNw', // Top 50 - United Kingdom :contentReference[oaicite:2]{index=2}
    BR: '37i9dQZEVXbMXbN3EUUhlg', // Top 50 - Brazil :contentReference[oaicite:3]{index=3}
    CA: '37i9dQZEVXbKj23U1GF4IR', // Top 50 - Canada :contentReference[oaicite:4]{index=4}
    DE: '37i9dQZEVXbJiZcmkrIHGU', // Top 50 - Germany :contentReference[oaicite:5]{index=5}
    FR: '37i9dQZEVXbIPWwFssbupI', // Top 50 - France :contentReference[oaicite:6]{index=6}
    JP: '37i9dQZEVXbKXQ4mDTEBXq', // Top 50 - Japan :contentReference[oaicite:7]{index=7}
    AU: '37i9dQZEVXbJPcfkRz0wJ0', // Top 50 - Australia :contentReference[oaicite:8]{index=8}
    MX: '37i9dQZEVXbO3qyFxbkOE1', // Top 50 - Mexico :contentReference[oaicite:9]{index=9}
    IN: '37i9dQZEVXbLZ52XmnySJg'  // Top 50 - India :contentReference[oaicite:10]{index=10}
};

function spotifyTop50PlaylistId(iso2) {
    const key = (iso2 ?? '').toUpperCase();
    return ISO2_TO_SPOTIFY_TOP50_PLAYLIST[key] ?? null;
}

// Helper function to parse release year from Top 50 PL
function yearFromSpotifyReleaseDate(releaseDate) {
  // Spotify release_date can be "YYYY", "YYYY-MM", or "YYYY-MM-DD"
  if (!releaseDate) return null;
  const m = String(releaseDate).match(/^(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

function parseSpotifyTrackIdFromUrl(url) {
    // e.g. https://open.spotify.com/track/<id>?...
    if (!url) return null;
    const m = String(url).match(/open\.spotify\.com\/track\/([A-Za-z0-9]{10,})/);
    return m ? m[1] : null;
}

// Minimal CSV parser that handles quoted commas
function parseCsv(text) {
    const lines = String(text ?? '').split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];
    const rows = [];
    for (let i = 1; i < lines.length; i++) { // skip header
        const line = lines[i];
        const cols = [];
        let cur = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
            const ch = line[j];
            if (ch === '"' ) {
                if (inQuotes && line[j + 1] === '"') { cur += '"'; j++; }
                else inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                cols.push(cur); cur = '';
            } else {
                cur += ch;
            }
        }
        cols.push(cur);
        rows.push(cols.map(c => c.trim()));
    }
    return rows;
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

// KWORB (Spotify charts mirror) helpers
// KWORB country codes are usually ISO2 lowercase, except GB uses "uk".
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
};

function toKworbCountryCode(iso2) {
    const key = (iso2 ?? '').toUpperCase();
    return ISO2_TO_KWORB_COUNTRY[key] ?? null;
}

function stripHtml(html) {
    // Remove scripts/styles first
    let s = String(html ?? '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[\s\S]*?<\/style>/gi, '');

    // Convert <br> / block tags to newlines to preserve structure
    s = s
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|tr|li|h\d|table|thead|tbody|tfoot)>/gi, '\n');

    // Remove remaining tags
    s = s.replace(/<[^>]+>/g, '');

    // Basic entity decoding (enough for this ingestion)
    s = s
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

    return s;
}

function parseIntWithCommas(s) {
    if (!s) return null;
    const m = String(s).match(/\d{1,3}(?:,\d{3})+/);
    if (!m) return null;
    return Number(m[0].replace(/,/g, ''));
}

/**
 * KWORB pages render in a predictable text pattern:
 *  - "Pos ..." header
 *  - For each entry:
 *      "<rank> <movement>"
 *      "<Artist> - <Title> ..."
 *      "<stats line with comma-number streams ...>"
 */

async function fetchKworbSpotifyCountryChart({ countryIso2, timespan = 'daily', limit = 10 } = {}) {
    const kw = toKworbCountryCode(countryIso2);
    if (!kw) throw new Error(`Unsupported country ISO2 for KWORB mapping: ${countryIso2}. Add to ISO2_TO_KWORB_COUNTRY.`);

    const span = (timespan === 'weekly') ? 'weekly' : 'daily';
    const url = `https://kworb.net/spotify/country/${kw}_${span}.html`;

    const res = await fetch(url, { headers: { 'User-Agent': 'Audio-Atlas/1.0 (charts ingestion)' } });
    if (!res.ok) throw new Error(`KWORB fetch failed: ${res.status} url=${url}`);

    const html = await res.text();
    const text = stripHtml(html);
    const lines = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

    function kworbDateFromLines(lines) {
        // "Spotify Daily Chart - United States - 2026/03/02 | Totals"
        for (const l of lines) {
            const m = l.match(/\b(20\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\b/);
            if (m) return `${m[1]}-${m[2]}-${m[3]}`; // normalize to YYYY-MM-DD
        }
        return null;
    }

    const kworb_chart_date = kworbDateFromLines(lines);

    // Find where the chart body starts (header contains "Pos")
    // Find the first actual chart row: rank + movement + "Artist - Title"
    const isRank = (s) => /^\d{1,3}$/.test(s);
    const isMove = (s) => /^(=|NEW|RE|[+-]\d+)$/.test(s);
    const isArtistTitle = (s) => /\s+-\s+/.test(s);
    const isStreams = (s) => /^\d{1,3}(?:,\d{3})+$/.test(s);

    let start = 0;
    for (let i = 0; i < lines.length - 3; i++) {
        if (isRank(lines[i]) && isMove(lines[i + 1]) && isArtistTitle(lines[i + 2])) {
            start = i;
            break;
        }
    }

    const out = [];

    for (let i = start; i < lines.length && out.length < limit; i++) {
        if (!isRank(lines[i])) continue;

        const rank = Number(lines[i]);
        const move = lines[i + 1] ?? '';
        const artistTitle = lines[i + 2] ?? '';

        // Validate row start pattern: rank, movement, "Artist - Title"
        if (!Number.isFinite(rank) || rank < 1) continue;
        if (!isMove(move)) continue;
        if (!isArtistTitle(artistTitle)) continue;

        const m = artistTitle.split(/\s+-\s+/);
        const artistName = (m[0] ?? '').trim();
        const trackName = (m.slice(1).join(' - ') ?? '').trim();

        // Find the first comma-number after the artist-title; that is Streams
        let streams = null;
        for (let j = i + 3; j < Math.min(i + 25, lines.length); j++) {
            if (isStreams(lines[j])) {
                streams = Number(lines[j].replace(/,/g, ''));
                break;
            }
        }

        out.push({
            rank,
            trackName,
            artistName,
            streams,
            kworb_url: url
        });

        // Advance a bit to avoid re-detecting within the same row
        i = i + 3;
    }

    if (out.length === 0) {
        throw new Error(`KWORB returned 0 parsed rows. url=${url} (site format may have changed).`);
    }

    return { rows: out, kworb_chart_date, kworb_url: url };
}

export async function ingestSpotifyCountryTopTracks({
    supabase,
    country,                 // ISO2, e.g. "US"
    chartType = 'top_tracks',
    chartDate = isoDate(),
    limit = 10,
    timespan = 'daily'        // 'daily' | 'weekly'
} = {}) {
    if (!supabase) throw new Error('Supabase client is required');
    if (!country) throw new Error('country (ISO2) is required');

    const source = 'spotify';

    // 1) Get ranked list from KWORB (Spotify charts mirror)
    const { rows: chart, kworb_chart_date, kworb_url } = await fetchKworbSpotifyCountryChart({
        countryIso2: country,
        timespan,
        limit
    });

    // 2) Enrich each entry with Spotify Web API (search)
    const enriched = await mapLimit(chart, 4, async (row) => {
        const trackName = row.trackName ?? null;
        const artistName = row.artistName ?? null;

        let spotifyTrackId = null;
        let spotifyPopularity = null;
        let externalUrl = null;
        let albumName = null;
        let releaseYear = null;

        try {
            const s = await searchTrack(trackName, artistName);
            if (s) {
                spotifyTrackId = s.id ?? null;
                spotifyPopularity = Number.isFinite(s.popularity) ? s.popularity : null;
                externalUrl = s.external_urls?.spotify ?? null;
                albumName = s.album?.name ?? null;
                releaseYear = yearFromSpotifyReleaseDate(s.album?.release_date);
            }
        } catch (e) {
            // swallow — we still ingest the chart row even if enrichment fails
        }

        return {
            ...row,
            spotifyTrackId,
            spotifyPopularity,
            externalUrl,
            albumName,
            releaseYear
        };
    });

    const rows = enriched.map((e) => {
        const rank = e.rank;

        const chart_key = buildChartKey({
            chartDate,
            country,
            chartType,
            source,
            rank,
            spotifyTrackId: e.spotifyTrackId,
            lastfmMbid: null,
            trackName: e.trackName,
            artistName: e.artistName
        });

        if (!chart_key) {
            throw new Error(
                `chart_key missing. chartDate=${chartDate} country=${country} chartType=${chartType} source=${source} rank=${rank} ` +
                `spotifyTrackId=${e.spotifyTrackId} trackName=${e.trackName} artistName=${e.artistName}`
            );
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
            spotify_popularity: e.spotifyPopularity,
            preview_url: null, // Spotify preview_url is deprecated/unavailable, try Apple?
            external_url: e.externalUrl,

            playcount: null,
            lastfm_mbid: null,

            // Preserve KWORB metrics + provenance
            raw: {
                provider: 'kworb',
                timespan,
                streams: e.streams ?? null,
                kworb_url,
                kworb_chart_date
            }
        };
    });

    return await upsertMusicCharts({ supabase, rows });
}