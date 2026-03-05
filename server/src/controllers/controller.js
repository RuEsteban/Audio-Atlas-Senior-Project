import fetchTopTracks from '../services/fetchTracks.js'

const getTopTracks = async (request, reply) => {
    try {
        const {date, country} = request.params

        const data = await fetchTopTracks(date, country)

        return reply.send(data)
    } catch (error) {
        return reply.status(500).send(error)
    }

};

export default getTopTracks;