import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { config } from './config/index.js';
import { routes } from './routes/index.js';
import { authRoutes } from './routes/auth.routes.js';
import { adminRoutes, setupAdminWebSocket } from './admin/index.js';

const fastify = Fastify({
  logger: {
    level: config.logging.level,
    transport: config.logging.pretty
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            colorize: true,
          },
        }
      : undefined,
  },
  requestTimeout: 60000,
  bodyLimit: 10485760, // 10MB
});

async function start() {
  try {
    // Register plugins
    await fastify.register(helmet, {
      contentSecurityPolicy: config.server.isDevelopment ? false : undefined,
    });

    await fastify.register(cors, {
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    });

    await fastify.register(rateLimit, {
      max: config.api.rateLimit.max,
      timeWindow: config.api.rateLimit.timeWindow,
      cache: 10000,
      allowList: config.server.isDevelopment ? ['127.0.0.1'] : [],
    });

    // Register cookie plugin for session management
    await fastify.register(cookie, {
      secret: process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',
      parseOptions: {},
    });

    // Register routes
    await fastify.register(routes);

    // Register auth routes under /api/v1
    await fastify.register(authRoutes, { prefix: '/api/v1' });

    // Register admin routes and WebSocket
    if (config.admin.enabled) {
      await fastify.register(adminRoutes, { prefix: '/admin/api' });
      await setupAdminWebSocket(fastify);
      fastify.log.info('Admin terminal (Overwatch) enabled');
    }

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.server.env,
      };
    });

    // Ready check endpoint
    fastify.get('/ready', async (request, reply) => {
      // TODO: Add database and redis connection checks
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    });

    // Start server
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    fastify.log.info(
      `Server listening on ${config.server.host}:${config.server.port}`
    );
    fastify.log.info(`Environment: ${config.server.env}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, starting graceful shutdown...`);

    try {
      await fastify.close();
      fastify.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      fastify.log.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  fastify.log.fatal(err, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  fastify.log.fatal({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

start();
