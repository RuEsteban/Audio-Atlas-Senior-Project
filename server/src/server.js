import { buildApp } from './app.js'
import cors from '@fastify/cors';

const fastify = buildApp()

fastify.register(cors, { 
  origin: true
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