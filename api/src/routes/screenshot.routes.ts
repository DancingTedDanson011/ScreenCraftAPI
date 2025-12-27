import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  createScreenshot,
  getScreenshot,
  listScreenshots,
  downloadScreenshot,
  deleteScreenshot,
} from '../controllers/screenshot.controller';
import {
  screenshotRequestSchema,
  getScreenshotParamsSchema,
  listScreenshotsQuerySchema,
} from '../schemas/screenshot.schema';

/**
 * Screenshot Routes Plugin
 * Registers all screenshot-related endpoints
 */
export async function screenshotRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Create Screenshot
  fastify.post(
    '/screenshots',
    {
      schema: {
        description: 'Create a new screenshot',
        tags: ['screenshots'],
        body: screenshotRequestSchema,
        response: {
          201: {
            description: 'Screenshot created successfully (sync)',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
          202: {
            description: 'Screenshot queued for processing (async)',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
          400: {
            description: 'Bad request - validation error',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'object' },
            },
          },
          429: {
            description: 'Rate limit exceeded',
            type: 'object',
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    createScreenshot
  );

  // Get Screenshot Status
  fastify.get(
    '/screenshots/:id',
    {
      schema: {
        description: 'Get screenshot status and metadata',
        tags: ['screenshots'],
        params: getScreenshotParamsSchema,
        response: {
          200: {
            description: 'Screenshot found',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
          404: {
            description: 'Screenshot not found',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'object' },
            },
          },
        },
      },
    },
    getScreenshot
  );

  // List Screenshots
  fastify.get(
    '/screenshots',
    {
      schema: {
        description: 'List all screenshots with pagination and filtering',
        tags: ['screenshots'],
        querystring: listScreenshotsQuerySchema,
        response: {
          200: {
            description: 'List of screenshots',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    listScreenshots
  );

  // Download Screenshot
  fastify.get(
    '/screenshots/:id/download',
    {
      schema: {
        description: 'Download screenshot file',
        tags: ['screenshots'],
        params: getScreenshotParamsSchema,
        response: {
          200: {
            description: 'Screenshot file',
            type: 'string',
            format: 'binary',
          },
          404: {
            description: 'Screenshot not found',
            type: 'object',
          },
          400: {
            description: 'Screenshot not ready',
            type: 'object',
          },
        },
      },
    },
    downloadScreenshot
  );

  // Delete Screenshot
  fastify.delete(
    '/screenshots/:id',
    {
      schema: {
        description: 'Delete a screenshot',
        tags: ['screenshots'],
        params: getScreenshotParamsSchema,
        response: {
          204: {
            description: 'Screenshot deleted successfully',
            type: 'null',
          },
          404: {
            description: 'Screenshot not found',
            type: 'object',
          },
        },
      },
    },
    deleteScreenshot
  );
}

// Export default for auto-loading
export default screenshotRoutes;
