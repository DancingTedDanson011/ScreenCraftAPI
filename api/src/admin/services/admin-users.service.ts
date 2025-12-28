// Admin Users Service - User Management for Admin Panel

import { prisma } from '../../lib/db.js';
import type {
  AdminUserListItem,
  PaginationParams,
  PaginatedResponse,
} from '../types/admin.types.js';
import { Tier } from '@prisma/client';
import { createSafeOrderBy, validatePagination } from '../utils/query-validator.js';

/**
 * Admin Users Service
 * Manages user accounts from the admin panel
 */
export class AdminUsersService {
  /**
   * List all users with pagination
   */
  async listUsers(
    params: PaginationParams & {
      search?: string;
      tier?: Tier;
    }
  ): Promise<PaginatedResponse<AdminUserListItem>> {
    const { sortBy, sortOrder, search, tier } = params;

    // M-03: Validate pagination and sort parameters
    const { page, limit, skip } = validatePagination(params.page, params.limit, 100);
    const orderBy = createSafeOrderBy('account', sortBy, sortOrder, 'createdAt');

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (tier) {
      where.tier = tier;
    }

    // Get total count
    const total = await prisma.account.count({ where });

    // Get accounts with related data
    // M-03: Using validated orderBy to prevent injection
    const accounts = await prisma.account.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        user: {
          select: {
            name: true,
            lastLoginAt: true,
          },
        },
        _count: {
          select: {
            apiKeys: true,
          },
        },
      },
    });

    // Transform to response format
    const data: AdminUserListItem[] = accounts.map((account) => ({
      id: account.id,
      email: account.email,
      name: account.user?.name || null,
      tier: account.tier,
      monthlyCredits: account.monthlyCredits,
      usedCredits: account.usedCredits,
      apiKeyCount: account._count.apiKeys,
      createdAt: account.createdAt,
      lastLoginAt: account.user?.lastLoginAt || null,
      isBanned: account.tier === 'FREE' && account.monthlyCredits === 0, // Simple ban check
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user details
   */
  async getUser(userId: string): Promise<{
    account: any;
    user: any;
    apiKeys: any[];
    recentActivity: any;
    stats: any;
  } | null> {
    const account = await prisma.account.findUnique({
      where: { id: userId },
      include: {
        user: true,
        apiKeys: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });

    if (!account) {
      return null;
    }

    // Get recent activity
    const [screenshotCount, pdfCount, recentScreenshots, recentPdfs] = await Promise.all([
      prisma.screenshot.count({ where: { accountId: userId } }),
      prisma.pdf.count({ where: { accountId: userId } }),
      prisma.screenshot.findMany({
        where: { accountId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          url: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.pdf.findMany({
        where: { accountId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          url: true,
          status: true,
          type: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      account: {
        id: account.id,
        email: account.email,
        tier: account.tier,
        monthlyCredits: account.monthlyCredits,
        usedCredits: account.usedCredits,
        stripeCustomerId: account.stripeCustomerId,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        lastResetAt: account.lastResetAt,
      },
      user: account.user
        ? {
            id: account.user.id,
            name: account.user.name,
            email: account.user.email,
            image: account.user.image,
            emailVerified: account.user.emailVerified,
            lastLoginAt: account.user.lastLoginAt,
            createdAt: account.user.createdAt,
          }
        : null,
      apiKeys: account.apiKeys.map((key) => ({
        id: key.id,
        prefix: key.prefix,
        name: key.name,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
      })),
      recentActivity: {
        screenshots: recentScreenshots,
        pdfs: recentPdfs,
      },
      stats: {
        totalScreenshots: screenshotCount,
        totalPdfs: pdfCount,
        apiKeyCount: account.apiKeys.length,
        hasActiveSubscription: account.subscriptions.length > 0,
      },
    };
  }

  /**
   * Update user tier
   */
  async updateUserTier(userId: string, tier: Tier, adminId: string): Promise<void> {
    // Get credit limits for tier
    const creditLimits: Record<Tier, number> = {
      FREE: 100,
      PRO: 5000,
      BUSINESS: 25000,
      ENTERPRISE: 100000,
    };

    await prisma.account.update({
      where: { id: userId },
      data: {
        tier,
        monthlyCredits: creditLimits[tier],
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        adminId,
        accountId: userId,
        action: 'UPDATE_USER_TIER',
        targetType: 'account',
        targetId: userId,
        details: { newTier: tier },
      },
    });
  }

  /**
   * Reset user credits
   */
  async resetUserCredits(userId: string, adminId: string): Promise<void> {
    await prisma.account.update({
      where: { id: userId },
      data: {
        usedCredits: 0,
        lastResetAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        accountId: userId,
        action: 'RESET_USER_CREDITS',
        targetType: 'account',
        targetId: userId,
      },
    });
  }

  /**
   * Add bonus credits to user
   */
  async addBonusCredits(userId: string, amount: number, adminId: string): Promise<void> {
    await prisma.account.update({
      where: { id: userId },
      data: {
        monthlyCredits: { increment: amount },
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        accountId: userId,
        action: 'ADD_BONUS_CREDITS',
        targetType: 'account',
        targetId: userId,
        details: { amount },
      },
    });
  }

  /**
   * Ban user (set credits to 0)
   */
  async banUser(userId: string, reason: string, adminId: string): Promise<void> {
    // Revoke all API keys
    await prisma.apiKey.updateMany({
      where: { accountId: userId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    // Set credits to 0
    await prisma.account.update({
      where: { id: userId },
      data: {
        monthlyCredits: 0,
        usedCredits: 0,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        accountId: userId,
        action: 'BAN_USER',
        targetType: 'account',
        targetId: userId,
        details: { reason },
      },
    });
  }

  /**
   * Unban user (restore tier credits)
   */
  async unbanUser(userId: string, adminId: string): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: userId },
      select: { tier: true },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const creditLimits: Record<Tier, number> = {
      FREE: 100,
      PRO: 5000,
      BUSINESS: 25000,
      ENTERPRISE: 100000,
    };

    await prisma.account.update({
      where: { id: userId },
      data: {
        monthlyCredits: creditLimits[account.tier],
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        accountId: userId,
        action: 'UNBAN_USER',
        targetType: 'account',
        targetId: userId,
      },
    });
  }

  /**
   * Delete user and all related data
   */
  async deleteUser(userId: string, adminId: string): Promise<void> {
    // This will cascade delete all related records due to prisma schema
    await prisma.account.delete({
      where: { id: userId },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'DELETE_USER',
        targetType: 'account',
        targetId: userId,
      },
    });
  }
}

export const adminUsersService = new AdminUsersService();
