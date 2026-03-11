// server/src/routes/charts/bulkWeeklyIngestRoutes.js

/**
 * Trigger route for weekly all-country ingestion
 */
import {  ingestAllLastfmWeeklyCharts, ingestAllSpotifyWeeklyCharts, ingestAllWeeklyCharts} from '../../services/bulkWeeklyIngestService.js'
import { clearChartCache, clearChartCacheByPrefix } from '../../services/fetchTracks.js'

export default async function bulkWeeklyIngestRoutes(fastify) {
    fastify.post('/ingest/weekly/all', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    provider: {
                        type: 'string',
                        enum: ['lastfm', 'spotify', 'all']
                    },
                    chartDate: {
                        type: 'string',
                        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
                    },
                    limit: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 50
                    },
                    concurrency: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 20
                    }
                }
            }
        }
    }, async (req, reply) => {
        const body = req.body ?? {}

        const provider = body.provider ?? 'all'
        const chartDate = body.chartDate ?? null
        const limit = body.limit ?? 10
        const concurrency = body.concurrency ?? 4

        let result

        if (provider === 'lastfm') {
            result = await ingestAllLastfmWeeklyCharts({
                supabase: fastify.supabase,
                ...(chartDate ? { chartDate } : {}),
                limit,
                concurrency
            })

            if (chartDate) {                    // clear cache for lsstfm on this date
                clearChartCacheByPrefix('lastfm', chartDate)
            } else {                            // or clear all cache
                clearChartCache()
            }
        } else if (provider === 'spotify') {
            result = await ingestAllSpotifyWeeklyCharts({
                supabase: fastify.supabase,
                ...(chartDate ? { chartDate } : {}),
                limit,
                concurrency
            })

            if (result?.effectiveChartDate) {                    // clear cache for spotify on this date
                clearChartCacheByPrefix('spotify', result.effectiveChartDate)
            } else {                            // or clear all cache
                clearChartCache()
            }
        } else {
            result = await ingestAllWeeklyCharts({
                supabase: fastify.supabase,
                ...(chartDate ? { chartDate } : {}),
                limit,
                concurrency
            })
            clearChartCache()               // clear all cache since full bulk ingest
        }

        return reply.send(result)
    })
}