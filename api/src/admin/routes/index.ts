// Admin Routes - All Admin API Endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  adminAuthMiddleware,
  requireRole,
  adminLogin,
  adminLogout,
  createAuditLog,
} from '../middleware/admin-auth.middleware.js';
import {
  adminLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
} from '../middleware/rate-limit.middleware.js';
import { metricsService } from '../services/metrics.service.js';
import { adminUsersService } from '../services/admin-users.service.js';
import { adminApiKeysService } from '../services/admin-apikeys.service.js';
import { adminJobsService } from '../services/admin-jobs.service.js';
import { adminLogsService } from '../services/admin-logs.service.js';
import { Tier, AdminRole } from '@prisma/client';

/**
 * Admin Routes
 * All routes for the admin terminal (Overwatch)
 */
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // ============================================
  // AUTHENTICATION
  // ============================================

  /**
   * Admin Login
   * Protected with rate limiting to prevent brute-force attacks
   */
  fastify.post(
    '/auth/login',
    { preHandler: adminLoginRateLimit },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, password } = request.body as { email: string; password: string };

      if (!email || !password) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Email and password are required',
        });
      }

      try {
        const result = await adminLogin(
          email,
          password,
          request.ip,
          request.headers['user-agent']
        );

        // Clear rate limit on successful login
        clearLoginAttempts(request);

        // Log the login
        await createAuditLog(
          result.admin.adminId,
          'ADMIN_LOGIN',
          'admin_user',
          result.admin.adminId,
          { email: result.admin.email },
          request.ip
        );

        return {
          token: result.token,
          admin: {
            id: result.admin.adminId,
            email: result.admin.email,
            name: result.admin.name,
            role: result.admin.role,
          },
          expiresAt: result.expiresAt.toISOString(),
        };
      } catch (error) {
        // Record failed login attempt for rate limiting
        recordFailedLogin(request);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        request.log.warn({ email, errorMessage }, 'Failed admin login attempt');
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid credentials',
          debug: errorMessage, // Temporary debug
        });
      }
    }
  );

  /**
   * Admin Logout
   */
  fastify.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (token) {
      await adminLogout(token);
    }

    return { success: true };
  });

  /**
   * Get current admin info
   */
  fastify.get(
    '/auth/me',
    { preHandler: adminAuthMiddleware },
    async (request: FastifyRequest) => {
      return {
        admin: request.admin,
      };
    }
  );

  // ============================================
  // PROTECTED ROUTES
  // ============================================

  fastify.register(async (protectedRoutes) => {
    // Apply auth middleware to all routes
    protectedRoutes.addHook('preHandler', adminAuthMiddleware);

    // ============================================
    // METRICS & DASHBOARD
    // ============================================

    /**
     * Get server metrics
     */
    protectedRoutes.get('/metrics/server', async () => {
      return metricsService.getServerMetrics();
    });

    /**
     * Get browser pool metrics
     */
    protectedRoutes.get('/metrics/browser', async () => {
      return await metricsService.getBrowserPoolMetrics();
    });

    /**
     * Get queue metrics
     */
    protectedRoutes.get('/metrics/queue', async () => {
      return await metricsService.getAllQueueMetrics();
    });

    /**
     * Get overview metrics (all combined)
     */
    protectedRoutes.get('/metrics/overview', async () => {
      return await metricsService.getOverviewMetrics();
    });

    /**
     * Get database statistics
     */
    protectedRoutes.get('/metrics/database', async () => {
      return await metricsService.getDatabaseStats();
    });

    /**
     * Get recent activity stats
     */
    protectedRoutes.get('/metrics/activity', async (request: FastifyRequest) => {
      const { hours = 24 } = request.query as { hours?: number };
      return await metricsService.getRecentActivityStats(Number(hours));
    });

    /**
     * Get error rates
     */
    protectedRoutes.get('/metrics/errors', async (request: FastifyRequest) => {
      const { hours = 24 } = request.query as { hours?: number };
      return await metricsService.getJobErrorRate(Number(hours));
    });

    /**
     * Get tier distribution
     */
    protectedRoutes.get('/metrics/tiers', async () => {
      return await metricsService.getTierDistribution();
    });

    // ============================================
    // USER MANAGEMENT
    // ============================================

    /**
     * List users
     */
    protectedRoutes.get('/users', async (request: FastifyRequest) => {
      const query = request.query as any;
      return await adminUsersService.listUsers({
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc',
        search: query.search,
        tier: query.tier as Tier | undefined,
      });
    });

    /**
     * Get user details
     */
    protectedRoutes.get('/users/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = await adminUsersService.getUser(id);

      if (!user) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      return user;
    });

    /**
     * Update user tier
     */
    protectedRoutes.patch(
      '/users/:id/tier',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const { tier } = request.body as { tier: Tier };

        if (!Object.values(Tier).includes(tier)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Invalid tier',
          });
        }

        await adminUsersService.updateUserTier(id, tier, request.admin!.adminId);
        return { success: true };
      }
    );

    /**
     * Reset user credits
     */
    protectedRoutes.post(
      '/users/:id/reset-credits',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) },
      async (request: FastifyRequest) => {
        const { id } = request.params as { id: string };
        await adminUsersService.resetUserCredits(id, request.admin!.adminId);
        return { success: true };
      }
    );

    /**
     * Add bonus credits
     */
    protectedRoutes.post(
      '/users/:id/bonus-credits',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const { amount } = request.body as { amount: number };

        if (typeof amount !== 'number' || amount <= 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Amount must be a positive number',
          });
        }

        await adminUsersService.addBonusCredits(id, amount, request.admin!.adminId);
        return { success: true };
      }
    );

    /**
     * Ban user
     */
    protectedRoutes.post(
      '/users/:id/ban',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) },
      async (request: FastifyRequest) => {
        const { id } = request.params as { id: string };
        const { reason } = request.body as { reason?: string };
        await adminUsersService.banUser(id, reason || 'No reason provided', request.admin!.adminId);
        return { success: true };
      }
    );

    /**
     * Unban user
     */
    protectedRoutes.post(
      '/users/:id/unban',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) },
      async (request: FastifyRequest) => {
        const { id } = request.params as { id: string };
        await adminUsersService.unbanUser(id, request.admin!.adminId);
        return { success: true };
      }
    );

    /**
     * Delete user
     */
    protectedRoutes.delete(
      '/users/:id',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN) },
      async (request: FastifyRequest) => {
        const { id } = request.params as { id: string };
        await adminUsersService.deleteUser(id, request.admin!.adminId);
        return { success: true };
      }
    );

    // ============================================
    // API KEY MANAGEMENT
    // ============================================

    /**
     * List API keys
     */
    protectedRoutes.get('/api-keys', async (request: FastifyRequest) => {
      const query = request.query as any;
      return await adminApiKeysService.listApiKeys({
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc',
        search: query.search,
        isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
        accountId: query.accountId,
      });
    });

    /**
     * Get API key details
     */
    protectedRoutes.get('/api-keys/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const keyDetails = await adminApiKeysService.getApiKey(id);

      if (!keyDetails) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'API key not found',
        });
      }

      return keyDetails;
    });

    /**
     * Revoke API key
     */
    protectedRoutes.post(
      '/api-keys/:id/revoke',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) },
      async (request: FastifyRequest) => {
        const { id } = request.params as { id: string };
        await adminApiKeysService.revokeApiKey(id, request.admin!.adminId);
        return { success: true };
      }
    );

    /**
     * Reactivate API key
     */
    protectedRoutes.post(
      '/api-keys/:id/reactivate',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) },
      async (request: FastifyRequest) => {
        const { id } = request.params as { id: string };
        await adminApiKeysService.reactivateApiKey(id, request.admin!.adminId);
        return { success: true };
      }
    );

    /**
     * Delete API key
     */
    protectedRoutes.delete(
      '/api-keys/:id',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN) },
      async (request: FastifyRequest) => {
        const { id } = request.params as { id: string };
        await adminApiKeysService.deleteApiKey(id, request.admin!.adminId);
        return { success: true };
      }
    );

    /**
     * Get API key statistics
     */
    protectedRoutes.get('/api-keys/stats/overview', async () => {
      return await adminApiKeysService.getApiKeyStats();
    });

    // ============================================
    // JOB MANAGEMENT
    // ============================================

    /**
     * List jobs
     */
    protectedRoutes.get('/jobs', async (request: FastifyRequest) => {
      const query = request.query as any;
      return await adminJobsService.listJobs({
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc',
        type: query.type || 'all',
        status: query.status,
        accountId: query.accountId,
        search: query.search,
      });
    });

    /**
     * Get job details
     */
    protectedRoutes.get('/jobs/:type/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { type, id } = request.params as { type: 'screenshot' | 'pdf'; id: string };

      if (type !== 'screenshot' && type !== 'pdf') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Type must be "screenshot" or "pdf"',
        });
      }

      const job = await adminJobsService.getJob(id, type);

      if (!job) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Job not found',
        });
      }

      return job;
    });

    /**
     * Cancel job
     */
    protectedRoutes.post(
      '/jobs/:type/:id/cancel',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { type, id } = request.params as { type: 'screenshot' | 'pdf'; id: string };

        if (type !== 'screenshot' && type !== 'pdf') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Type must be "screenshot" or "pdf"',
          });
        }

        await adminJobsService.cancelJob(id, type, request.admin!.adminId);
        return { success: true };
      }
    );

    /**
     * Retry job
     */
    protectedRoutes.post(
      '/jobs/:type/:id/retry',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN) },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { type, id } = request.params as { type: 'screenshot' | 'pdf'; id: string };

        if (type !== 'screenshot' && type !== 'pdf') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Type must be "screenshot" or "pdf"',
          });
        }

        try {
          const jobId = await adminJobsService.retryJob(id, type, request.admin!.adminId);
          return { success: true, jobId };
        } catch (error) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: error instanceof Error ? error.message : 'Failed to retry job',
          });
        }
      }
    );

    /**
     * Delete job
     */
    protectedRoutes.delete(
      '/jobs/:type/:id',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN) },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { type, id } = request.params as { type: 'screenshot' | 'pdf'; id: string };

        if (type !== 'screenshot' && type !== 'pdf') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Type must be "screenshot" or "pdf"',
          });
        }

        await adminJobsService.deleteJob(id, type, request.admin!.adminId);
        return { success: true };
      }
    );

    /**
     * Get job statistics
     */
    protectedRoutes.get('/jobs/stats/overview', async () => {
      return await adminJobsService.getJobStats();
    });

    /**
     * Clean old jobs
     */
    protectedRoutes.post(
      '/jobs/clean',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN) },
      async (request: FastifyRequest) => {
        const { days = 30 } = request.body as { days?: number };
        const result = await adminJobsService.cleanOldJobs(days, request.admin!.adminId);
        return result;
      }
    );

    // ============================================
    // AUDIT LOGS
    // ============================================

    /**
     * List audit logs
     */
    protectedRoutes.get('/logs/audit', async (request: FastifyRequest) => {
      const query = request.query as any;
      return await adminLogsService.listAuditLogs({
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 50,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc',
        adminId: query.adminId,
        accountId: query.accountId,
        action: query.action,
        targetType: query.targetType,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });
    });

    /**
     * Get audit log details
     */
    protectedRoutes.get('/logs/audit/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const log = await adminLogsService.getAuditLog(id);

      if (!log) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Audit log not found',
        });
      }

      return log;
    });

    /**
     * Get logs for user
     */
    protectedRoutes.get('/logs/user/:accountId', async (request: FastifyRequest) => {
      const { accountId } = request.params as { accountId: string };
      const { limit = 50 } = request.query as { limit?: number };
      return await adminLogsService.getLogsForUser(accountId, Number(limit));
    });

    /**
     * Get action types
     */
    protectedRoutes.get('/logs/actions', async () => {
      return await adminLogsService.getActionTypes();
    });

    /**
     * Get target types
     */
    protectedRoutes.get('/logs/targets', async () => {
      return await adminLogsService.getTargetTypes();
    });

    /**
     * Get log statistics
     */
    protectedRoutes.get('/logs/stats', async (request: FastifyRequest) => {
      const { hours = 24 } = request.query as { hours?: number };
      return await adminLogsService.getLogStats(Number(hours));
    });

    /**
     * Export logs
     */
    protectedRoutes.get(
      '/logs/export',
      { preHandler: requireRole(AdminRole.SUPER_ADMIN) },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { startDate, endDate, limit = 10000 } = request.query as {
          startDate: string;
          endDate: string;
          limit?: number;
        };

        if (!startDate || !endDate) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'startDate and endDate are required',
          });
        }

        const logs = await adminLogsService.exportLogs(
          new Date(startDate),
          new Date(endDate),
          Number(limit)
        );

        reply.header('Content-Type', 'application/json');
        reply.header('Content-Disposition', `attachment; filename="audit-logs-${startDate}-${endDate}.json"`);

        return logs;
      }
    );
  });
}
