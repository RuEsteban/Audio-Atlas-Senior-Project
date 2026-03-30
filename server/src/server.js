import 'dotenv/config';
import { buildApp } from './app.js'
import cors from '@fastify/cors';

const fastify = buildApp()

const allowedOrigins = [
  process.env.FRONTEND_PROD
];

fastify.register(cors, {
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
});

//Run the server
const start = async () => {
  try {
    await fastify.listen({
      port: process.env.PORT || 4000,
      host: '0.0.0.0'
    })

    fastify.log.info(`Server running at http://localhost:${process.env.PORT || 4000}`)
    
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()