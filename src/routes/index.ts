import { FastifyInstance } from 'fastify';
import { getPreviewDataHandler } from '../controllers/index.js';

export const registerRoutes = async (server: FastifyInstance) => {
  // Health check route
  server.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
    },
  });

  server.post('/get-preview-data', {
    schema: {
      body: {
        type: 'object',
        required: ['live_preview', 'ctUid', 'entryUid', 'theme_variable'],
        properties: {
          live_preview: { type: 'string' },
          ctUid: { type: 'string' },
          entryUid: { type: 'string' },
          theme_variable: {
            type: 'object',
            required: ['liquid_path', 'data_cslp', 'payload'],
            properties: {
              liquid_path: { type: 'string' },
              data_cslp: { type: 'string' },
              payload: { type: 'object' }
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            html: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    },
    handler: getPreviewDataHandler
  });
}; 