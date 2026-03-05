import getTopTracks from "../../controllers/controller.js"

const countryRoutes = async (fastify, options) => {
    fastify.get("/api/:date/:country/top-tracks", getTopTracks)
    // others here
}

export default countryRoutes;