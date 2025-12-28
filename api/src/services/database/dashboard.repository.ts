// Dashboard Repository - Database Operations for Dashboard

import { prisma } from '../../lib/db.js';
import type { EventType, Tier } from '@prisma/client';
import type {
  DashboardOverview,
  ActivityItem,
  UsageStats,
  UsageBreakdown,
  UsageTimelineItem,
  UsagePeriod,
  WebhookListItem,
} from '../../types/dashboard.types.js';
import crypto from 'node:crypto';
import { encryptWebhookSecret, decryptWebhookSecret } from '../crypto/encryption.service.js';

export class DashboardRepository {
  /**
   * Get complete dashboard overview for an account
   */
  async getAccountOverview(accountId: string): Promise<DashboardOverview | null> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!account) {
      return null;
    }

    // Get current month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get usage stats for current month
    const usageStats = await this.getMonthlyUsage(accountId, startOfMonth, endOfMonth);

    // Get recent activity
    const recentActivity = await this.getRecentActivity(accountId, 10);

    // Calculate quota percentage
    const percentage = account.monthlyCredits > 0
      ? Math.round((account.usedCredits / account.monthlyCredits) * 100)
      : 0;

    return {
      account: {
        id: account.id,
        email: account.email,
        tier: account.tier,
        createdAt: account.createdAt,
      },
      quota: {
        used: account.usedCredits,
        limit: account.monthlyCredits,
        percentage: Math.min(percentage, 100),
        resetDate: endOfMonth,
      },
      usage: {
        screenshots: usageStats.screenshotCount,
        pdfs: usageStats.pdfCount,
        totalCredits: usageStats.totalCredits,
      },
      recentActivity,
    };
  }

  /**
   * Get monthly usage statistics
   */
  private async getMonthlyUsage(
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ screenshotCount: number; pdfCount: number; totalCredits: number }> {
    const events = await prisma.usageEvent.findMany({
      where: {
        accountId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        eventType: true,
        credits: true,
      },
    });

    let screenshotCount = 0;
    let pdfCount = 0;
    let totalCredits = 0;

    for (const event of events) {
      totalCredits += event.credits;
      if (event.eventType.startsWith('SCREENSHOT')) {
        screenshotCount++;
      } else if (event.eventType.startsWith('PDF')) {
        pdfCount++;
      }
    }

    return { screenshotCount, pdfCount, totalCredits };
  }

  /**
   * Get recent account activity
   */
  async getRecentActivity(accountId: string, limit: number = 10): Promise<ActivityItem[]> {
    const activities: ActivityItem[] = [];

    // Get recent screenshots
    const screenshots = await prisma.screenshot.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        url: true,
        status: true,
        createdAt: true,
      },
    });

    for (const screenshot of screenshots) {
      activities.push({
        id: screenshot.id,
        type: 'screenshot',
        description: `Screenshot of ${this.truncateUrl(screenshot.url)} (${screenshot.status})`,
        createdAt: screenshot.createdAt,
        metadata: { url: screenshot.url, status: screenshot.status },
      });
    }

    // Get recent PDFs
    const pdfs = await prisma.pdf.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        url: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });

    for (const pdf of pdfs) {
      const source = pdf.url ? this.truncateUrl(pdf.url) : 'HTML content';
      activities.push({
        id: pdf.id,
        type: 'pdf',
        description: `PDF from ${source} (${pdf.status})`,
        createdAt: pdf.createdAt,
        metadata: { url: pdf.url, type: pdf.type, status: pdf.status },
      });
    }

    // Sort by date and take the most recent
    return activities
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get usage statistics with breakdown
   */
  async getUsageStats(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStats> {
    const where = {
      accountId,
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const events = await prisma.usageEvent.findMany({
      where,
      select: {
        eventType: true,
        credits: true,
        createdAt: true,
      },
    });

    // Calculate totals
    let totalRequests = events.length;
    let totalCredits = 0;
    let screenshotCount = 0;
    let pdfCount = 0;

    const byType: Record<string, { count: number; credits: number }> = {};

    for (const event of events) {
      totalCredits += event.credits;

      if (!byType[event.eventType]) {
        byType[event.eventType] = { count: 0, credits: 0 };
      }
      byType[event.eventType].count++;
      byType[event.eventType].credits += event.credits;

      if (event.eventType.startsWith('SCREENSHOT')) {
        screenshotCount++;
      } else if (event.eventType.startsWith('PDF')) {
        pdfCount++;
      }
    }

    // Build breakdown
    const breakdown: UsageBreakdown[] = Object.entries(byType).map(([eventType, data]) => ({
      eventType: eventType as EventType,
      count: data.count,
      credits: data.credits,
      percentage: totalCredits > 0 ? Math.round((data.credits / totalCredits) * 100) : 0,
    }));

    // Calculate days in range
    const daysDiff = startDate && endDate
      ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 30;

    return {
      totalRequests,
      totalCredits,
      screenshotCount,
      pdfCount,
      averageCreditsPerDay: Math.round(totalCredits / daysDiff),
      breakdown,
    };
  }

  /**
   * Get usage timeline for charts
   */
  async getUsageTimeline(
    accountId: string,
    period: UsagePeriod
  ): Promise<UsageTimelineItem[]> {
    const now = new Date();
    let startDate: Date;
    let groupFormat: string;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        groupFormat = 'hour';
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupFormat = 'day';
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupFormat = 'day';
        break;
    }

    const events = await prisma.usageEvent.findMany({
      where: {
        accountId,
        createdAt: {
          gte: startDate,
          lte: now,
        },
      },
      select: {
        eventType: true,
        credits: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by date
    const grouped: Record<string, UsageTimelineItem> = {};

    for (const event of events) {
      const dateKey = this.formatDateKey(event.createdAt, groupFormat);

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          screenshots: 0,
          pdfs: 0,
          credits: 0,
        };
      }

      grouped[dateKey].credits += event.credits;

      if (event.eventType.startsWith('SCREENSHOT')) {
        grouped[dateKey].screenshots++;
      } else if (event.eventType.startsWith('PDF')) {
        grouped[dateKey].pdfs++;
      }
    }

    // Fill in missing dates
    const timeline = this.fillMissingDates(grouped, startDate, now, groupFormat);

    return timeline;
  }

  /**
   * Get API key statistics
   */
  async getApiKeyStats(accountId: string): Promise<{
    total: number;
    active: number;
    revoked: number;
    recentlyUsed: number;
  }> {
    const keys = await prisma.apiKey.findMany({
      where: { accountId },
      select: {
        isActive: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      total: keys.length,
      active: keys.filter((k) => k.isActive).length,
      revoked: keys.filter((k) => !k.isActive).length,
      recentlyUsed: keys.filter((k) => k.lastUsedAt && k.lastUsedAt > weekAgo).length,
    };
  }

  /**
   * Get webhooks for account
   */
  async getWebhooks(accountId: string): Promise<WebhookListItem[]> {
    const webhooks = await prisma.webhook.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        lastTriggeredAt: true,
        failCount: true,
        createdAt: true,
      },
    });

    return webhooks;
  }

  /**
   * Create a new webhook
   * H-10: Webhook secrets are encrypted before storage
   */
  async createWebhook(
    accountId: string,
    url: string,
    events: string[]
  ): Promise<{ id: string; secret: string; createdAt: Date }> {
    const plaintextSecret = this.generateWebhookSecret();
    // H-10: Encrypt the secret before storing in database
    const encryptedSecret = encryptWebhookSecret(plaintextSecret);

    const webhook = await prisma.webhook.create({
      data: {
        accountId,
        url,
        events,
        secret: encryptedSecret,
        isActive: true,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    // Return the plaintext secret to the user (shown only once)
    return {
      id: webhook.id,
      secret: plaintextSecret,
      createdAt: webhook.createdAt,
    };
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(accountId: string, webhookId: string): Promise<boolean> {
    const result = await prisma.webhook.deleteMany({
      where: {
        id: webhookId,
        accountId,
      },
    });

    return result.count > 0;
  }

  /**
   * Get account settings
   */
  async getAccountSettings(accountId: string): Promise<{
    id: string;
    email: string;
    tier: Tier;
    createdAt: Date;
  } | null> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        email: true,
        tier: true,
        createdAt: true,
      },
    });

    return account;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private truncateUrl(url: string, maxLength: number = 50): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }

  private formatDateKey(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');

    if (format === 'hour') {
      return `${year}-${month}-${day}T${hour}:00`;
    }
    return `${year}-${month}-${day}`;
  }

  private fillMissingDates(
    grouped: Record<string, UsageTimelineItem>,
    startDate: Date,
    endDate: Date,
    format: string
  ): UsageTimelineItem[] {
    const result: UsageTimelineItem[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateKey = this.formatDateKey(current, format);

      result.push(
        grouped[dateKey] || {
          date: dateKey,
          screenshots: 0,
          pdfs: 0,
          credits: 0,
        }
      );

      if (format === 'hour') {
        current.setHours(current.getHours() + 1);
      } else {
        current.setDate(current.getDate() + 1);
      }
    }

    return result;
  }

  private generateWebhookSecret(): string {
    return `whsec_${crypto.randomBytes(24).toString('hex')}`;
  }
}

// Export singleton instance
export const dashboardRepository = new DashboardRepository();
