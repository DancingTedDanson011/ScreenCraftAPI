import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Redis } from 'ioredis';
import { registerRawBodyParser } from './middleware/raw-body.middleware.js';
import { createAuthMiddleware } from './middleware/auth.middleware.js';
import { csrfMiddleware } from './middleware/csrf.middleware.js';
import { ApiKeyService } from './services/auth/api-key.service.js';
import { RapidApiService } from './services/rapidapi/rapidapi.service.js';
import { config } from './config/index.js';

// Routes
import screenshotRoutes from './routes/screenshot.routes';
import pdfRoutes from './routes/pdf.routes';
import paymentRoutes from './routes/payment.routes.js';
import formsRoutes from './routes/forms.routes';
import docsRoutes from './routes/docs.routes';
import { gdprRoutes } from './routes/gdpr.routes.js';

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
  // H-13: Use explicit origin allowlist, never allow all origins
  await fastify.register(cors, {
    origin: config.cors.origin, // Explicit allowlist from config
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CSRF-Token'],
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

  // Initialize Redis and auth services for protected routes
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  });

  const apiKeyService = new ApiKeyService(redis);
  const rapidApiService = new RapidApiService();

  // Create auth middleware for protected routes
  const authMiddleware = createAuthMiddleware({
    apiKeyService,
    rapidApiService,
  });

  // Paths that should skip auth (webhooks use their own verification)
  const publicPaths = [
    '/v1/payment/webhooks/stripe',
  ];

  // Attach services to fastify instance for use in controllers
  (fastify as any).apiKeyService = apiKeyService;
  (fastify as any).rapidApiService = rapidApiService;

  // Register API Routes with /v1 prefix
  await fastify.register(
    async (instance) => {
      // Protected routes - require authentication
      await instance.register(
        async (protectedInstance) => {
          // Apply auth middleware with webhook path exclusion
          protectedInstance.addHook('preHandler', async (request, reply) => {
            // Skip auth for webhook endpoints (they use their own verification)
            if (publicPaths.some(path => request.url.startsWith(path.replace('/v1', '')))) {
              return;
            }
            // Apply normal auth middleware
            return authMiddleware(request, reply);
          });

          // H-06: Apply CSRF protection after auth
          protectedInstance.addHook('preHandler', csrfMiddleware);

          // Screenshot and PDF routes require authentication
          await protectedInstance.register(screenshotRoutes);
          await protectedInstance.register(pdfRoutes);

          // Payment routes require authentication
          // Note: Webhook endpoint is excluded via publicPaths check above
          await protectedInstance.register(paymentRoutes, { prefix: '/payment' });

          // M-15: GDPR routes (export, delete) require authentication
          await protectedInstance.register(gdprRoutes);
        }
      );

      // Public routes - no authentication required
      // Forms (newsletter, contact, feedback) are public
      await instance.register(formsRoutes, { prefix: '/forms' });
    },
    { prefix: '/v1' }
  );

  // Cleanup Redis on server close
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });

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
  // H-17: Sanitize error messages in production to prevent information leakage
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    const statusCode = error.statusCode || 500;
    const isDevelopment = config.env === 'development';
    const isProduction = config.env === 'production';

    // H-17: In production, only show generic messages for 5xx errors
    // to prevent leaking sensitive information (DB errors, stack traces, etc.)
    let sanitizedMessage = error.message || 'An unexpected error occurred';
    if (isProduction && statusCode >= 500) {
      sanitizedMessage = 'An internal server error occurred. Please try again later.';
    }

    reply.code(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: sanitizedMessage,
        // Only include stack trace in development
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
