// server/src/routes/charts/spotifyIngestRoutes.js

/**
 * Ingest routes by country (ISO2)
 */

import { ingestSpotifyCountryTopTracks } from '../../services/chartAggregationService.js';

export default async function spotifyIngestRoutes(fastify) {
    fastify.post('/ingest/spotify/country-top-tracks', async (req, reply) => {
        const body = req.body ?? {};
        const country = (body.country ?? '').toUpperCase();
        const limit = body.limit ? Number(body.limit) : 10;
        const chartType = body.chartType ?? 'top_tracks';
        const chartDate = body.chartDate ? String(body.chartDate) : null;
        const timespan = body.timespan === 'weekly' ? 'weekly' : 'daily';

        const result = await ingestSpotifyCountryTopTracks({
            supabase: fastify.supabase,
            country,
            limit,
            chartType,
            timespan,
            ...(chartDate ? { chartDate } : {})
        });

        return reply.send({ ok: true, ...result });
    });
}