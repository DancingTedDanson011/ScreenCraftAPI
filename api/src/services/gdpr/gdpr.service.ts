/**
 * GDPR Service
 * M-15: Data export and deletion for GDPR compliance
 *
 * Provides:
 * - User data export (right to data portability)
 * - Account deletion (right to erasure)
 */

import { prisma } from '../../lib/db.js';
import { securityLogger, SecurityEventType, SecuritySeverity } from '../security/security-logger.service.js';

export interface UserDataExport {
  exportedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    createdAt: string;
    lastLoginAt: string | null;
  };
  account: {
    id: string;
    email: string;
    tier: string;
    monthlyCredits: number;
    usedCredits: number;
    stripeCustomerId: string | null;
    createdAt: string;
  } | null;
  screenshots: Array<{
    id: string;
    url: string;
    format: string;
    width: number;
    height: number;
    status: string;
    createdAt: string;
    imageUrl: string | null;
  }>;
  pdfs: Array<{
    id: string;
    url: string;
    format: string;
    status: string;
    createdAt: string;
    pdfUrl: string | null;
  }>;
  apiKeys: Array<{
    id: string;
    name: string | null;
    createdAt: string;
    lastUsedAt: string | null;
    isActive: boolean;
  }>;
  webhooks: Array<{
    id: string;
    url: string;
    events: string[];
    isActive: boolean;
    createdAt: string;
  }>;
  sessions: Array<{
    id: string;
    userAgent: string | null;
    createdAt: string;
    expires: string;
  }>;
  feedback: Array<{
    id: string;
    rating: number;
    category: string;
    message: string | null;
    createdAt: string;
  }>;
}

export interface DeletionResult {
  success: boolean;
  deletedResources: {
    user: boolean;
    account: boolean;
    screenshots: number;
    pdfs: number;
    apiKeys: number;
    webhooks: number;
    sessions: number;
    feedback: number;
    oauthAccounts: number;
  };
}

