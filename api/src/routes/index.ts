import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { dashboardRoutes } from './dashboard.routes.js';
import { demoRoutes } from './demo.routes.js';
import { screenshotRoutes } from './screenshot.routes.js';
import { pdfRoutes } from './pdf.routes.js';
import paymentRoutes from './payment.routes.js';
import { gdprRoutes } from './gdpr.routes.js';
import { formsRoutes } from './forms.routes.js';
import { createAuthMiddleware, AuthMiddlewareOptions } from '../middleware/auth.middleware.js';
import { sessionMiddleware } from '../middleware/session.middleware.js';
import { ApiKeyService } from '../services/auth/api-key.service.js';
import { Redis } from 'ioredis';
import { config } from '../config/index.js';

export async function routes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Initialize Redis and ApiKeyService for auth
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  });

  const apiKeyService = new ApiKeyService(redis);

  // Attach apiKeyService to fastify instance for use in controllers
  (fastify as any).apiKeyService = apiKeyService;

  // Create API key auth middleware (for programmatic API access)
  const authMiddlewareOptions: AuthMiddlewareOptions = {
    apiKeyService,
  };
  const authMiddleware = createAuthMiddleware(authMiddlewareOptions);

  // Dashboard session middleware wrapper - uses session auth and sets request.auth for compatibility
  async function dashboardSessionMiddleware(request: FastifyRequest, reply: FastifyReply) {
    // Skip session middleware for webhook endpoints (Stripe webhooks have no session)
    if (request.url.includes('/webhooks/')) {
      return;
    }

    // First, run the session middleware
    await sessionMiddleware(request, reply);

    // If response was already sent (401), don't continue
    if (reply.sent) {
      return;
    }

    // If session middleware didn't return early (401), set request.auth for controller compatibility
    if (request.account) {
      request.auth = {
        id: request.account.id,
        accountId: request.account.id,
        tier: request.account.tier,
        monthlyCredits: request.account.monthlyCredits,
        usedCredits: request.account.usedCredits,
        isActive: true,
      };
    }
  }

  // API version prefix
  fastify.register(
    async (api) => {
      // Root API endpoint
      api.get('/', async (request, reply) => {
        return {
          name: 'ScreenCraft API',
          version: '1.0.0',
          description: 'Screenshot Generation Service',
          endpoints: {
            health: '/health',
            ready: '/ready',
            api: '/api/v1',
            dashboard: '/api/v1/dashboard',
          },
        };
      });

      // Register dashboard routes with SESSION middleware (for web users)
      await api.register(
        async (dashboardApi) => {
          // Apply session middleware to all dashboard routes
          dashboardApi.addHook('preHandler', dashboardSessionMiddleware);

          // Register dashboard routes
          await dashboardApi.register(dashboardRoutes);
        },
        { prefix: '/dashboard' }
      );

      // Register payment routes with SESSION middleware (for dashboard billing)
      await api.register(
        async (paymentApi) => {
          // Apply session middleware to payment routes
          paymentApi.addHook('preHandler', dashboardSessionMiddleware);

          // Register payment routes: /api/v1/payment/checkout, /subscription, /portal, etc.
          await paymentApi.register(paymentRoutes);
        },
        { prefix: '/payment' }
      );

      // Register GDPR routes with SESSION middleware (for data export/deletion)
      await api.register(
        async (gdprApi) => {
          // Apply session middleware to GDPR routes
          gdprApi.addHook('preHandler', dashboardSessionMiddleware);

          // Register GDPR routes: /api/v1/gdpr/export, /delete-account
          await gdprApi.register(gdprRoutes);
        },
        { prefix: '/gdpr' }
      );

      // Register forms routes (public, no auth required)
      await api.register(formsRoutes, { prefix: '/forms' });

      // Register demo routes (public, no auth required)
      await api.register(demoRoutes);

      // NOTE: Auth routes and Admin routes are registered in server.ts
      // Auth: /api/v1/auth/*
      // Admin: /admin/api/*

      // Register screenshot and PDF routes with API key authentication
      await api.register(
        async (protectedApi) => {
          // Apply API key auth middleware to all protected routes
          protectedApi.addHook('preHandler', authMiddleware);

          // Screenshot routes: POST /api/v1/screenshots, GET /api/v1/screenshots/:id, etc.
          await protectedApi.register(screenshotRoutes);

          // PDF routes: POST /api/v1/pdfs, GET /api/v1/pdfs/:id, etc.
          await protectedApi.register(pdfRoutes);
        }
      );
    },
    { prefix: '/api/v1' }
  );

  // Cleanup on server close
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
}
