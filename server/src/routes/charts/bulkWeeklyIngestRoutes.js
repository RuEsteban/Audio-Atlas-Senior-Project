// server/src/routes/charts/bulkWeeklyIngestRoutes.js

/**
 * Trigger route for weekly all-country ingestion
 */
import {  ingestAllLastfmWeeklyCharts, ingestAllSpotifyWeeklyCharts, ingestAllWeeklyCharts} from '../../services/bulkWeeklyIngestService.js'
import { clearAllCachedCharts, clearCachedProvider } from '../../services/fetchTracks.js'

// calculates thursday
function getThursdayDate() {
    const today = new Date();
  
    // Change into eastern time
    const estDate = new Date(
      today.toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
  
    const dayOfWeek = estDate.getDay();
    const diff = dayOfWeek >= 4 ? dayOfWeek - 4 : 7 - (4 - dayOfWeek); // calculate difference
  
    estDate.setDate(estDate.getDate() - diff);
    return estDate.toLocaleDateString('en-CA');
}

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
        // cron job for last fm doesn't pass a date. Calculate date here
        const chartDate = 
            body.chartDate ?? 
            (provider === 'lastfm' ? getThursdayDate() : null)
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
                clearCachedProvider('lastfm', chartDate)
            } else {                            // or clear all cache
                clearAllCachedCharts()
            }
        } else if (provider === 'spotify') {
            result = await ingestAllSpotifyWeeklyCharts({
                supabase: fastify.supabase,
                ...(chartDate ? { chartDate } : {}),
                limit,
                concurrency
            })

            if (result?.effectiveChartDate) {                    // clear cache for spotify on this date
                clearCachedProvider('spotify', result.effectiveChartDate)
            } else {                            // or clear all cache
                clearAllCachedCharts()
            }
        } else {
            result = await ingestAllWeeklyCharts({
                supabase: fastify.supabase,
                ...(chartDate ? { chartDate } : {}),
                limit,
                concurrency
            })
            clearAllCachedCharts()               // clear all cache since full bulk ingest
        }

        return reply.send(result)
    })
}