class GdprService {
  /**
   * Export all user data for GDPR data portability
   * M-15: Right to data portability (Article 20)
   */
  async exportUserData(userId: string): Promise<UserDataExport> {
    // Fetch user with all related data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        account: true,
        sessions: {
          select: {
            id: true,
            userAgent: true,
            createdAt: true,
            expires: true,
          },
        },
        oAuthAccount: {
          select: {
            id: true,
            provider: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Fetch account-related data
    let screenshots: any[] = [];
    let pdfs: any[] = [];
    let apiKeys: any[] = [];
    let webhooks: any[] = [];
    let feedback: any[] = [];

    if (user.accountId) {
      [screenshots, pdfs, apiKeys, webhooks, feedback] = await Promise.all([
        prisma.screenshot.findMany({
          where: { accountId: user.accountId },
          select: {
            id: true,
            url: true,
            format: true,
            width: true,
            height: true,
            status: true,
            createdAt: true,
            imageUrl: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.pDF.findMany({
          where: { accountId: user.accountId },
          select: {
            id: true,
            url: true,
            format: true,
            status: true,
            createdAt: true,
            pdfUrl: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.apiKey.findMany({
          where: { accountId: user.accountId },
          select: {
            id: true,
            name: true,
            createdAt: true,
            lastUsedAt: true,
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.webhook.findMany({
          where: { accountId: user.accountId },
          select: {
            id: true,
            url: true,
            events: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.feedback.findMany({
          where: { accountId: user.accountId },
          select: {
            id: true,
            rating: true,
            category: true,
            message: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
    }

    // Log export request
    await securityLogger.log(
      SecurityEventType.ACCOUNT_CREATED, // Using closest event type
      SecuritySeverity.INFO,
      `GDPR data export requested for user ${userId}`,
      { userId, accountId: user.accountId || undefined }
    );

    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
      },
      account: user.account ? {
        id: user.account.id,
        email: user.account.email,
        tier: user.account.tier,
        monthlyCredits: user.account.monthlyCredits,
        usedCredits: user.account.usedCredits,
        stripeCustomerId: user.account.stripeCustomerId,
        createdAt: user.account.createdAt.toISOString(),
      } : null,
      screenshots: screenshots.map(s => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      })),
      pdfs: pdfs.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
      apiKeys: apiKeys.map(k => ({
        ...k,
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() || null,
      })),
      webhooks: webhooks.map(w => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
      })),
      sessions: user.sessions.map(s => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        expires: s.expires.toISOString(),
      })),
      feedback: feedback.map(f => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Delete all user data for GDPR right to erasure
   * M-15: Right to erasure (Article 17)
   */
  async deleteUserAccount(userId: string): Promise<DeletionResult> {
    // First verify user exists and get account info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { account: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const result: DeletionResult = {
      success: false,
      deletedResources: {
        user: false,
        account: false,
        screenshots: 0,
        pdfs: 0,
        apiKeys: 0,
        webhooks: 0,
        sessions: 0,
        feedback: 0,
        oauthAccounts: 0,
      },
    };

    try {
      // Use a transaction for atomic deletion
      await prisma.$transaction(async (tx) => {
        // Delete sessions first
        const sessionsDeleted = await tx.session.deleteMany({
          where: { userId },
        });
        result.deletedResources.sessions = sessionsDeleted.count;

        // Delete OAuth accounts
        const oauthDeleted = await tx.oAuthAccount.deleteMany({
          where: { userId },
        });
        result.deletedResources.oauthAccounts = oauthDeleted.count;

        // If user has an account, delete account-related data
        if (user.accountId) {
          // Delete screenshots
          const screenshotsDeleted = await tx.screenshot.deleteMany({
            where: { accountId: user.accountId },
          });
          result.deletedResources.screenshots = screenshotsDeleted.count;

          // Delete PDFs
          const pdfsDeleted = await tx.pDF.deleteMany({
            where: { accountId: user.accountId },
          });
          result.deletedResources.pdfs = pdfsDeleted.count;

          // Delete API keys
          const apiKeysDeleted = await tx.apiKey.deleteMany({
            where: { accountId: user.accountId },
          });
          result.deletedResources.apiKeys = apiKeysDeleted.count;

          // Delete webhooks
          const webhooksDeleted = await tx.webhook.deleteMany({
            where: { accountId: user.accountId },
          });
          result.deletedResources.webhooks = webhooksDeleted.count;

          // Delete feedback
          const feedbackDeleted = await tx.feedback.deleteMany({
            where: { accountId: user.accountId },
          });
          result.deletedResources.feedback = feedbackDeleted.count;

          // Delete usage records (if any)
          await tx.usageRecord.deleteMany({
            where: { accountId: user.accountId },
          }).catch(() => {}); // Ignore if table doesn't exist
        }

        // Delete the user
        await tx.user.delete({
          where: { id: userId },
        });
        result.deletedResources.user = true;

        // Delete the account if it exists
        if (user.accountId) {
          await tx.account.delete({
            where: { id: user.accountId },
          });
          result.deletedResources.account = true;
        }
      });

      result.success = true;

      // Log account deletion
      await securityLogger.log(
        SecurityEventType.ACCOUNT_DELETED,
        SecuritySeverity.INFO,
        `GDPR account deletion completed for user ${userId}`,
        {
          userId,
          accountId: user.accountId || undefined,
          additionalInfo: result.deletedResources,
        }
      );

      return result;
    } catch (error) {
      // Log failed deletion attempt
      await securityLogger.log(
        SecurityEventType.ACCOUNT_DELETED,
        SecuritySeverity.HIGH,
        `GDPR account deletion failed for user ${userId}`,
        {
          userId,
          accountId: user.accountId || undefined,
          additionalInfo: { error: String(error) },
        }
      );

      throw error;
    }
  }
}

export const gdprService = new GdprService();
