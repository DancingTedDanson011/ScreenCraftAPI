// RapidAPI Service - Account Management for RapidAPI Users

import { PrismaClient, Tier, EventType, Account } from '@prisma/client';
import { Redis } from 'ioredis';
import { mapSubscriptionToTier } from '../../config/rapidapi.config.js';
import { TIER_CONFIG, CREDIT_COSTS } from '../../types/auth.types.js';

const prisma = new PrismaClient();

export class RapidApiService {
  private redis: Redis;
  private readonly CACHE_TTL = 3600; // 1 hour cache
  private readonly ACCOUNT_PREFIX = 'rapidapi:account:';

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Get or create account for RapidAPI user
   * Creates account with email format: {username}@rapidapi.internal
   */
  async getOrCreateAccount(
    rapidApiUser: string,
    subscription?: string
  ): Promise<Account> {
    const email = this.generateRapidApiEmail(rapidApiUser);

    // Check cache first
    const cached = await this.getCachedAccount(rapidApiUser);
    if (cached) {
      // Update tier if subscription changed
      const currentTier = mapSubscriptionToTier(subscription);
      if (cached.tier !== currentTier) {
        return this.updateAccountTier(cached.id, currentTier);
      }
      return cached;
    }

    // Check if account exists
    let account = await prisma.account.findUnique({
      where: { email },
    });

    const tier = mapSubscriptionToTier(subscription);
    const monthlyCredits = TIER_CONFIG[tier].credits;

    if (account) {
      // Update tier if changed
      if (account.tier !== tier) {
        account = await this.updateAccountTier(account.id, tier);
      }
    } else {
      // Create new account
      account = await prisma.account.create({
        data: {
          email,
          tier,
          monthlyCredits,
          usedCredits: 0,
          lastResetAt: new Date(),
        },
      });
    }

    // Cache the account
    await this.cacheAccount(rapidApiUser, account);

    return account;
  }

  /**
   * Update account tier and monthly credits
   */
  async updateAccountTier(accountId: string, newTier: Tier): Promise<Account> {
    const monthlyCredits = TIER_CONFIG[newTier].credits;

    const account = await prisma.account.update({
      where: { id: accountId },
      data: {
        tier: newTier,
        monthlyCredits,
      },
    });

    // Invalidate cache
    const rapidApiUser = this.extractUsernameFromEmail(account.email);
    await this.invalidateCache(rapidApiUser);

    return account;
  }

  /**
   * Track usage event for RapidAPI account
   */
  async trackUsage(
    accountId: string,
    eventType: EventType,
    metadata?: Record<string, any>
  ): Promise<void> {
    const credits = CREDIT_COSTS[eventType];

    // Create usage event
    await prisma.usageEvent.create({
      data: {
        accountId,
        eventType,
        credits,
        metadata: metadata || {},
      },
    });

    // Update account credits
    await prisma.account.update({
      where: { id: accountId },
      data: {
        usedCredits: {
          increment: credits,
        },
      },
    });

    // Invalidate cache to reflect updated credits
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { email: true },
    });

    if (account) {
      const rapidApiUser = this.extractUsernameFromEmail(account.email);
      await this.invalidateCache(rapidApiUser);
    }
  }

  /**
   * Check if account has sufficient credits
   */
  async hasCredits(accountId: string, eventType: EventType): Promise<boolean> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        tier: true,
        monthlyCredits: true,
        usedCredits: true,
      },
    });

    if (!account) {
      return false;
    }

    // Enterprise tier has unlimited credits
    if (account.tier === Tier.ENTERPRISE) {
      return true;
    }

    const requiredCredits = CREDIT_COSTS[eventType];
    const remainingCredits = account.monthlyCredits - account.usedCredits;

    return remainingCredits >= requiredCredits;
  }

  /**
   * Get account usage stats
   */
  async getUsageStats(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        tier: true,
        monthlyCredits: true,
        usedCredits: true,
        lastResetAt: true,
      },
    });

    if (!account) {
      return null;
    }

    // Calculate current period (monthly reset)
    const currentPeriodStart = new Date(account.lastResetAt);
    const currentPeriodEnd = new Date(currentPeriodStart);
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

    // Check if we need to reset credits
    const now = new Date();
    if (now >= currentPeriodEnd) {
      await this.resetMonthlyCredits(accountId);
      return this.getUsageStats(accountId); // Recursive call to get updated stats
    }

    return {
      tier: account.tier,
      monthlyCredits: account.monthlyCredits,
      usedCredits: account.usedCredits,
      remainingCredits: account.monthlyCredits - account.usedCredits,
      currentPeriodStart,
      currentPeriodEnd,
    };
  }

  /**
   * Reset monthly credits (called automatically when period expires)
   */
  async resetMonthlyCredits(accountId: string): Promise<void> {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        usedCredits: 0,
        lastResetAt: new Date(),
      },
    });
  }

  // Helper methods

  /**
   * Generate email for RapidAPI user
   * Format: username@rapidapi.internal
   */
  private generateRapidApiEmail(username: string): string {
    return `${username}@rapidapi.internal`;
  }

  /**
   * Extract username from RapidAPI email
   */
  private extractUsernameFromEmail(email: string): string {
    return email.replace('@rapidapi.internal', '');
  }

  // Cache helpers

  private async getCachedAccount(rapidApiUser: string): Promise<Account | null> {
    try {
      const cached = await this.redis.get(`${this.ACCOUNT_PREFIX}${rapidApiUser}`);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error('Redis cache read error:', err);
      return null;
    }
  }

  private async cacheAccount(rapidApiUser: string, account: Account): Promise<void> {
    try {
      await this.redis.setex(
        `${this.ACCOUNT_PREFIX}${rapidApiUser}`,
        this.CACHE_TTL,
        JSON.stringify(account)
      );
    } catch (err) {
      console.error('Redis cache write error:', err);
    }
  }

  private async invalidateCache(rapidApiUser: string): Promise<void> {
    try {
      await this.redis.del(`${this.ACCOUNT_PREFIX}${rapidApiUser}`);
    } catch (err) {
      console.error('Redis cache delete error:', err);
    }
  }
}
