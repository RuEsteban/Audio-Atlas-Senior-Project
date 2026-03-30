import getTopTracks from "../../controllers/controller.js"

const countryRoutes = async (fastify, options) => {
    fastify.get("/api/:source/:date/:country/top-tracks", getTopTracks);
    // other routes here
};

export default countryRoutes;