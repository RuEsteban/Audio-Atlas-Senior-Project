import fetchTopTracks from '../services/fetchTracks.js'

const getTopTracks = async (request, reply) => {
    try {
        const {source, date, country} = request.params

        const data = await fetchTopTracks(source, date, country)

        return reply.send(data)
    } catch (error) {
        return reply.status(500).send(error)
    }

};

export default getTopTracks;