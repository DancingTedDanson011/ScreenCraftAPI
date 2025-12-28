// API Key Service - Secure Key Generation and Validation

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import type { ApiKeyInfo, GeneratedApiKey } from '../../types/auth.types.js';
import { hashApiKeyWithPepper } from '../crypto/encryption.service.js';

const prisma = new PrismaClient();

export class ApiKeyService {
  private redis: Redis;
  private readonly CACHE_TTL = 3600; // 1 hour cache
  private readonly KEY_PREFIX = 'apikey:';

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Generate a cryptographically secure API key
   * Format: sk_{env}_{random32bytes}
   */
  generateApiKey(environment: 'test' | 'live' = 'live'): string {
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `sk_${environment}_${randomBytes}`;
  }

  /**
   * Hash API key using SHA256 with pepper
   * M-06: Peppered hash prevents rainbow table attacks even if DB is compromised
   */
  hashApiKey(key: string): string {
    return hashApiKeyWithPepper(key);
  }

  /**
   * Extract prefix for display (first 8 chars after sk_)
   * Example: sk_live_abc12345
   */
  extractPrefix(key: string): string {
    const parts = key.split('_');
    if (parts.length >= 3) {
      return `${parts[0]}_${parts[1]}_${parts[2].substring(0, 8)}`;
    }
    return key.substring(0, 16);
  }

  /**
   * Create a new API key for an account
   */
  async createApiKey(
    accountId: string,
    name?: string,
    environment: 'test' | 'live' = 'live'
  ): Promise<GeneratedApiKey> {
    const rawKey = this.generateApiKey(environment);
    const hashedKey = this.hashApiKey(rawKey);
    const prefix = this.extractPrefix(rawKey);

    const apiKey = await prisma.apiKey.create({
      data: {
        key: hashedKey,
        prefix,
        name,
        accountId,
      },
    });

    return {
      key: rawKey,
      prefix,
      keyId: apiKey.id,
      accountId,
    };
  }

  /**
   * Validate API key and return account info
   * Uses Redis cache to minimize DB lookups
   */
  async validateApiKey(rawKey: string): Promise<ApiKeyInfo | null> {
    const hashedKey = this.hashApiKey(rawKey);

    // Check cache first
    const cached = await this.getCachedKey(hashedKey);
    if (cached) {
      return cached;
    }

    // Lookup in database
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: hashedKey },
      include: {
        account: {
          select: {
            id: true,
            tier: true,
            monthlyCredits: true,
            usedCredits: true,
          },
        },
      },
    });

    if (!apiKey || !apiKey.isActive || !apiKey.account) {
      return null;
    }

    const keyInfo: ApiKeyInfo = {
      id: apiKey.id,
      accountId: apiKey.account.id,
      tier: apiKey.account.tier,
      monthlyCredits: apiKey.account.monthlyCredits,
      usedCredits: apiKey.account.usedCredits,
      isActive: apiKey.isActive,
    };

    // Cache the result
    await this.cacheKey(hashedKey, keyInfo);

    // Update last used timestamp (fire and forget)
    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => console.error('Failed to update lastUsedAt:', err));

    return keyInfo;
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string, accountId: string): Promise<boolean> {
    const result = await prisma.apiKey.updateMany({
      where: {
        id: keyId,
        accountId,
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    if (result.count > 0) {
      // Invalidate cache
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: keyId },
        select: { key: true },
      });
      if (apiKey) {
        await this.invalidateCache(apiKey.key);
      }
      return true;
    }

    return false;
  }

  /**
   * List all API keys for an account
   */
  async listApiKeys(accountId: string) {
    return prisma.apiKey.findMany({
      where: { accountId },
      select: {
        id: true,
        prefix: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Cache helpers
  private async getCachedKey(hashedKey: string): Promise<ApiKeyInfo | null> {
    try {
      const cached = await this.redis.get(`${this.KEY_PREFIX}${hashedKey}`);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error('Redis cache read error:', err);
      return null;
    }
  }

  private async cacheKey(hashedKey: string, keyInfo: ApiKeyInfo): Promise<void> {
    try {
      await this.redis.setex(
        `${this.KEY_PREFIX}${hashedKey}`,
        this.CACHE_TTL,
        JSON.stringify(keyInfo)
      );
    } catch (err) {
      console.error('Redis cache write error:', err);
    }
  }

  private async invalidateCache(hashedKey: string): Promise<void> {
    try {
      await this.redis.del(`${this.KEY_PREFIX}${hashedKey}`);
    } catch (err) {
      console.error('Redis cache delete error:', err);
    }
  }
}
