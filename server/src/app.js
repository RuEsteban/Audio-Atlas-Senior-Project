import Fastify from 'fastify'
import supabaseConnector from './database/supabaseConnector.js'
import testRoute from './routes/demo1/testRoute.js'
import testRoute2 from './routes/demo2/userRoutes.js'
import healthRoutes from './routes/health/healthRoutes.js'
import supabaseHealth from './routes/health/supabaseHealth.js'
import ingestRoutes from './routes/charts/ingestRoutes.js'
import spotifyIngestRoutes from './routes/charts/spotifyIngestRoutes.js'
import countryRoutes from './routes/charts/countryRoutes.js'

export function buildApp({ enableSupabase = true } = {}) {
    const fastify = Fastify({ logger: true})

    if (enableSupabase) {
        fastify.register(supabaseConnector)
    }

    fastify.register(testRoute)
    fastify.register(testRoute2)
    fastify.register(healthRoutes)
    fastify.register(supabaseHealth)
    fastify.register(ingestRoutes)
    fastify.register(spotifyIngestRoutes)
    fastify.register(countryRoutes)
    return fastify
}