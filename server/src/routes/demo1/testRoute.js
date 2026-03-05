//  server/src/routes/demo1/testRoute.js

/**
 * Encapsulates the routes
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 * @param {Object} options plugin options, refer to https://fastify.dev/docs/latest/Reference/Plugins/#plugin-options
 */

// Testing Spotify enrichment path

import { enrichTrack } from '../../services/enrichmentService.js';

export default async function testRoute(fastify, options) {
  fastify.get('/demo1/enrich', async (request, reply) => {
    const { track, artist } = request.query;

    if (!track || !artist) {
      return reply.code(400).send({ error: 'Missing query params: track, artist' });
    }

    const result = await enrichTrack({ trackName: track, artistName: artist });
    return result;
  });
}
