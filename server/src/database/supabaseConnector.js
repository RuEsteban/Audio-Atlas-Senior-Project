// ESM
import 'dotenv/config'
import fastifyPlugin from 'fastify-plugin'
import fastifySupabase from 'fastify-supabase';

/**
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function supabaseConnector (fastify, options) {
    fastify.register(fastifySupabase, {
        supabaseKey: process.env.SUPABASE_API_KEY,
        supabaseUrl: process.env.SUPABASE_PROJECT_URL
      })
}

// Wrapping a plugin function with fastify-plugin exposes the decorators
// and hooks, declared inside the plugin to the parent scope.
export default fastifyPlugin(supabaseConnector)



