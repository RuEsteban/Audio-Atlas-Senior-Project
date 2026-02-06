// our-first-route.js
/**
 * Encapsulates the routes
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 * @param {Object} options plugin options, refer to https://fastify.dev/docs/latest/Reference/Plugins/#plugin-options
 */

const routes = async (fastify, options) => {
    fastify.get('/read', async (request, reply) => {
        const { supabase } = fastify
      
        const { data, error } = await supabase.from('music_charts').select()
      
        return { data, error }
      })
  }


  //ESM
  export default routes;