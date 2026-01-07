import { fastify, FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import 'dotenv/config';

import { registerRoutes } from './routes/index.js';
import { config } from './config.js';

const server: FastifyInstance = fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// Register plugins
server.register(cors, {
  origin: true,
  credentials: true,
});

// Register rate limiting to prevent resource exhaustion
server.register(rateLimit, {
  max: config.contentstack.rateLimit?.max || 100,           // Maximum 100 requests per window
  timeWindow: config.contentstack.rateLimit?.timeWindow || '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
  }),
});

// Register Swagger
server.register(swagger, {
  swagger: {
    info: {
      title: 'Shopify Live Preview API',
      description: 'API documentation for Shopify Live Preview Middleware',
      version: '1.0.0',
    },
    host: 'localhost:3002',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json'],
  },
});

server.register(swaggerUi, {
  routePrefix: '/documentation',
});

// Register routes
registerRoutes(server);

const start = async () => {
  try {
    await server.listen({ port: config.port, host: config.host });
    server.log.info(`Server listening on ${config.host}:${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start(); 