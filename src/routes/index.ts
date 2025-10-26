import { FastifyInstance } from 'fastify';
import { syncGithubRepoHandler } from '../controllers/githubSyncController.js';
import { getPreviewDataHandler, viewsHealthHandler } from '../controllers/index.js';

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

  // Views directory health check route
  server.get('/health/views', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            viewsDirectory: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                exists: { type: 'boolean' },
                writable: { type: 'boolean' },
                totalFiles: { type: 'number' },
                totalDirectories: { type: 'number' },
                totalSize: { type: 'number' },
                contents: { type: 'array' }
              }
            },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            viewsDirectory: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                exists: { type: 'boolean' },
                writable: { type: 'boolean' },
                totalFiles: { type: 'number' },
                totalDirectories: { type: 'number' },
                totalSize: { type: 'number' },
                contents: { type: 'array' }
              }
            },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            viewsDirectory: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                exists: { type: 'boolean' },
                writable: { type: 'boolean' },
                totalFiles: { type: 'number' },
                totalDirectories: { type: 'number' },
                totalSize: { type: 'number' },
                contents: { type: 'array' }
              }
            },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: viewsHealthHandler
  });

  // GitHub repo sync route
  server.post('/sync-github-repo', {
    schema: {
      body: {
        type: 'object',
        required: ['authtoken', 'repoName'],
        properties: {
          authtoken: { 
            type: 'string',
            description: 'GitHub personal access token'
          },
          repoName: { 
            type: 'string',
            description: 'Repository name in format owner/repo'
          },
          branch: {
            type: 'string',
            description: 'Optional branch name to clone (defaults to repository default branch)'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    },
    handler: syncGithubRepoHandler
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