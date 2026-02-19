import Fastify from 'fastify'

import supabaseConnector from './database/supabaseConnector.js'

import testRoute from './routes/test/testRoute.js'
import testRoute2 from './routes/test2/userRoutes.js'

import healthRoutes from './routes/health/healthRoutes.js'
import supabaseHealth from './routes/health/supabaseHealth.js'

const fastify = Fastify({
  logger: true
})

// SUPABASE CONNECTION //
fastify.register(supabaseConnector)

// ROUTES //
fastify.register(testRoute)
fastify.register(testRoute2)
fastify.register(healthRoutes)
fastify.register(supabaseHealth)

//Run the server
const start = async () => {
  try {
    await fastify.listen({
      port: process.env.PORT || 4000,
      host: '0.0.0.0'
    })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()