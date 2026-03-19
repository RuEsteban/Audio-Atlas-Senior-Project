// server/src/services/chartAggregationCombinedService.js

import supabase from '../database/supabaseClient.js'
import { aggregateRows } from './chartAggregationCombinedCore.js'

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
    const combined = aggregateRows(rows, limit)

    return {
        country,
        chartDate,
        count: combined.length,
        topSongs: combined
    }
}

