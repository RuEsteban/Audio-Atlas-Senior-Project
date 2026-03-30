import fetchTopTracks from '../services/fetchTracks.js'

const getTopTracks = async (request, reply) => {
    try {
        const { source, date, country } = request.params;

        // Pass "fastify" as first argument to use Redis fastify plugin
        const data = await fetchTopTracks(source, date, country);

        return reply.send(data);
    } catch (error) {
        return reply.status(500).send({ error: error.message });
    }
};

export default getTopTracks;