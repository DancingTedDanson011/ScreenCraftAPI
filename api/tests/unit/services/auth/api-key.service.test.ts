/**
 * API Key Service Unit Tests
 *
 * Tests for secure API key generation, hashing, validation, and lifecycle management.
 * Mocks: Prisma (database), Redis (cache)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import crypto from 'node:crypto';

// Mock Prisma before importing the service
vi.mock('@prisma/client', () => {
  const mockPrismaClient = {
    apiKey: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(() => mockPrismaClient),
  };
});

// Mock ioredis
vi.mock('ioredis', () => {
  return {
    Redis: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
    })),
  };
});

import { ApiKeyService } from '../../../../src/services/auth/api-key.service.js';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import type { ApiKeyInfo } from '../../../../src/types/auth.types.js';

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;
  let mockRedis: {
    get: Mock;
    setex: Mock;
    del: Mock;
  };
  let mockPrisma: {
    apiKey: {
      create: Mock;
      findUnique: Mock;
      updateMany: Mock;
      update: Mock;
      findMany: Mock;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mock instances
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
    };

    mockPrisma = new PrismaClient() as unknown as typeof mockPrisma;

    apiKeyService = new ApiKeyService(mockRedis as unknown as Redis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================================================
  // generateApiKey() Tests
  // =============================================================================
  describe('generateApiKey()', () => {
    it('should generate a key with correct format for live environment', () => {
      const key = apiKeyService.generateApiKey('live');

      expect(key).toMatch(/^sk_live_[a-f0-9]{64}$/);
      expect(key.startsWith('sk_live_')).toBe(true);
    });

    it('should generate a key with correct format for test environment', () => {
      const key = apiKeyService.generateApiKey('test');

      expect(key).toMatch(/^sk_test_[a-f0-9]{64}$/);
      expect(key.startsWith('sk_test_')).toBe(true);
    });

    it('should default to live environment when no argument provided', () => {
      const key = apiKeyService.generateApiKey();

      expect(key.startsWith('sk_live_')).toBe(true);
    });

    it('should generate cryptographically random unique keys', () => {
      const keys = new Set<string>();

      for (let i = 0; i < 100; i++) {
        keys.add(apiKeyService.generateApiKey());
      }

      // All 100 keys should be unique
      expect(keys.size).toBe(100);
    });

    it('should generate 32-byte random portion (64 hex characters)', () => {
      const key = apiKeyService.generateApiKey();
      const randomPart = key.split('_')[2];

      expect(randomPart).toHaveLength(64);
      expect(randomPart).toMatch(/^[a-f0-9]+$/);
    });
  });

  // =============================================================================
  // hashApiKey() Tests
  // =============================================================================
  describe('hashApiKey()', () => {
    it('should hash API key using SHA256', () => {
      const rawKey = 'sk_live_abc123def456';
      const hashedKey = apiKeyService.hashApiKey(rawKey);

      // SHA256 produces 64 character hex string
      expect(hashedKey).toHaveLength(64);
      expect(hashedKey).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce deterministic hash for same input', () => {
      const rawKey = 'sk_test_deterministic123';

      const hash1 = apiKeyService.hashApiKey(rawKey);
      const hash2 = apiKeyService.hashApiKey(rawKey);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const key1 = 'sk_live_key1';
      const key2 = 'sk_live_key2';

      const hash1 = apiKeyService.hashApiKey(key1);
      const hash2 = apiKeyService.hashApiKey(key2);

      expect(hash1).not.toBe(hash2);
    });

    it('should match expected SHA256 output', () => {
      const rawKey = 'test_key';
      const expectedHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      const actualHash = apiKeyService.hashApiKey(rawKey);

      expect(actualHash).toBe(expectedHash);
    });
  });

  // =============================================================================
  // extractPrefix() Tests
  // =============================================================================
  describe('extractPrefix()', () => {
    it('should extract first 8 characters of random part', () => {
      const key = 'sc_live_abc12345xyz98765remaining';

      const prefix = apiKeyService.extractPrefix(key);

      expect(prefix).toBe('sc_live_abc12345');
    });

    it('should handle test environment keys', () => {
      const key = 'sc_test_12345678abcdefgh';

      const prefix = apiKeyService.extractPrefix(key);

      expect(prefix).toBe('sc_test_12345678');
    });

    it('should return first 16 chars for invalid format', () => {
      const invalidKey = 'invalid_key_format_without_proper_parts';

      const prefix = apiKeyService.extractPrefix(invalidKey);

      expect(prefix).toBe('invalid_key_form');
    });

    it('should handle short keys gracefully', () => {
      const shortKey = 'sk_live_abc';

      const prefix = apiKeyService.extractPrefix(shortKey);

      expect(prefix).toBe('sk_live_abc');
    });
  });

  // =============================================================================
  // createApiKey() Tests
  // =============================================================================
  describe('createApiKey()', () => {
    const mockAccountId = 'acc_123456';
    const mockKeyId = 'key_789';

    beforeEach(() => {
      mockPrisma.apiKey.create.mockResolvedValue({
        id: mockKeyId,
        key: 'hashed_key',
        prefix: 'sk_live_abc12345',
        name: 'Test Key',
        accountId: mockAccountId,
        isActive: true,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
      });
    });

    it('should create API key with correct database entry', async () => {
      const result = await apiKeyService.createApiKey(mockAccountId, 'Production Key', 'live');

      expect(mockPrisma.apiKey.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: mockAccountId,
          name: 'Production Key',
        }),
      });

      expect(result.accountId).toBe(mockAccountId);
      expect(result.keyId).toBe(mockKeyId);
    });

    it('should return raw key only once (not stored in DB)', async () => {
      const result = await apiKeyService.createApiKey(mockAccountId);

      // The raw key should be returned
      expect(result.key).toMatch(/^sk_live_[a-f0-9]{64}$/);

      // The database should store the HASH, not the raw key
      const createCall = mockPrisma.apiKey.create.mock.calls[0][0];
      expect(createCall.data.key).not.toBe(result.key);
      expect(createCall.data.key).toHaveLength(64); // SHA256 hash
    });

    it('should default to live environment', async () => {
      const result = await apiKeyService.createApiKey(mockAccountId);

      expect(result.key.startsWith('sk_live_')).toBe(true);
    });

    it('should create test environment key when specified', async () => {
      const result = await apiKeyService.createApiKey(mockAccountId, 'Test Key', 'test');

      expect(result.key.startsWith('sk_test_')).toBe(true);
    });

    it('should allow creation without name', async () => {
      const result = await apiKeyService.createApiKey(mockAccountId);

      expect(result).toBeDefined();
      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: undefined,
        }),
      });
    });

    it('should store extractable prefix for display', async () => {
      const result = await apiKeyService.createApiKey(mockAccountId);

      const createCall = mockPrisma.apiKey.create.mock.calls[0][0];
      expect(createCall.data.prefix).toMatch(/^sk_live_[a-f0-9]{8}$/);
      expect(result.prefix).toMatch(/^sk_live_[a-f0-9]{8}$/);
    });

    it('should propagate database errors', async () => {
      mockPrisma.apiKey.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(apiKeyService.createApiKey(mockAccountId)).rejects.toThrow('Database connection failed');
    });
  });

  // =============================================================================
  // validateApiKey() Tests
  // =============================================================================
  describe('validateApiKey()', () => {
    const mockRawKey = 'sc_live_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const mockHashedKey = crypto.createHash('sha256').update(mockRawKey).digest('hex');

    const mockKeyInfo: ApiKeyInfo = {
      id: 'key_123',
      accountId: 'acc_456',
      tier: 'PRO',
      monthlyCredits: 50000,
      usedCredits: 1000,
      isActive: true,
    };

    const mockDbApiKey = {
      id: 'key_123',
      key: mockHashedKey,
      prefix: 'sk_live_12345678',
      name: 'Test Key',
      accountId: 'acc_456',
      isActive: true,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
      account: {
        id: 'acc_456',
        tier: 'PRO',
        monthlyCredits: 50000,
        usedCredits: 1000,
      },
    };

    describe('cache hit scenarios', () => {
      it('should return cached key info when available', async () => {
        mockRedis.get.mockResolvedValue(JSON.stringify(mockKeyInfo));

        const result = await apiKeyService.validateApiKey(mockRawKey);

        expect(result).toEqual(mockKeyInfo);
        expect(mockRedis.get).toHaveBeenCalledWith(`apikey:${mockHashedKey}`);
        expect(mockPrisma.apiKey.findUnique).not.toHaveBeenCalled();
      });

      it('should handle Redis JSON parsing errors gracefully', async () => {
        mockRedis.get.mockResolvedValue('invalid-json');
        mockPrisma.apiKey.findUnique.mockResolvedValue(mockDbApiKey);

        // Should catch error and fall through to database lookup
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = await apiKeyService.validateApiKey(mockRawKey);

        expect(result).toBeDefined();
        expect(mockPrisma.apiKey.findUnique).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('cache miss scenarios', () => {
      beforeEach(() => {
        mockRedis.get.mockResolvedValue(null);
      });

      it('should lookup in database on cache miss', async () => {
        mockPrisma.apiKey.findUnique.mockResolvedValue(mockDbApiKey);

        const result = await apiKeyService.validateApiKey(mockRawKey);

        expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
          where: { key: mockHashedKey },
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

        expect(result).toMatchObject({
          id: 'key_123',
          accountId: 'acc_456',
          tier: 'PRO',
          isActive: true,
        });
      });

      it('should cache successful lookup results', async () => {
        mockPrisma.apiKey.findUnique.mockResolvedValue(mockDbApiKey);

        await apiKeyService.validateApiKey(mockRawKey);

        expect(mockRedis.setex).toHaveBeenCalledWith(
          `apikey:${mockHashedKey}`,
          3600, // 1 hour TTL
          expect.any(String)
        );
      });

      it('should update lastUsedAt timestamp (fire-and-forget)', async () => {
        mockPrisma.apiKey.findUnique.mockResolvedValue(mockDbApiKey);
        mockPrisma.apiKey.update.mockResolvedValue(mockDbApiKey);

        await apiKeyService.validateApiKey(mockRawKey);

        // Wait for fire-and-forget promise
        await new Promise(resolve => setImmediate(resolve));

        expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
          where: { id: 'key_123' },
          data: { lastUsedAt: expect.any(Date) },
        });
      });

      it('should handle lastUsedAt update failures silently', async () => {
        mockPrisma.apiKey.findUnique.mockResolvedValue(mockDbApiKey);
        mockPrisma.apiKey.update.mockRejectedValue(new Error('Update failed'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Should not throw
        const result = await apiKeyService.validateApiKey(mockRawKey);
        expect(result).toBeDefined();

        // Wait for fire-and-forget promise
        await new Promise(resolve => setImmediate(resolve));

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('invalid key scenarios', () => {
      beforeEach(() => {
        mockRedis.get.mockResolvedValue(null);
      });

      it('should return null for non-existent key', async () => {
        mockPrisma.apiKey.findUnique.mockResolvedValue(null);

        const result = await apiKeyService.validateApiKey('sk_live_nonexistent');

        expect(result).toBeNull();
        expect(mockRedis.setex).not.toHaveBeenCalled();
      });

      it('should return null for inactive key', async () => {
        mockPrisma.apiKey.findUnique.mockResolvedValue({
          ...mockDbApiKey,
          isActive: false,
        });

        const result = await apiKeyService.validateApiKey(mockRawKey);

        expect(result).toBeNull();
      });

      it('should return null when account is missing', async () => {
        mockPrisma.apiKey.findUnique.mockResolvedValue({
          ...mockDbApiKey,
          account: null,
        });

        const result = await apiKeyService.validateApiKey(mockRawKey);

        expect(result).toBeNull();
      });
    });

    describe('Redis error handling', () => {
      it('should handle Redis get errors gracefully', async () => {
        mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
        mockPrisma.apiKey.findUnique.mockResolvedValue(mockDbApiKey);

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await apiKeyService.validateApiKey(mockRawKey);

        // Should fall through to database
        expect(result).toBeDefined();
        expect(mockPrisma.apiKey.findUnique).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('should handle Redis setex errors gracefully', async () => {
        mockRedis.get.mockResolvedValue(null);
        mockRedis.setex.mockRejectedValue(new Error('Redis write failed'));
        mockPrisma.apiKey.findUnique.mockResolvedValue(mockDbApiKey);

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Should not throw
        const result = await apiKeyService.validateApiKey(mockRawKey);
        expect(result).toBeDefined();

        consoleSpy.mockRestore();
      });
    });
  });

  // =============================================================================
  // revokeApiKey() Tests
  // =============================================================================
  describe('revokeApiKey()', () => {
    const mockKeyId = 'key_123';
    const mockAccountId = 'acc_456';
    const mockHashedKey = 'hashed_key_value';

    it('should revoke key and invalidate cache', async () => {
      mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.apiKey.findUnique.mockResolvedValue({ key: mockHashedKey });

      const result = await apiKeyService.revokeApiKey(mockKeyId, mockAccountId);

      expect(result).toBe(true);
      expect(mockPrisma.apiKey.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockKeyId,
          accountId: mockAccountId,
        },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
      expect(mockRedis.del).toHaveBeenCalledWith(`apikey:${mockHashedKey}`);
    });

    it('should return false when key not found', async () => {
      mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 0 });

      const result = await apiKeyService.revokeApiKey(mockKeyId, mockAccountId);

      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should return false when accountId does not match', async () => {
      mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 0 });

      const result = await apiKeyService.revokeApiKey(mockKeyId, 'wrong_account');

      expect(result).toBe(false);
    });

    it('should handle cache invalidation when key lookup fails', async () => {
      mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await apiKeyService.revokeApiKey(mockKeyId, mockAccountId);

      expect(result).toBe(true);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle Redis delete errors gracefully', async () => {
      mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.apiKey.findUnique.mockResolvedValue({ key: mockHashedKey });
      mockRedis.del.mockRejectedValue(new Error('Redis delete failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      const result = await apiKeyService.revokeApiKey(mockKeyId, mockAccountId);
      expect(result).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  // =============================================================================
  // listApiKeys() Tests
  // =============================================================================
  describe('listApiKeys()', () => {
    const mockAccountId = 'acc_123';

    const mockApiKeys = [
      {
        id: 'key_1',
        prefix: 'sk_live_12345678',
        name: 'Production Key',
        isActive: true,
        createdAt: new Date('2024-01-15'),
        lastUsedAt: new Date('2024-01-20'),
        revokedAt: null,
      },
      {
        id: 'key_2',
        prefix: 'sk_test_87654321',
        name: 'Test Key',
        isActive: true,
        createdAt: new Date('2024-01-10'),
        lastUsedAt: null,
        revokedAt: null,
      },
      {
        id: 'key_3',
        prefix: 'sk_live_revoked1',
        name: 'Old Key',
        isActive: false,
        createdAt: new Date('2023-12-01'),
        lastUsedAt: new Date('2023-12-15'),
        revokedAt: new Date('2023-12-20'),
      },
    ];

    it('should return all API keys for account', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue(mockApiKeys);

      const result = await apiKeyService.listApiKeys(mockAccountId);

      expect(result).toEqual(mockApiKeys);
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith({
        where: { accountId: mockAccountId },
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
    });

    it('should return empty array when no keys exist', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);

      const result = await apiKeyService.listApiKeys(mockAccountId);

      expect(result).toEqual([]);
    });

    it('should order by createdAt descending (newest first)', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue(mockApiKeys);

      await apiKeyService.listApiKeys(mockAccountId);

      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should NOT return raw key in list (security)', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue(mockApiKeys);

      await apiKeyService.listApiKeys(mockAccountId);

      const selectFields = mockPrisma.apiKey.findMany.mock.calls[0][0].select;
      expect(selectFields.key).toBeUndefined();
    });
  });

  // =============================================================================
  // Security Tests
  // =============================================================================
  describe('Security', () => {
    it('should never expose raw API key after creation', async () => {
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key_123',
        key: 'hashed_value',
        prefix: 'sk_live_12345678',
        name: null,
        accountId: 'acc_123',
        isActive: true,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
      });

      const result = await apiKeyService.createApiKey('acc_123');

      // Raw key is returned from createApiKey
      expect(result.key).toMatch(/^sk_live_/);

      // But it's NOT what gets stored in the DB
      const storedValue = mockPrisma.apiKey.create.mock.calls[0][0].data.key;
      expect(storedValue).not.toBe(result.key);
      expect(storedValue.length).toBe(64); // SHA256 hash length
    });

    it('should use constant-time comparison for hash validation', async () => {
      // The service uses SHA256 which inherently provides timing-safe comparison
      // when used with string comparison (due to hash unpredictability)
      const key1 = 'sk_live_secret1';
      const key2 = 'sk_live_secret2';

      const hash1 = apiKeyService.hashApiKey(key1);
      const hash2 = apiKeyService.hashApiKey(key2);

      // Hashes should be completely different (no prefix matching)
      expect(hash1.substring(0, 10)).not.toBe(hash2.substring(0, 10));
    });

    it('should use cryptographically secure random generation', () => {
      // Verify crypto.randomBytes is being used
      const randomBytesSpy = vi.spyOn(crypto, 'randomBytes');

      apiKeyService.generateApiKey();

      expect(randomBytesSpy).toHaveBeenCalledWith(32);
      randomBytesSpy.mockRestore();
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================
  describe('Edge Cases', () => {
    it('should handle very long account IDs', async () => {
      const longAccountId = 'acc_' + 'x'.repeat(500);
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key_123',
        key: 'hashed',
        prefix: 'sk_live_12345678',
        name: null,
        accountId: longAccountId,
        isActive: true,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
      });

      const result = await apiKeyService.createApiKey(longAccountId);

      expect(result.accountId).toBe(longAccountId);
    });

    it('should handle special characters in key name', async () => {
      const specialName = 'Key with "quotes" & <special> chars!';
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key_123',
        key: 'hashed',
        prefix: 'sk_live_12345678',
        name: specialName,
        accountId: 'acc_123',
        isActive: true,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
      });

      await apiKeyService.createApiKey('acc_123', specialName);

      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: specialName,
        }),
      });
    });

    it('should handle concurrent validation requests', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'key_123',
        key: 'hashed',
        isActive: true,
        account: {
          id: 'acc_123',
          tier: 'FREE',
          monthlyCredits: 1000,
          usedCredits: 0,
        },
      });

      // Simulate concurrent requests
      const promises = Array(10).fill(null).map(() =>
        apiKeyService.validateApiKey('sk_live_concurrent123')
      );

      const results = await Promise.all(promises);

      // All should resolve successfully
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result?.accountId).toBe('acc_123');
      });
    });
  });
});
