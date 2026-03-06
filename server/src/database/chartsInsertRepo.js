// server/src/database/chartsInsertRepo.js

/**
 * Build an application-level chart key for traceability and debugging.
 *
 * This key exists because:
 * - It gives us a deterministic identifier for a chart row as seen by the app.
 * - It is useful for debugging provider matching behavior.
 * - It preserves the provider-specific external identity when available.
 *
 * IMPORTANT:
 * This key is NO LONGER the authoritative database uniqueness rule.
 *
 * Why:
 * - A chart slot is fundamentally defined by:
 *     chart_date + country + chart_type + source + rank
 * - Re-ingesting the same chart date/provider/country may produce a different
 *   external ID or fallback string if enrichment changes.
 * - If the DB only keys on chart_key, duplicate ranks can accumulate across runs.
 *
 * Therefore:
 * - chart_key remains a helpful application identifier
 * - DB upsert conflict handling should target the chart slot instead
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
    /**
    * Fallback identity used when no provider-native stable ID is available.
    *
    * This is intentionally simple:
    * - lowercase
    * - collapse whitespace to underscores
    */
    const fallback =
      `${(trackName ?? '').toLowerCase()}::${(artistName ?? '').toLowerCase()}`
        .replace(/\s+/g, '_')

    /**
    * Prefer stable provider-native identifiers when available.
    * Priority:
    *   1. Spotify track ID
    *   2. Last.fm MBID
    *   3. normalized track/artist fallback
    */
    const externalId = spotifyTrackId ?? lastfmMbid ?? fallback

    return `${chartDate}:${country}:${chartType}:${source}:${rank}:${externalId}`
}

/**
 * Upsert chart rows into public.music_charts.
 *
 * CRITICAL UNIQUENESS RULE:
 * The authoritative unique chart slot is:
 *
 *   (chart_date, country, chart_type, source, rank)
 *
 * - A Top 10 chart should only have one row per rank slot for a given
 *   date/country/provider/chart_type.
 * - Re-ingesting the same chart should UPDATE the existing row for that slot,
 *   not create a second row with a different chart_key.
 *
 * - Keep chart_key indexed or unique only if you still want it enforced independently.
 * - But chart_key should not be the sole conflict target for upserts.
 */
export async function upsertMusicCharts({ supabase, rows }) {
  if (!supabase) {
    throw new Error('Supabase client is required')
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { upserted: 0, data: [] }
  }

  /**
  * Use the chart-slot composite key as the conflict target.
  *
  * This guarantees that repeated ingestion of the same chart date/provider/country
  * updates the existing rank slot instead of duplicating it.
  */
  const { data, error } = await supabase
    .from('music_charts')
    .upsert(rows, {
      onConflict: 'chart_date,country,chart_type,source,rank'
    })
    .select('id, chart_key, chart_date, country, chart_type, source, rank')

  if (error) {
    throw error
  }

  return {
    upserted: data?.length ?? 0,
    data: data ?? []
  }
}