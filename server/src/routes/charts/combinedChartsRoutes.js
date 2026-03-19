// server/src/routes/charts/combinedChartsRoutes.js

import { getCombinedTopTracks } from "../../services/chartAggregationCombinedService.js"

export default async function combinedChartsRoutes(fastify) {
    fastify.get('/api/aggregate/:date/:country/top-tracks', async (request, reply) => {
        try {
            const { date, country } = request.params

            const result = await getCombinedTopTracks({
                country: String(country).toUpperCase(),
                chartDate: date,
                limit: 10
            })

            return reply.send(result)
        }   catch (error) {
            return reply.status(500).send({
                ok: false,
                error: error.message
            })
        }
    })
}