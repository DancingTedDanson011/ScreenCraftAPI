import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { getScreenshotService } from '../services/screenshot/index.js';

interface DemoScreenshotQuery {
  url: string;
  format?: 'png' | 'jpeg' | 'webp';
  width?: number;
  height?: number;
}

/**
 * Demo Routes Plugin
 * Public endpoints for landing page demo (no auth required)
 */
export async function demoRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Apply strict rate limiting for demo endpoints
  await fastify.register(import('@fastify/rate-limit'), {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Demo rate limit exceeded. Please wait a minute before trying again.',
      },
    }),
  });

  // Demo Screenshot Endpoint
  fastify.get<{ Querystring: DemoScreenshotQuery }>(
    '/demo/screenshot',
    {
      schema: {
        description: 'Generate a demo screenshot (no auth required, rate limited)',
        tags: ['demo'],
        querystring: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', description: 'URL to capture' },
            format: { type: 'string', enum: ['png', 'jpeg', 'webp'], default: 'png' },
            width: { type: 'integer', minimum: 320, maximum: 1920, default: 1280 },
            height: { type: 'integer', minimum: 240, maximum: 1080, default: 720 },
          },
        },
        response: {
          200: {
            description: 'Screenshot captured successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              imageBase64: { type: 'string' },
              width: { type: 'integer' },
              height: { type: 'integer' },
              format: { type: 'string' },
              size: { type: 'integer' },
              duration: { type: 'number' },
            },
          },
          400: {
            description: 'Invalid request',
            type: 'object',
          },
          429: {
            description: 'Rate limit exceeded',
            type: 'object',
          },
          500: {
            description: 'Screenshot capture failed',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const startTime = Date.now();
      const { url, format = 'png', width = 1280, height = 720 } = request.query;

      // Validate URL
      try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'INVALID_URL',
              message: 'URL must use http or https protocol',
            },
          });
        }

        // Block localhost and internal IPs for security
        const hostname = parsedUrl.hostname.toLowerCase();
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')
        ) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'BLOCKED_URL',
              message: 'Screenshots of local/internal URLs are not allowed',
            },
          });
        }
      } catch {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_URL',
            message: 'Please provide a valid URL',
          },
        });
      }

      try {
        const screenshotService = getScreenshotService();

        // Capture screenshot with limited options
        const result = await screenshotService.captureScreenshot({
          url,
          format,
          viewport: { width, height },
          fullPage: false,
          encoding: 'base64',
          waitOptions: {
            waitUntil: 'networkidle',
            timeout: 15000, // 15 second timeout for demo
          },
        });

        const duration = (Date.now() - startTime) / 1000;

        return reply.code(200).send({
          success: true,
          imageBase64: result.buffer.toString('base64'),
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.fileSize,
          duration,
        });
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        console.error('Demo screenshot error:', error);

        return reply.code(500).send({
          success: false,
          error: {
            code: 'CAPTURE_FAILED',
            message: error instanceof Error ? error.message : 'Failed to capture screenshot',
          },
          duration,
        });
      }
    }
  );
}

export default demoRoutes;
