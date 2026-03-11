// server/src/routes/charts/ingestRoutes.js

/**
 * Ingest routes by country (ISO2) for Last.fm
 */

import { ingestLastfmCountryTopTracks } from '../../services/chartAggregationService.js'
import { clearChartCacheKey } from '../../services/fetchTracks.js'

export default async function ingestRoutes(fastify) {
    fastify.post('/ingest/lastfm/country-top-tracks', {
        schema: {
            body: {
                type: 'object',
                required: ['country'],
                properties: {
                    country: {
                        type: 'string',
                        minLength: 2,
                        maxLength: 2
                    },
                    limit: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 50
                    },
                    chartType: {
                        type: 'string',
                        default: 'top_tracks'
                    },
                    chartDate: {
                        type: 'string',
                        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
                    }
                }   
            }
        }
    }, async (req, reply) => {

        const body = req.body ?? {}

        const country = body.country.toUpperCase()
        const limit = body.limit ?? 10
        const chartType = body.chartType ?? 'top_tracks'
        const chartDate = body.chartDate ?? null

        const result = await ingestLastfmCountryTopTracks({
            supabase: fastify.supabase,
            country,
            limit,
            chartType,
            ...(chartDate ? { chartDate } : {})
        })

        // invalidate in-memory cache for this chart snapshot
        if (chartDate) {
            clearChartCacheKey('lastfm', chartDate, country)
        }

        return reply.send({ ok: true, ...result })
    })
}
