// server/src/database/chartsInsertRepo.js

/**
 * Create a unique key for a chart row
 * Current format is YYYY-MM-DD:COUNTRY:CHART_TYPE:SOURCE:RANK:EXTERNAL_ID
 */

export function buildChartKey({
    chartDate,
    country,
    chartType,
    source,
    rank,
    spotifyTrackId = null,
    lastfmMbid = null,
    trackName = '',
    artistName = ''
}) {
  const externalId =
    spotifyTrackId ??
    lastfmMbid ??
    `${(trackName ?? '').toLowerCase()}::${(artistName ?? '').toLowerCase()}`.replace(/\s+/g, '_')
  return `${chartDate}:${country}:${chartType}:${source}:${rank}:${externalId}`
}

/**
 * Upsert rows into music_charts using unique chart_key.
 * Require unique index on public.music_charts(chart_key)
 */

export async function upsertMusicCharts({ supabase, rows}) {
  if (!supabase) throw new Error('Supabase client is required')
  if (!Array.isArray(rows) || rows.length === 0) return { upserted: 0, data: [] }

    const { data, error } = await supabase
      .from('music_charts')
      .upsert(rows, { onConflict: 'chart_key' })
      .select('id, chart_key, chart_date, country, chart_type, source, rank')

    if (error) throw error
    return { upserted: data?.length ?? 0, data: data ?? [] }
}