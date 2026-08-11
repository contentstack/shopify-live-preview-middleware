import { fastify, FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import 'dotenv/config';

import { registerRoutes } from './routes/index.js';
import { config } from './config.js';

export interface BuildServerOptions {
  logger?: FastifyServerOptions['logger'];
}

const defaultLogger: FastifyServerOptions['logger'] = {
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  },
};

/**
 * Builds a fully configured server without binding a port, so tests can drive it
 * through fastify's `.inject()` instead of standing up a real listener.
 */
export const buildServer = (options: BuildServerOptions = {}): FastifyInstance => {
  const server: FastifyInstance = fastify({
    logger: options.logger === undefined ? defaultLogger : options.logger,
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

  return server;
};
