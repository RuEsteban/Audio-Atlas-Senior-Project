/**
 * Encapsulates the routes
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 * @param {Object} options plugin options, refer to https://fastify.dev/docs/latest/Reference/Plugins/#plugin-options
 */


const testRoute = async (fastify, options) => {
    fastify.get('/', async (request, reply) => {
        return { hello: 'world' }
      })
      
}

export default testRoute;