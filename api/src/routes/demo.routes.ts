import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { getScreenshotService } from '../services/screenshot/index.js';
import { chromium } from 'playwright';

interface DemoScreenshotQuery {
  url: string;
  format?: 'png' | 'jpeg' | 'webp';
  width?: number;
  height?: number;
  fullPage?: string;
  scrollY?: number;
  delay?: number;
  quality?: number;
  acceptCookies?: string;
}

interface DemoPDFQuery {
  url: string;
  format?: 'A4' | 'Letter' | 'Legal';
  landscape?: string;
  delay?: number;
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
      const {
        url,
        format = 'png',
        width = 1280,
        height = 720,
        fullPage,
        scrollY = 0,
        delay = 0,
        quality = 90,
        acceptCookies
      } = request.query;

      const isFullPage = fullPage === 'true';
      const shouldAcceptCookies = acceptCookies !== 'false';

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

      // Retry logic for reliability
      const maxRetries = 2;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const screenshotService = getScreenshotService();

          // Capture screenshot with options
          const result = await screenshotService.captureScreenshot({
            url,
            format,
            viewport: { width, height },
            fullPage: isFullPage,
            scrollPosition: !isFullPage && scrollY > 0 ? { x: 0, y: scrollY } : undefined,
            delay: delay > 0 ? delay : undefined,
            quality: format === 'jpeg' ? quality : undefined,
            acceptCookies: shouldAcceptCookies,
            encoding: 'base64',
            waitOptions: {
              waitUntil: 'networkidle',
              timeout: 25000, // 25 second timeout for demo
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
            retries: attempt,
          });
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          console.error(`Demo screenshot attempt ${attempt + 1} failed:`, error);

          // Only retry on certain errors (not validation errors)
          const errorMessage = lastError.message.toLowerCase();
          if (errorMessage.includes('invalid') || errorMessage.includes('blocked')) {
            break; // Don't retry validation errors
          }

          // Wait before retry
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      return reply.code(500).send({
        success: false,
        error: {
          code: 'CAPTURE_FAILED',
          message: lastError?.message || 'Failed to capture screenshot after retries',
        },
        duration,
      });
    }
  );

  // Demo PDF Endpoint
  fastify.get<{ Querystring: DemoPDFQuery }>(
    '/demo/pdf',
    {
      schema: {
        description: 'Generate a demo PDF (no auth required, rate limited)',
        tags: ['demo'],
        querystring: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', description: 'URL to convert to PDF' },
            format: { type: 'string', enum: ['A4', 'Letter', 'Legal'], default: 'A4' },
            landscape: { type: 'string', enum: ['true', 'false'], default: 'false' },
            delay: { type: 'integer', minimum: 0, maximum: 5000, default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const startTime = Date.now();
      const { url, format = 'A4', landscape, delay = 0 } = request.query;
      const isLandscape = landscape === 'true';

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
              message: 'PDFs of local/internal URLs are not allowed',
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

      // Retry logic for reliability
      const maxRetries = 2;
      let lastError: Error | null = null;
      let browser = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Use standalone browser for demo PDF (more stable than pool with --single-process)
          browser = await chromium.launch({
            headless: true,
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
            ],
          });

          const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
          });

          const page = await context.newPage();

          // Navigate to URL
          await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000,
          });

          // Apply delay if specified
          if (delay > 0) {
            await page.waitForTimeout(delay);
          }

          // Generate PDF
          const pdfBuffer = await page.pdf({
            format: format as 'A4' | 'Letter' | 'Legal',
            landscape: isLandscape,
            printBackground: true,
          });

          await context.close();
          await browser.close();

          const duration = (Date.now() - startTime) / 1000;

          // Return PDF as binary
          reply.header('Content-Type', 'application/pdf');
          reply.header('Content-Disposition', `attachment; filename="document-${Date.now()}.pdf"`);
          reply.header('X-PDF-Duration', duration.toFixed(2));
          reply.header('X-PDF-Size', pdfBuffer.length);
          reply.header('X-PDF-Retries', attempt.toString());

          return reply.send(pdfBuffer);
        } catch (error) {
          if (browser) {
            await browser.close().catch(() => {});
            browser = null;
          }
          lastError = error instanceof Error ? error : new Error('Unknown error');
          console.error(`Demo PDF attempt ${attempt + 1} failed:`, error);

          // Only retry on certain errors
          const errorMessage = lastError.message.toLowerCase();
          if (errorMessage.includes('invalid') || errorMessage.includes('blocked')) {
            break; // Don't retry validation errors
          }

          // Wait before retry
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      return reply.code(500).send({
        success: false,
        error: {
          code: 'PDF_FAILED',
          message: lastError?.message || 'Failed to generate PDF after retries',
        },
        duration,
      });
    }
  );
}

export default demoRoutes;
