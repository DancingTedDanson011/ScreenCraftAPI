import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create comprehensive Prisma mock
const mockPrisma = {
  account: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  apiKey: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  usageEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

// Mock the prisma import
vi.mock('../../../../src/lib/db', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
const { AccountRepository } = await import(
  '../../../../src/services/database/account.repository.js'
);

// Test data factories
const createMockAccount = (overrides = {}) => ({
  id: 'acc-123',
  email: 'test@example.com',
  tier: 'FREE' as const,
  monthlyCredits: 1000,
  usedCredits: 100,
  lastResetAt: new Date('2024-01-15'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
  ...overrides,
});

const createMockApiKey = (overrides = {}) => ({
  id: 'key-123',
  accountId: 'acc-123',
  key: 'hashed_key_123',
  prefix: 'sk_test_',
  name: 'Test API Key',
  isActive: true,
  lastUsedAt: new Date('2024-01-10'),
  revokedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-10'),
  ...overrides,
});

const createMockUsageEvent = (overrides = {}) => ({
  id: 'event-123',
  accountId: 'acc-123',
  eventType: 'SCREENSHOT_BASIC' as const,
  credits: 1,
  metadata: {},
  createdAt: new Date('2024-01-15'),
  ...overrides,
});

describe('AccountRepository', () => {
  let repository: InstanceType<typeof AccountRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AccountRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================
  // findByApiKey
  // ===========================================
  describe('findByApiKey', () => {
    it('should return account when API key exists and is active', async () => {
      const mockAccount = createMockAccount();
      const mockApiKey = createMockApiKey({ account: mockAccount });

      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.update.mockResolvedValue(mockApiKey);

      const result = await repository.findByApiKey('hashed_key_123');

      expect(result).toEqual(mockAccount);
      expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: {
          key: 'hashed_key_123',
          isActive: true,
        },
        include: {
          account: true,
        },
      });
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it('should return null when API key does not exist', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await repository.findByApiKey('nonexistent_key');

      expect(result).toBeNull();
      expect(mockPrisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('should return null when API key is inactive', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await repository.findByApiKey('inactive_key');

      expect(result).toBeNull();
    });

    it('should update lastUsedAt timestamp when key is found', async () => {
      const mockAccount = createMockAccount();
      const mockApiKey = createMockApiKey({ account: mockAccount });

      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey);
      mockPrisma.apiKey.update.mockResolvedValue(mockApiKey);

      await repository.findByApiKey('hashed_key_123');

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });

  // ===========================================
  // findById
  // ===========================================
  describe('findById', () => {
    it('should return account when found', async () => {
      const mockAccount = createMockAccount();
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.findById('acc-123');

      expect(result).toEqual(mockAccount);
      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'acc-123' },
      });
    });

    it('should return null when account not found', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ===========================================
  // findByEmail
  // ===========================================
  describe('findByEmail', () => {
    it('should return account when found by email', async () => {
      const mockAccount = createMockAccount();
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toEqual(mockAccount);
      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when email not found', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  // ===========================================
  // create
  // ===========================================
  describe('create', () => {
    it('should create account with default tier FREE', async () => {
      const mockAccount = createMockAccount();
      mockPrisma.account.create.mockResolvedValue(mockAccount);

      const result = await repository.create({
        email: 'new@example.com',
        monthlyCredits: 1000,
      });

      expect(result).toEqual(mockAccount);
      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          tier: 'FREE',
          monthlyCredits: 1000,
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });

    it('should create account with specified tier', async () => {
      const mockAccount = createMockAccount({ tier: 'PRO' });
      mockPrisma.account.create.mockResolvedValue(mockAccount);

      const result = await repository.create({
        email: 'pro@example.com',
        tier: 'PRO',
        monthlyCredits: 5000,
      });

      expect(result).toEqual(mockAccount);
      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: {
          email: 'pro@example.com',
          tier: 'PRO',
          monthlyCredits: 5000,
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });
  });

  // ===========================================
  // checkQuota
  // ===========================================
  describe('checkQuota', () => {
    it('should return allowed=true when quota is sufficient', async () => {
      const mockAccount = createMockAccount({
        monthlyCredits: 1000,
        usedCredits: 100,
        lastResetAt: new Date(), // Current month
      });
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.checkQuota('acc-123', 10);

      expect(result).toEqual({
        allowed: true,
        remaining: 900,
        monthlyLimit: 1000,
        used: 100,
      });
    });

    it('should return allowed=false when quota is insufficient', async () => {
      const mockAccount = createMockAccount({
        monthlyCredits: 100,
        usedCredits: 95,
        lastResetAt: new Date(), // Current month
      });
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.checkQuota('acc-123', 10);

      expect(result).toEqual({
        allowed: false,
        remaining: 5,
        monthlyLimit: 100,
        used: 95,
      });
    });

    it('should return allowed=false with zeros when account not found', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      const result = await repository.checkQuota('nonexistent');

      expect(result).toEqual({
        allowed: false,
        remaining: 0,
        monthlyLimit: 0,
        used: 0,
      });
    });

    it('should reset quota when month has changed', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const mockAccount = createMockAccount({
        monthlyCredits: 1000,
        usedCredits: 500,
        lastResetAt: lastMonth,
      });
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);
      mockPrisma.account.update.mockResolvedValue({
        ...mockAccount,
        usedCredits: 0,
      });

      const result = await repository.checkQuota('acc-123', 10);

      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-123' },
        data: {
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
      expect(result.used).toBe(0);
      expect(result.remaining).toBe(1000);
      expect(result.allowed).toBe(true);
    });

    it('should use default requiredCredits of 1', async () => {
      const mockAccount = createMockAccount({
        monthlyCredits: 1000,
        usedCredits: 999,
        lastResetAt: new Date(),
      });
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.checkQuota('acc-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should not reset quota within same month', async () => {
      const mockAccount = createMockAccount({
        monthlyCredits: 1000,
        usedCredits: 500,
        lastResetAt: new Date(), // Same month
      });
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);

      await repository.checkQuota('acc-123', 10);

      expect(mockPrisma.account.update).not.toHaveBeenCalled();
    });
  });

  // ===========================================
  // incrementUsage
  // ===========================================
  describe('incrementUsage', () => {
    it('should increment usage credits', async () => {
      const updatedAccount = createMockAccount({ usedCredits: 110 });
      mockPrisma.account.update.mockResolvedValue(updatedAccount);

      const result = await repository.incrementUsage('acc-123', 10);

      expect(result).toEqual(updatedAccount);
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-123' },
        data: {
          usedCredits: {
            increment: 10,
          },
        },
      });
    });
  });

  // ===========================================
  // recordUsageEvent
  // ===========================================
  describe('recordUsageEvent', () => {
    it('should create usage event and increment account usage in transaction', async () => {
      mockPrisma.$transaction.mockResolvedValue([]);

      await repository.recordUsageEvent({
        accountId: 'acc-123',
        eventType: 'SCREENSHOT_BASIC',
        credits: 1,
        metadata: { url: 'https://example.com' },
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledWith([
        mockPrisma.usageEvent.create({
          data: {
            accountId: 'acc-123',
            eventType: 'SCREENSHOT_BASIC',
            credits: 1,
            metadata: { url: 'https://example.com' },
          },
        }),
        mockPrisma.account.update({
          where: { id: 'acc-123' },
          data: {
            usedCredits: {
              increment: 1,
            },
          },
        }),
      ]);
    });

    it('should use empty object for metadata when not provided', async () => {
      mockPrisma.$transaction.mockResolvedValue([]);

      await repository.recordUsageEvent({
        accountId: 'acc-123',
        eventType: 'PDF_BASIC',
        credits: 2,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      const transactionCalls = mockPrisma.$transaction.mock.calls[0][0];
      expect(transactionCalls).toHaveLength(2);
    });
  });

  // ===========================================
  // createApiKey
  // ===========================================
  describe('createApiKey', () => {
    it('should create API key with name', async () => {
      const mockApiKey = createMockApiKey();
      mockPrisma.apiKey.create.mockResolvedValue(mockApiKey);

      const result = await repository.createApiKey(
        'acc-123',
        'hashed_key',
        'sk_test_',
        'Production Key'
      );

      expect(result).toEqual(mockApiKey);
      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc-123',
          key: 'hashed_key',
          prefix: 'sk_test_',
          name: 'Production Key',
          isActive: true,
        },
      });
    });

    it('should create API key without name', async () => {
      const mockApiKey = createMockApiKey({ name: undefined });
      mockPrisma.apiKey.create.mockResolvedValue(mockApiKey);

      const result = await repository.createApiKey(
        'acc-123',
        'hashed_key',
        'sk_test_'
      );

      expect(result).toEqual(mockApiKey);
      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc-123',
          key: 'hashed_key',
          prefix: 'sk_test_',
          name: undefined,
          isActive: true,
        },
      });
    });
  });

  // ===========================================
  // revokeApiKey
  // ===========================================
  describe('revokeApiKey', () => {
    it('should revoke API key by setting isActive to false', async () => {
      const revokedKey = createMockApiKey({
        isActive: false,
        revokedAt: new Date(),
      });
      mockPrisma.apiKey.update.mockResolvedValue(revokedKey);

      const result = await repository.revokeApiKey('key-123');

      expect(result).toEqual(revokedKey);
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  // ===========================================
  // listApiKeys
  // ===========================================
  describe('listApiKeys', () => {
    it('should list only active API keys by default', async () => {
      const mockKeys = [createMockApiKey(), createMockApiKey({ id: 'key-456' })];
      mockPrisma.apiKey.findMany.mockResolvedValue(mockKeys);

      const result = await repository.listApiKeys('acc-123');

      expect(result).toEqual(mockKeys);
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith({
        where: {
          accountId: 'acc-123',
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should include revoked keys when includeRevoked is true', async () => {
      const mockKeys = [
        createMockApiKey(),
        createMockApiKey({ id: 'key-456', isActive: false }),
      ];
      mockPrisma.apiKey.findMany.mockResolvedValue(mockKeys);

      const result = await repository.listApiKeys('acc-123', true);

      expect(result).toEqual(mockKeys);
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith({
        where: {
          accountId: 'acc-123',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return empty array when no keys exist', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);

      const result = await repository.listApiKeys('acc-123');

      expect(result).toEqual([]);
    });
  });

  // ===========================================
  // updateTier
  // ===========================================
  describe('updateTier', () => {
    it('should update account tier and monthly credits', async () => {
      const updatedAccount = createMockAccount({
        tier: 'PRO',
        monthlyCredits: 5000,
      });
      mockPrisma.account.update.mockResolvedValue(updatedAccount);

      const result = await repository.updateTier('acc-123', 'PRO', 5000);

      expect(result).toEqual(updatedAccount);
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-123' },
        data: {
          tier: 'PRO',
          monthlyCredits: 5000,
        },
      });
    });
  });

  // ===========================================
  // getUsageStats
  // ===========================================
  describe('getUsageStats', () => {
    it('should return usage statistics without date filters', async () => {
      const mockEvents = [
        createMockUsageEvent({ eventType: 'SCREENSHOT_BASIC', credits: 1 }),
        createMockUsageEvent({ eventType: 'SCREENSHOT_BASIC', credits: 1 }),
        createMockUsageEvent({ eventType: 'PDF_BASIC', credits: 2 }),
      ];
      mockPrisma.usageEvent.findMany.mockResolvedValue(mockEvents);

      const result = await repository.getUsageStats('acc-123');

      expect(result).toEqual({
        totalEvents: 3,
        totalCredits: 4,
        eventsByType: {
          SCREENSHOT_BASIC: 2,
          PDF_BASIC: 1,
        },
      });
      expect(mockPrisma.usageEvent.findMany).toHaveBeenCalledWith({
        where: { accountId: 'acc-123' },
        select: {
          eventType: true,
          credits: true,
        },
      });
    });

    it('should filter by start date', async () => {
      const mockEvents = [createMockUsageEvent()];
      const startDate = new Date('2024-01-01');
      mockPrisma.usageEvent.findMany.mockResolvedValue(mockEvents);

      await repository.getUsageStats('acc-123', startDate);

      expect(mockPrisma.usageEvent.findMany).toHaveBeenCalledWith({
        where: {
          accountId: 'acc-123',
          createdAt: {
            gte: startDate,
          },
        },
        select: {
          eventType: true,
          credits: true,
        },
      });
    });

    it('should filter by end date', async () => {
      const mockEvents = [createMockUsageEvent()];
      const endDate = new Date('2024-01-31');
      mockPrisma.usageEvent.findMany.mockResolvedValue(mockEvents);

      await repository.getUsageStats('acc-123', undefined, endDate);

      expect(mockPrisma.usageEvent.findMany).toHaveBeenCalledWith({
        where: {
          accountId: 'acc-123',
          createdAt: {
            lte: endDate,
          },
        },
        select: {
          eventType: true,
          credits: true,
        },
      });
    });

    it('should filter by both start and end date', async () => {
      const mockEvents = [createMockUsageEvent()];
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      mockPrisma.usageEvent.findMany.mockResolvedValue(mockEvents);

      await repository.getUsageStats('acc-123', startDate, endDate);

      expect(mockPrisma.usageEvent.findMany).toHaveBeenCalledWith({
        where: {
          accountId: 'acc-123',
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
    });

    it('should return empty stats when no events', async () => {
      mockPrisma.usageEvent.findMany.mockResolvedValue([]);

      const result = await repository.getUsageStats('acc-123');

      expect(result).toEqual({
        totalEvents: 0,
        totalCredits: 0,
        eventsByType: {},
      });
    });
  });

  // ===========================================
  // resetMonthlyQuotas
  // ===========================================
  describe('resetMonthlyQuotas', () => {
    it('should reset quotas for accounts from previous months', async () => {
      mockPrisma.account.updateMany.mockResolvedValue({ count: 5 });

      const result = await repository.resetMonthlyQuotas();

      expect(result).toBe(5);
      expect(mockPrisma.account.updateMany).toHaveBeenCalledWith({
        where: {
          lastResetAt: {
            lt: expect.any(Date),
          },
        },
        data: {
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });

    it('should return 0 when no accounts need reset', async () => {
      mockPrisma.account.updateMany.mockResolvedValue({ count: 0 });

      const result = await repository.resetMonthlyQuotas();

      expect(result).toBe(0);
    });
  });

  // ===========================================
  // Error Handling
  // ===========================================
  describe('Error Handling', () => {
    it('should propagate database errors from findByApiKey', async () => {
      mockPrisma.apiKey.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(repository.findByApiKey('key')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should propagate database errors from create', async () => {
      mockPrisma.account.create.mockRejectedValue(
        new Error('Unique constraint violation')
      );

      await expect(
        repository.create({ email: 'dup@example.com', monthlyCredits: 1000 })
      ).rejects.toThrow('Unique constraint violation');
    });

    it('should propagate database errors from recordUsageEvent', async () => {
      mockPrisma.$transaction.mockRejectedValue(
        new Error('Transaction failed')
      );

      await expect(
        repository.recordUsageEvent({
          accountId: 'acc-123',
          eventType: 'SCREENSHOT_BASIC',
          credits: 1,
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should propagate database errors from updateTier', async () => {
      mockPrisma.account.update.mockRejectedValue(
        new Error('Record not found')
      );

      await expect(
        repository.updateTier('nonexistent', 'PRO', 5000)
      ).rejects.toThrow('Record not found');
    });
  });
});
