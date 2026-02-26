// server/src/routes/charts/ingestRoutes.js

/**
 * Ingest routes by country (ISO2)
 */

import { ingestLastfmCountryTopTracks } from '../../services/chartAggregationService.js'

export default async function ingestRoutes(fastify) {
    fastify.post('/ingest/lastfm/country-top-tracks', async (req, reply) => {
        const body = req.body ?? {}
        const country = (body.country ?? '').toUpperCase()
        const limit = body.limit ? Number(body.limit) : 10
        const chartType = body.chartType ?? 'top_tracks'
        const chartDate = body.chartDate        // optional YYYY-MM-DD

        const result = await ingestLastfmCountryTopTracks({
            supabase: fastify.supabase,
            country,
            limit,
            chartType,
            chartDate
        })
        return reply.send({ ok: true, ...result})
    })
}