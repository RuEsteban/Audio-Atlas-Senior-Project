// our-first-route.js
/**
 * Encapsulates the routes
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 * @param {Object} options plugin options, refer to https://fastify.dev/docs/latest/Reference/Plugins/#plugin-options
 */

const routes = async (fastify, options) => {
    fastify.put('/update-info-test', async (request, reply) => {
        const { supabase } = fastify

        const { data, error } = await fastify.supabase
            .from('music_charts')       // replace with your table name
            .update({ source: 'hunter', country: 'hunter' })
            .eq('id', 1)                // only row with id = 1
            .select()     

        if (error) {
            return reply.status(500).send({ error: error.message })
            }
        
            return reply.send({ success: true, data })
    })
  }

  //ESM
  export default routes;