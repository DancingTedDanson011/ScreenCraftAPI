// Admin API Keys Service - API Key Management for Admin Panel

import { prisma } from '../../lib/db.js';
import type {
  AdminApiKeyListItem,
  PaginationParams,
  PaginatedResponse,
} from '../types/admin.types.js';

/**
 * Admin API Keys Service
 * Manages all API keys from the admin panel
 */
export class AdminApiKeysService {
  /**
   * List all API keys with pagination
   */
  async listApiKeys(
    params: PaginationParams & {
      search?: string;
      isActive?: boolean;
      accountId?: string;
    }
  ): Promise<PaginatedResponse<AdminApiKeyListItem>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', search, isActive, accountId } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { prefix: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { account: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (accountId) {
      where.accountId = accountId;
    }

    // Get total count
    const total = await prisma.apiKey.count({ where });

    // Get API keys with account info
    const apiKeys = await prisma.apiKey.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        account: {
          select: {
            email: true,
          },
        },
      },
    });

    // Transform to response format
    const data: AdminApiKeyListItem[] = apiKeys.map((key) => ({
      id: key.id,
      prefix: key.prefix,
      name: key.name,
      accountId: key.accountId,
      accountEmail: key.account.email,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt,
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
   * Get API key details
   */
  async getApiKey(keyId: string): Promise<{
    key: AdminApiKeyListItem;
    usageStats: {
      last24h: number;
      last7d: number;
      last30d: number;
    };
  } | null> {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: {
        account: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!apiKey) {
      return null;
    }

    // Get usage stats from usage events
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Count usage events (simplified - would need apiKeyId in UsageEvent for accurate tracking)
    const [last24h, last7d, last30d] = await Promise.all([
      prisma.usageEvent.count({
        where: {
          accountId: apiKey.accountId,
          createdAt: { gte: oneDayAgo },
        },
      }),
      prisma.usageEvent.count({
        where: {
          accountId: apiKey.accountId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.usageEvent.count({
        where: {
          accountId: apiKey.accountId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    return {
      key: {
        id: apiKey.id,
        prefix: apiKey.prefix,
        name: apiKey.name,
        accountId: apiKey.accountId,
        accountEmail: apiKey.account.email,
        isActive: apiKey.isActive,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
        revokedAt: apiKey.revokedAt,
      },
      usageStats: {
        last24h,
        last7d,
        last30d,
      },
    };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string, adminId: string): Promise<void> {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      select: { accountId: true, prefix: true },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        accountId: apiKey.accountId,
        action: 'REVOKE_API_KEY',
        targetType: 'api_key',
        targetId: keyId,
        details: { prefix: apiKey.prefix },
      },
    });
  }

  /**
   * Reactivate a revoked API key
   */
  async reactivateApiKey(keyId: string, adminId: string): Promise<void> {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      select: { accountId: true, prefix: true },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        isActive: true,
        revokedAt: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        accountId: apiKey.accountId,
        action: 'REACTIVATE_API_KEY',
        targetType: 'api_key',
        targetId: keyId,
        details: { prefix: apiKey.prefix },
      },
    });
  }

  /**
   * Delete an API key permanently
   */
  async deleteApiKey(keyId: string, adminId: string): Promise<void> {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      select: { accountId: true, prefix: true },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    await prisma.apiKey.delete({
      where: { id: keyId },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        accountId: apiKey.accountId,
        action: 'DELETE_API_KEY',
        targetType: 'api_key',
        targetId: keyId,
        details: { prefix: apiKey.prefix },
      },
    });
  }

  /**
   * Get API key statistics
   */
  async getApiKeyStats(): Promise<{
    total: number;
    active: number;
    revoked: number;
    usedToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, active, revoked, usedToday] = await Promise.all([
      prisma.apiKey.count(),
      prisma.apiKey.count({ where: { isActive: true } }),
      prisma.apiKey.count({ where: { isActive: false } }),
      prisma.apiKey.count({
        where: {
          lastUsedAt: { gte: today },
        },
      }),
    ]);

    return { total, active, revoked, usedToday };
  }
}

export const adminApiKeysService = new AdminApiKeysService();
