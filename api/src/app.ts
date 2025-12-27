import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { registerRawBodyParser } from './middleware/raw-body.middleware.js';

// Routes
import screenshotRoutes from './routes/screenshot.routes';
import pdfRoutes from './routes/pdf.routes';
import paymentRoutes from './routes/payment.routes.js';
import formsRoutes from './routes/forms.routes';
import docsRoutes from './routes/docs.routes';

export interface AppConfig {
  port: number;
  host: string;
  env: 'development' | 'production' | 'test';
  rateLimitMax: number;
  rateLimitTimeWindow: string;
}

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  // Create Fastify instance with TypeBox type provider
  const fastify = Fastify({
    logger: {
      level: config.env === 'production' ? 'info' : 'debug',
      transport:
        config.env === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    trustProxy: true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register CORS
  await fastify.register(cors, {
    origin: config.env === 'production' ? ['https://yourapp.com'] : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  // Register Security Headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // Register raw body parser for Stripe webhooks
  await registerRawBodyParser(fastify);

  // Register Rate Limiting
  await fastify.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitTimeWindow,
    cache: 10000,
    allowList: ['127.0.0.1'],
    redis: undefined, // TODO: Add Redis for distributed rate limiting
    skipOnError: true,
    keyGenerator: (request) => {
      return (
        request.headers['x-api-key'] as string ||
        request.ip ||
        'anonymous'
      );
    },
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
          details: {
            limit: context.max,
            remaining: 0,
            reset: new Date(Date.now() + context.ttl).toISOString(),
          },
        },
      };
    },
  });

  // Register Swagger Documentation
  if (config.env !== 'production') {
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'ScreenCraft API',
          description: 'Professional Screenshot & PDF Generation API',
          version: '1.0.0',
          contact: {
            name: 'API Support',
            email: 'support@screencraft.com',
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT',
          },
        },
        servers: [
          {
            url: `http://${config.host}:${config.port}`,
            description: 'Development server',
          },
        ],
        tags: [
          { name: 'screenshots', description: 'Screenshot operations' },
          { name: 'pdfs', description: 'PDF generation operations' },
          { name: 'payment', description: 'Payment and subscription operations' },
          { name: 'forms', description: 'Form submissions (newsletter, contact, feedback)' },
          { name: 'newsletter', description: 'Newsletter subscription management' },
          { name: 'contact', description: 'Contact form submissions' },
          { name: 'feedback', description: 'User feedback submissions' },
          { name: 'webhooks', description: 'Webhook endpoints' },
          { name: 'health', description: 'Health check operations' },
        ],
        components: {
          securitySchemes: {
            apiKey: {
              type: 'apiKey',
              name: 'X-API-Key',
              in: 'header',
            },
          },
        },
      },
    });

    await fastify.register(swaggerUI, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        displayRequestDuration: true,
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
    });
  }

  // Health Check
  fastify.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    };
  });

  // Register Documentation Routes
  await fastify.register(docsRoutes);

  // Register API Routes with /v1 prefix
  await fastify.register(
    async (instance) => {
      await instance.register(screenshotRoutes);
      await instance.register(pdfRoutes);
      await instance.register(paymentRoutes, { prefix: '/payment' });
      await instance.register(formsRoutes, { prefix: '/forms' });
    },
    { prefix: '/v1' }
  );

  // 404 Handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method}:${request.url} not found`,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
        version: 'v1',
      },
    });
  });

  // Global Error Handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    const statusCode = error.statusCode || 500;
    const isDevelopment = config.env === 'development';

    reply.code(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred',
        ...(isDevelopment && { stack: error.stack }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
        version: 'v1',
      },
    });
  });

  return fastify;
}

// Start server
export async function startServer(config: AppConfig): Promise<FastifyInstance> {
  const app = await buildApp(config);

  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });

    app.log.info(`Server listening on http://${config.host}:${config.port}`);
    if (config.env !== 'production') {
      app.log.info(`Swagger documentation available at http://${config.host}:${config.port}/docs`);
    }

    return app;
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
