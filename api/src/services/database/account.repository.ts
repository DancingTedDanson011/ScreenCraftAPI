import { prisma } from '../../lib/db';
import type { Account, ApiKey, EventType, Tier } from '@prisma/client';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  monthlyLimit: number;
  used: number;
}

export interface UsageEventData {
  accountId: string;
  eventType: EventType;
  credits: number;
  metadata?: Record<string, unknown>;
}

export interface CreateAccountData {
  email: string;
  tier?: Tier;
  monthlyCredits: number;
}

export class AccountRepository {
  /**
   * Find account by API key hash
   */
  async findByApiKey(hashedKey: string): Promise<Account | null> {
    const apiKey = await prisma.apiKey.findUnique({
      where: {
        key: hashedKey,
        isActive: true,
      },
      include: {
        account: true,
      },
    });

    if (!apiKey) {
      return null;
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return apiKey.account;
  }

  /**
   * Find account by ID
   */
  async findById(id: string): Promise<Account | null> {
    return prisma.account.findUnique({
      where: { id },
    });
  }

  /**
   * Find account by email
   */
  async findByEmail(email: string): Promise<Account | null> {
    return prisma.account.findUnique({
      where: { email },
    });
  }

  /**
   * Create a new account
   */
  async create(data: CreateAccountData): Promise<Account> {
    return prisma.account.create({
      data: {
        email: data.email,
        tier: data.tier ?? 'FREE',
        monthlyCredits: data.monthlyCredits,
        usedCredits: 0,
        lastResetAt: new Date(),
      },
    });
  }

  /**
   * Check if account has sufficient quota for an operation
   */
  async checkQuota(accountId: string, requiredCredits: number = 1): Promise<QuotaCheckResult> {
    const account = await this.findById(accountId);

    if (!account) {
      return {
        allowed: false,
        remaining: 0,
        monthlyLimit: 0,
        used: 0,
      };
    }

    // Check if we need to reset monthly quota
    const now = new Date();
    const lastReset = new Date(account.lastResetAt);
    const shouldReset = now.getMonth() !== lastReset.getMonth() ||
                       now.getFullYear() !== lastReset.getFullYear();

    let usedCredits = account.usedCredits;

    if (shouldReset) {
      // Reset quota for new month
      await prisma.account.update({
        where: { id: accountId },
        data: {
          usedCredits: 0,
          lastResetAt: now,
        },
      });
      usedCredits = 0;
    }

    const remaining = account.monthlyCredits - usedCredits;
    const allowed = remaining >= requiredCredits;

    return {
      allowed,
      remaining,
      monthlyLimit: account.monthlyCredits,
      used: usedCredits,
    };
  }

  /**
   * Increment usage credits for an account
   */
  async incrementUsage(accountId: string, credits: number): Promise<Account> {
    return prisma.account.update({
      where: { id: accountId },
      data: {
        usedCredits: {
          increment: credits,
        },
      },
    });
  }

  /**
   * Record a usage event
   */
  async recordUsageEvent(data: UsageEventData): Promise<void> {
    await prisma.$transaction([
      // Create usage event
      prisma.usageEvent.create({
        data: {
          accountId: data.accountId,
          eventType: data.eventType,
          credits: data.credits,
          metadata: data.metadata ?? {},
        },
      }),
      // Increment account usage
      prisma.account.update({
        where: { id: data.accountId },
        data: {
          usedCredits: {
            increment: data.credits,
          },
        },
      }),
    ]);
  }

  /**
   * Create API key for account
   */
  async createApiKey(
    accountId: string,
    hashedKey: string,
    prefix: string,
    name?: string
  ): Promise<ApiKey> {
    return prisma.apiKey.create({
      data: {
        accountId,
        key: hashedKey,
        prefix,
        name,
        isActive: true,
      },
    });
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(keyId: string): Promise<ApiKey> {
    return prisma.apiKey.update({
      where: { id: keyId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * List all API keys for an account
   */
  async listApiKeys(accountId: string, includeRevoked: boolean = false): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({
      where: {
        accountId,
        ...(includeRevoked ? {} : { isActive: true }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update account tier
   */
  async updateTier(accountId: string, tier: Tier, monthlyCredits: number): Promise<Account> {
    return prisma.account.update({
      where: { id: accountId },
      data: {
        tier,
        monthlyCredits,
      },
    });
  }

  /**
   * Get account usage statistics
   */
  async getUsageStats(accountId: string, startDate?: Date, endDate?: Date): Promise<{
    totalEvents: number;
    totalCredits: number;
    eventsByType: Record<string, number>;
  }> {
    const where = {
      accountId,
      ...(startDate || endDate ? {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      } : {}),
    };

    const events = await prisma.usageEvent.findMany({
      where,
      select: {
        eventType: true,
        credits: true,
      },
    });

    const totalEvents = events.length;
    const totalCredits = events.reduce((sum, e) => sum + e.credits, 0);

    const eventsByType = events.reduce((acc, e) => {
      acc[e.eventType] = (acc[e.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvents,
      totalCredits,
      eventsByType,
    };
  }

  /**
   * Reset monthly quotas (cron job)
   */
  async resetMonthlyQuotas(): Promise<number> {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const result = await prisma.account.updateMany({
      where: {
        lastResetAt: {
          lt: lastMonth,
        },
      },
      data: {
        usedCredits: 0,
        lastResetAt: now,
      },
    });

    return result.count;
  }
}

// Export singleton instance
export const accountRepository = new AccountRepository();
