import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { dashboardRoutes } from './dashboard.routes.js';
import { demoRoutes } from './demo.routes.js';
import { createAuthMiddleware, AuthMiddlewareOptions } from '../middleware/auth.middleware.js';
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

  // Create auth middleware
  const authMiddlewareOptions: AuthMiddlewareOptions = {
    apiKeyService,
  };
  const authMiddleware = createAuthMiddleware(authMiddlewareOptions);

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

      // Register dashboard routes with auth middleware
      await api.register(
        async (dashboardApi) => {
          // Apply auth middleware to all dashboard routes
          dashboardApi.addHook('preHandler', authMiddleware);

          // Register dashboard routes
          await dashboardApi.register(dashboardRoutes);
        },
        { prefix: '/dashboard' }
      );

      // Register demo routes (public, no auth required)
      await api.register(demoRoutes);

      // TODO: Register additional feature routes here
      // await api.register(screenshotRoutes, { prefix: '/screenshots' });
      // await api.register(jobRoutes, { prefix: '/jobs' });
    },
    { prefix: '/api/v1' }
  );

  // Cleanup on server close
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
}
