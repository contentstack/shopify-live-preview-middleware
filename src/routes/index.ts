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
          // Real hashes are 32 hex chars; this keeps out '', 'init' and oversized values.
          live_preview: { type: 'string', pattern: '^[A-Za-z0-9]{16,64}$' },
          // The SDK interpolates these unencoded into the upstream URL, so no URL syntax.
          ctUid: { type: 'string', pattern: '^[A-Za-z0-9_-]+$' },
          entryUid: { type: 'string', pattern: '^[A-Za-z0-9_-]+$' },
          theme_variable: {
            type: 'object',
            required: ['liquid_path', 'data_cslp', 'payload'],
            properties: {
              // Dot-separated names only (sections.product-template): no separators or traversal.
              liquid_path: { type: 'string', pattern: '^[A-Za-z0-9_-]+(\\.[A-Za-z0-9_-]+)*$' },
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
        401: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        502: {
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