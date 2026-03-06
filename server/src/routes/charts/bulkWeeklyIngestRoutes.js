// server/src/routes/charts/bulkWeeklyIngestRoutes.js

/**
 * Trigger route for weekly all-country ingestion
 */
import {  ingestAllLastfmWeeklyCharts, ingestAllSpotifyWeeklyCharts, ingestAllWeeklyCharts} from '../../services/bulkWeeklyIngestService.js'

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
        } else if (provider === 'spotify') {
            result = await ingestAllSpotifyWeeklyCharts({
                supabase: fastify.supabase,
                ...(chartDate ? { chartDate } : {}),
                limit,
                concurrency
            })
        } else {
            result = await ingestAllWeeklyCharts({
                supabase: fastify.supabase,
                ...(chartDate ? { chartDate } : {}),
                limit,
                concurrency
            })
        }

        return reply.send(result)
    })
}