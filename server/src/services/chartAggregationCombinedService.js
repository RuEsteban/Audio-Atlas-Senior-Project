// server/src/services/chartAggregationCombinedService.js

import supabase from '../database/supabaseClient.js'

// search indexing, text comparison, and sanitizing song value input to disregard
// variations in case, accents, punctuation, and spacing used for matching

function normalizeText(value) {
    return String(value ?? '')              // ensure we get a string
        .toLowerCase()                      // make everything lowercase
        .normalize('NKFD')                  // normalize unicode (decompose accented chars)
        .replace(/[^\w\s]/g, '')            // remove all non-word and non-space chars)
        .replace(/\s+/g, ' ')               // collapse multiple spaces into one space
        .trim()                             // remove leading/trailing spaces
}

// ensure every track has a consistent, comparable key
// prefer Spotify's unique ID but fallback to normalized text key

function buildMatchKey(row) {
    if (row.spotify_track_id) {                     // use Spotify ID if it exists
        return `spotify:${row.spotify_track_id}`
    }
    const track = normalizeText(row.track_name)     // normalize track name
    const artist = normalizeText(row.artist_name)   // normalize artist name
    return `text:${track}::${artist}`               // build normalize text key and return it if Spotify DNE
}

// establish ranking points paradigm where inverted 10-1 points given for ranks 1-10
function rankToPoints(rank) {
    if (!Number.isFinite(rank)) return 0    // guard clause to ensure we have valid finite number
    if (rank < 1 || rank > 10) return 0     // rank must be between 1-10, or otherwise invalid
    return 11 - rank                        // return points for ranking
}

function choosePreferredValue(existing, incoming, field) {
    // prefer non-null values
    if (existing?.[field] && !incoming?.[field]) return existing[field]
    if (!existing?.[field] && incoming?.[field]) return incoming[field]

    // if both exist, prefer Spotify row values
    if (incoming?.source === 'spotify' && incoming?.[field]) return incoming[field]
    if (existing?.source === 'spotify' && existing?.[field]) return existing[field]

    // fallback: return existing value, then incoming value, else null
    return existing?.[field] ?? incoming?.[field] ?? null
}

export async function getCombinedTopTracks({
    country,
    chartDate,
    limit = 10
}) {
    if (!country) throw new Error('country is required')
    if (!chartDate) throw new Error('chartDate is required')

    const { data, error } = await supabase
        .from('music_charts')
        .select(`
            source,
            chart_date,
            country,
            rank,
            track_name,
            artist_name,
            album_name,
            release_year,
            image_url,
            external_url,
            spotify_track_id
        `)
        .eq('country', country)
        .eq('chart_date', chartDate)
        .in('source', ['spotify', 'lastfm'])
        .order('source')
        .order('rank', { ascending: true })

    if (error) throw error

    const rows = data ?? []
    const merged = new Map()

    for (const row of rows) {
        const key = buildMatchKey(row)
        const existing = merged.get(key)

        const sourcePoints = rankToPoints(row.rank)

        if (!existing) {
            merged.set(key, {
                match_key: key,
                chart_date: row.chart_date,
                country: row.country,
                track_name: row.track_name,
                artist_name: row.artist_name,
                album_name: row.album_name ?? null,
                release_year: row.release_year ?? null,
                image_url: row.image_url ?? null,
                external_url: row.external_url ?? null,
                spotify_track_id: row.spotify_track_id ?? null,
                spotify_rank: row.source === 'spotify' ? row.rank : null,
                lastfm_rank: row.source === 'lastfm' ? row.rank : null,
                spotify_points: row.source === 'spotify' ? sourcePoints : 0,
                lastfm_points: row.source === 'lastfm' ? sourcePoints : 0,
                combined_score: sourcePoints,
                sources_present: [row.source],
            })
            continue
        }

        existing.track_name = choosePreferredValue(existing, row, 'track_name')
        existing.artist_name = choosePreferredValue(existing, row, 'artist_name')
        existing.album_name = choosePreferredValue(existing, row, 'album_name')
        existing.release_year = choosePreferredValue(existing, row, 'release_year')
        existing.image_url = choosePreferredValue(existing, row, 'image_url')
        existing.external_url = choosePreferredValue(existing, row, 'external_url')
        existing.spotify_track_id = choosePreferredValue(existing, row, 'spotify_track_id')

        if (row.source === 'spotify') {
            existing.spotify_rank = row.rank
            existing.spotify_points = sourcePoints
        }

        if (row.source === 'lastfm') {
            existing.lastfm_rank = row.rank
            existing.lastfm_points = sourcePoints
        }

        if (!existing.sources_present.includes(row.source)) {
            existing.sources_present.push(row.source)
        }

        existing.combined_score = existing.spotify_points + existing.lastfm_points
    }

    const combined = [...merged.values()]
        .sort((a, b) => {
            if (b.combined_score !== a.combined_score) {
                return b.combined_score - a.combined_score
            }

            // tie-breaker: better Spotify rank, then better Last.fm rank
            const aSpotify = a.spotify_rank ?? 999
            const bSpotify = b.spotify_rank ?? 999
            if (aSpotify !== bSpotify) return aSpotify - bSpotify

            const aLastfm = a.lastfm_rank ?? 999
            const bLastfm = b.lastfm_rank ?? 999
            return aLastfm - bLastfm
        })
        .slice(0, limit)
        .map((row, idx) => ({
            aggregate_rank: idx + 1,
            ...row
        }))
    
    return {
        country,
        chartDate,
        count: combined.length,
        topSongs: combined
    }
}



