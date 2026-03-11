// server/src/routes/charts/spotifyIngestRoutes.js

/**
 * Ingest routes by country (ISO2) for Spotify
 */

import { ingestSpotifyCountryTopTracks } from '../../services/chartAggregationService.js';

export default async function spotifyIngestRoutes(fastify) {

    fastify.post('/ingest/spotify/country-top-tracks', {
        schema: {
            body: {
                type: 'object',
                required: ['country'],
                properties: {
                    country: { type: 'string', minLength: 2, maxLength: 2 },
                    limit: { type: 'integer', minimum: 1, maximum: 50 },
                    chartType: { type: 'string', default: 'top_tracks' },
                    chartDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                    timespan: { type: 'string', enum: ['daily', 'weekly'] }
                }
            }
        }
    }, async (req, reply) => {

        const body = req.body ?? {}

        const country = body.country.toUpperCase()
        const limit = body.limit ?? 10
        const chartType = body.chartType ?? 'top_tracks'
        const chartDate = body.chartDate ?? null

        // Daily is now the default option because KWORB weekly charts are too stale
        const timespan = body.timespan === 'weekly' ? 'weekly' : 'daily'

        const result = await ingestSpotifyCountryTopTracks({
            supabase: fastify.supabase,
            country,
            limit,
            chartType,
            timespan,
            ...(chartDate ? { chartDate } : {})
        })

        return reply.send({ ok: true, ...result })
    })
}