/**
 * GDPR Routes
 * M-15: Endpoints for GDPR compliance
 *
 * - GET /gdpr/export - Export all user data (right to data portability)
 * - DELETE /gdpr/delete-account - Delete account and all data (right to erasure)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sessionService } from '../services/auth/session.service.js';
import { gdprService } from '../services/gdpr/gdpr.service.js';
import { authConfig } from '../config/auth.config.js';

export async function gdprRoutes(fastify: FastifyInstance) {
  /**
   * Verify session and get user ID
   */
  async function getAuthenticatedUserId(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<string | null> {
    const sessionToken = request.cookies[authConfig.session.cookieName];

    if (!sessionToken) {
      reply.status(401).send({
        error: 'Not authenticated',
        code: 'NO_SESSION',
      });
      return null;
    }

    const session = await sessionService.validateSession(sessionToken);

    if (!session) {
      reply.clearCookie(authConfig.session.cookieName, { path: '/' });
      reply.status(401).send({
        error: 'Session expired',
        code: 'SESSION_EXPIRED',
      });
      return null;
    }

    return session.user.id;
  }

  /**
   * Export User Data
   * GET /gdpr/export
   *
   * Returns all user data in JSON format for GDPR data portability
   */
  fastify.get('/gdpr/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await getAuthenticatedUserId(request, reply);
    if (!userId) return;

    try {
      const exportData = await gdprService.exportUserData(userId);

      // Set headers for JSON download
      reply.header('Content-Type', 'application/json');
      reply.header(
        'Content-Disposition',
        `attachment; filename="user-data-export-${new Date().toISOString().split('T')[0]}.json"`
      );

      return exportData;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      fastify.log.error(error, 'GDPR export failed');

      return reply.status(500).send({
        error: message,
        code: 'EXPORT_FAILED',
      });
    }
  });

  /**
   * Delete Account
   * DELETE /gdpr/delete-account
   *
   * Permanently deletes user account and all associated data
   * Requires password confirmation for additional security
   */
  fastify.delete<{
    Body: { confirmPhrase: string };
  }>('/gdpr/delete-account', async (request, reply) => {
    const userId = await getAuthenticatedUserId(request, reply);
    if (!userId) return;

    const { confirmPhrase } = request.body || {};

    // Require explicit confirmation
    if (confirmPhrase !== 'DELETE MY ACCOUNT') {
      return reply.status(400).send({
        error: 'Please confirm deletion by typing "DELETE MY ACCOUNT"',
        code: 'CONFIRMATION_REQUIRED',
      });
    }

    try {
      const result = await gdprService.deleteUserAccount(userId);

      // Clear session cookie after deletion
      reply.clearCookie(authConfig.session.cookieName, { path: '/' });

      return {
        success: true,
        message: 'Your account and all associated data have been permanently deleted',
        deletedResources: result.deletedResources,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Deletion failed';
      fastify.log.error(error, 'GDPR account deletion failed');

      return reply.status(500).send({
        error: message,
        code: 'DELETION_FAILED',
      });
    }
  });

  /**
   * Get deletion preview
   * GET /gdpr/delete-preview
   *
   * Shows what data would be deleted without actually deleting
   */
  fastify.get('/gdpr/delete-preview', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await getAuthenticatedUserId(request, reply);
    if (!userId) return;

    try {
      // Get counts of data that would be deleted
      const exportData = await gdprService.exportUserData(userId);

      return {
        warning: 'This action is irreversible. The following data will be permanently deleted:',
        summary: {
          user: true,
          account: !!exportData.account,
          screenshots: exportData.screenshots.length,
          pdfs: exportData.pdfs.length,
          apiKeys: exportData.apiKeys.length,
          webhooks: exportData.webhooks.length,
          sessions: exportData.sessions.length,
          feedback: exportData.feedback.length,
        },
        confirmationRequired: 'To proceed, send a DELETE request with body: { "confirmPhrase": "DELETE MY ACCOUNT" }',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Preview failed';
      return reply.status(500).send({
        error: message,
        code: 'PREVIEW_FAILED',
      });
    }
  });
}
