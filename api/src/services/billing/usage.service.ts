// Usage Service - Credit Tracking and Quota Management

import { PrismaClient, EventType, Tier } from '@prisma/client';
import { CREDIT_COSTS, TIER_CONFIG } from '../../types/auth.types.js';
import type { UsageEvent, UsageStats } from '../../types/auth.types.js';

const prisma = new PrismaClient();

export class UsageService {
  /**
   * Record a usage event and deduct credits
   */
  async recordUsage(event: UsageEvent): Promise<void> {
    const { accountId, eventType, credits, metadata } = event;

    // Create usage event and update account credits in a transaction
    await prisma.$transaction(async (tx) => {
      // Create usage event
      await tx.usageEvent.create({
        data: {
          accountId,
          eventType,
          credits,
          metadata: metadata ?? {},
        },
      });

      // Update account credits
      await tx.account.update({
        where: { id: accountId },
        data: {
          usedCredits: {
            increment: credits,
          },
        },
      });
    });
  }

  /**
   * Get usage statistics for an account
   */
  async getUsage(accountId: string): Promise<UsageStats> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        tier: true,
        monthlyCredits: true,
        usedCredits: true,
        lastResetAt: true,
      },
    });

    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    const tierConfig = TIER_CONFIG[account.tier];
    const remainingCredits = account.monthlyCredits - account.usedCredits;

    // Calculate current billing period
    const currentPeriodStart = new Date(account.lastResetAt);
    const currentPeriodEnd = new Date(currentPeriodStart);
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

    return {
      accountId: account.id,
      tier: account.tier,
      monthlyCredits: account.monthlyCredits,
      usedCredits: account.usedCredits,
      remainingCredits: Math.max(0, remainingCredits),
      currentPeriodStart,
      currentPeriodEnd,
    };
  }

  /**
   * Check if account has enough credits
   */
  async checkQuota(accountId: string, credits: number): Promise<boolean> {
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

    const remainingCredits = account.monthlyCredits - account.usedCredits;
    return remainingCredits >= credits;
  }

  /**
   * Get credit cost for an event type
   */
  getCreditCost(eventType: EventType, options?: { fullPage?: boolean; useTemplate?: boolean }): number {
    let cost = CREDIT_COSTS[eventType];

    // Adjust cost based on options
    if (options?.fullPage && eventType === EventType.SCREENSHOT) {
      return CREDIT_COSTS.SCREENSHOT_FULLPAGE;
    }

    if (options?.useTemplate && eventType === EventType.PDF) {
      return CREDIT_COSTS.PDF_WITH_TEMPLATE;
    }

    return cost;
  }

  /**
   * Reset monthly credits (called by cron job)
   */
  async resetMonthlyCredits(): Promise<void> {
    await prisma.account.updateMany({
      data: {
        usedCredits: 0,
        lastResetAt: new Date(),
      },
    });
  }

  /**
   * Get usage breakdown by event type for an account
   */
  async getUsageBreakdown(accountId: string, startDate?: Date, endDate?: Date) {
    const where: any = { accountId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const events = await prisma.usageEvent.groupBy({
      by: ['eventType'],
      where,
      _sum: {
        credits: true,
      },
      _count: {
        id: true,
      },
    });

    return events.map((event) => ({
      eventType: event.eventType,
      totalCredits: event._sum.credits ?? 0,
      count: event._count.id,
    }));
  }

  /**
   * Get recent usage events
   */
  async getRecentEvents(accountId: string, limit: number = 50) {
    return prisma.usageEvent.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        eventType: true,
        credits: true,
        metadata: true,
        createdAt: true,
      },
    });
  }

  /**
   * Estimate cost before execution
   */
  estimateCost(params: {
    eventType: EventType;
    fullPage?: boolean;
    useTemplate?: boolean;
    quantity?: number;
  }): { credits: number; cost: string } {
    const { eventType, fullPage, useTemplate, quantity = 1 } = params;

    const unitCost = this.getCreditCost(eventType, { fullPage, useTemplate });
    const totalCredits = unitCost * quantity;

    // Assuming 1 credit = $0.001 (adjust based on pricing)
    const cost = (totalCredits * 0.001).toFixed(4);

    return {
      credits: totalCredits,
      cost: `$${cost}`,
    };
  }
}
