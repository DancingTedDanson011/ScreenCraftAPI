import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Prisma client
const mockPrisma = {
  apiKey: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  usageEvent: {
    count: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock('../../../../src/lib/db.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
const { AdminApiKeysService } = await import(
  '../../../../src/admin/services/admin-apikeys.service.js'
);

describe('AdminApiKeysService', () => {
  let service: InstanceType<typeof AdminApiKeysService>;

  // Test fixtures
  const mockApiKey = {
    id: 'key-123',
    prefix: 'sk_test_',
    name: 'Test API Key',
    accountId: 'account-123',
    account: {
      email: 'test@example.com',
    },
    isActive: true,
    lastUsedAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-01'),
    revokedAt: null,
  };

  const mockApiKeys = [
    mockApiKey,
    {
      id: 'key-456',
      prefix: 'sk_prod_',
      name: 'Production Key',
      accountId: 'account-456',
      account: {
        email: 'prod@example.com',
      },
      isActive: true,
      lastUsedAt: new Date('2024-01-14'),
      createdAt: new Date('2024-01-02'),
      revokedAt: null,
    },
    {
      id: 'key-789',
      prefix: 'sk_revoked_',
      name: 'Revoked Key',
      accountId: 'account-789',
      account: {
        email: 'revoked@example.com',
      },
      isActive: false,
      lastUsedAt: null,
      createdAt: new Date('2024-01-03'),
      revokedAt: new Date('2024-01-10'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminApiKeysService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listApiKeys', () => {
    it('should return paginated API keys with default params', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(3);
      mockPrisma.apiKey.findMany.mockResolvedValue(mockApiKeys);

      const result = await service.listApiKeys({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(3);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          account: {
            select: {
              email: true,
            },
          },
        },
      });
    });

    it('should apply search filter to prefix, name, and email', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(1);
      mockPrisma.apiKey.findMany.mockResolvedValue([mockApiKey]);

      await service.listApiKeys({ page: 1, limit: 20, search: 'test' });

      expect(mockPrisma.apiKey.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { prefix: { contains: 'test', mode: 'insensitive' } },
            { name: { contains: 'test', mode: 'insensitive' } },
            { account: { email: { contains: 'test', mode: 'insensitive' } } },
          ],
        },
      });
    });

    it('should apply isActive filter', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(2);
      mockPrisma.apiKey.findMany.mockResolvedValue(
        mockApiKeys.filter((k) => k.isActive)
      );

      await service.listApiKeys({ page: 1, limit: 20, isActive: true });

      expect(mockPrisma.apiKey.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it('should apply accountId filter', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(1);
      mockPrisma.apiKey.findMany.mockResolvedValue([mockApiKey]);

      await service.listApiKeys({
        page: 1,
        limit: 20,
        accountId: 'account-123',
      });

      expect(mockPrisma.apiKey.count).toHaveBeenCalledWith({
        where: { accountId: 'account-123' },
      });
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(50);
      mockPrisma.apiKey.findMany.mockResolvedValue(mockApiKeys.slice(0, 2));

      const result = await service.listApiKeys({ page: 2, limit: 10 });

      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(result.pagination.totalPages).toBe(5);
    });

    it('should apply custom sorting', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(3);
      mockPrisma.apiKey.findMany.mockResolvedValue(mockApiKeys);

      await service.listApiKeys({
        page: 1,
        limit: 20,
        sortBy: 'lastUsedAt',
        sortOrder: 'asc',
      });

      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { lastUsedAt: 'asc' },
        })
      );
    });

    it('should transform API keys to response format correctly', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(1);
      mockPrisma.apiKey.findMany.mockResolvedValue([mockApiKey]);

      const result = await service.listApiKeys({ page: 1, limit: 20 });

      expect(result.data[0]).toEqual({
        id: 'key-123',
        prefix: 'sk_test_',
        name: 'Test API Key',
        accountId: 'account-123',
        accountEmail: 'test@example.com',
        isActive: true,
        lastUsedAt: mockApiKey.lastUsedAt,
        createdAt: mockApiKey.createdAt,
        revokedAt: null,
      });
    });

    it('should combine search and isActive filters', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(1);
      mockPrisma.apiKey.findMany.mockResolvedValue([mockApiKey]);

      await service.listApiKeys({
        page: 1,
        limit: 20,
        search: 'test',
        isActive: true,
      });

      expect(mockPrisma.apiKey.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { prefix: { contains: 'test', mode: 'insensitive' } },
            { name: { contains: 'test', mode: 'insensitive' } },
            { account: { email: { contains: 'test', mode: 'insensitive' } } },
          ],
          isActive: true,
        },
      });
    });
  });

  describe('getApiKey', () => {
    it('should return API key with usage stats', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey);
      mockPrisma.usageEvent.count.mockResolvedValueOnce(10); // last 24h
      mockPrisma.usageEvent.count.mockResolvedValueOnce(50); // last 7d
      mockPrisma.usageEvent.count.mockResolvedValueOnce(200); // last 30d

      const result = await service.getApiKey('key-123');

      expect(result).not.toBeNull();
      expect(result!.key).toEqual({
        id: 'key-123',
        prefix: 'sk_test_',
        name: 'Test API Key',
        accountId: 'account-123',
        accountEmail: 'test@example.com',
        isActive: true,
        lastUsedAt: mockApiKey.lastUsedAt,
        createdAt: mockApiKey.createdAt,
        revokedAt: null,
      });
      expect(result!.usageStats).toEqual({
        last24h: 10,
        last7d: 50,
        last30d: 200,
      });
    });

    it('should return null for non-existent API key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await service.getApiKey('nonexistent');

      expect(result).toBeNull();
      expect(mockPrisma.usageEvent.count).not.toHaveBeenCalled();
    });

    it('should query usage events with correct time ranges', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(mockApiKey);
      mockPrisma.usageEvent.count.mockResolvedValue(0);

      const now = Date.now();
      vi.setSystemTime(now);

      await service.getApiKey('key-123');

      // Verify time-based queries were made
      expect(mockPrisma.usageEvent.count).toHaveBeenCalledTimes(3);

      // Check that accountId is used for filtering
      expect(mockPrisma.usageEvent.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: 'account-123',
          }),
        })
      );

      vi.useRealTimers();
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key and create audit log', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        accountId: 'account-123',
        prefix: 'sk_test_',
      });
      mockPrisma.apiKey.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.revokeApiKey('key-123', 'admin-001');

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-001',
          accountId: 'account-123',
          action: 'REVOKE_API_KEY',
          targetType: 'api_key',
          targetId: 'key-123',
          details: { prefix: 'sk_test_' },
        },
      });
    });

    it('should throw error for non-existent API key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.revokeApiKey('nonexistent', 'admin-001')).rejects.toThrow(
        'API key not found'
      );

      expect(mockPrisma.apiKey.update).not.toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('reactivateApiKey', () => {
    it('should reactivate a revoked API key and create audit log', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        accountId: 'account-123',
        prefix: 'sk_revoked_',
      });
      mockPrisma.apiKey.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.reactivateApiKey('key-789', 'admin-001');

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-789' },
        data: {
          isActive: true,
          revokedAt: null,
        },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-001',
          accountId: 'account-123',
          action: 'REACTIVATE_API_KEY',
          targetType: 'api_key',
          targetId: 'key-789',
          details: { prefix: 'sk_revoked_' },
        },
      });
    });

    it('should throw error for non-existent API key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(
        service.reactivateApiKey('nonexistent', 'admin-001')
      ).rejects.toThrow('API key not found');

      expect(mockPrisma.apiKey.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteApiKey', () => {
    it('should delete an API key and create audit log', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        accountId: 'account-123',
        prefix: 'sk_test_',
      });
      mockPrisma.apiKey.delete.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.deleteApiKey('key-123', 'admin-001');

      expect(mockPrisma.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 'key-123' },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-001',
          accountId: 'account-123',
          action: 'DELETE_API_KEY',
          targetType: 'api_key',
          targetId: 'key-123',
          details: { prefix: 'sk_test_' },
        },
      });
    });

    it('should throw error for non-existent API key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.deleteApiKey('nonexistent', 'admin-001')).rejects.toThrow(
        'API key not found'
      );

      expect(mockPrisma.apiKey.delete).not.toHaveBeenCalled();
    });
  });

  describe('getApiKeyStats', () => {
    it('should return API key statistics', async () => {
      mockPrisma.apiKey.count.mockResolvedValueOnce(100); // total
      mockPrisma.apiKey.count.mockResolvedValueOnce(80); // active
      mockPrisma.apiKey.count.mockResolvedValueOnce(20); // revoked
      mockPrisma.apiKey.count.mockResolvedValueOnce(15); // used today

      const result = await service.getApiKeyStats();

      expect(result).toEqual({
        total: 100,
        active: 80,
        revoked: 20,
        usedToday: 15,
      });
    });

    it('should query with correct filters for each stat', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(0);

      await service.getApiKeyStats();

      // Total (no filter)
      expect(mockPrisma.apiKey.count).toHaveBeenNthCalledWith(1);

      // Active
      expect(mockPrisma.apiKey.count).toHaveBeenNthCalledWith(2, {
        where: { isActive: true },
      });

      // Revoked
      expect(mockPrisma.apiKey.count).toHaveBeenNthCalledWith(3, {
        where: { isActive: false },
      });

      // Used today (check that lastUsedAt filter is applied)
      expect(mockPrisma.apiKey.count).toHaveBeenNthCalledWith(4, {
        where: {
          lastUsedAt: { gte: expect.any(Date) },
        },
      });
    });

    it('should calculate today correctly for usedToday stat', async () => {
      const now = new Date('2024-01-15T14:30:00Z');
      vi.setSystemTime(now);

      mockPrisma.apiKey.count.mockResolvedValue(0);

      await service.getApiKeyStats();

      // The fourth call should have today's date at midnight
      const call = mockPrisma.apiKey.count.mock.calls[3];
      const filterDate = call[0].where.lastUsedAt.gte;
      expect(filterDate.getHours()).toBe(0);
      expect(filterDate.getMinutes()).toBe(0);
      expect(filterDate.getSeconds()).toBe(0);
      expect(filterDate.getMilliseconds()).toBe(0);

      vi.useRealTimers();
    });

    it('should handle zero counts gracefully', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(0);

      const result = await service.getApiKeyStats();

      expect(result).toEqual({
        total: 0,
        active: 0,
        revoked: 0,
        usedToday: 0,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty search results', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(0);
      mockPrisma.apiKey.findMany.mockResolvedValue([]);

      const result = await service.listApiKeys({
        page: 1,
        limit: 20,
        search: 'nonexistent',
      });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should handle API key with null lastUsedAt', async () => {
      const keyWithNullLastUsed = {
        ...mockApiKey,
        lastUsedAt: null,
      };
      mockPrisma.apiKey.count.mockResolvedValue(1);
      mockPrisma.apiKey.findMany.mockResolvedValue([keyWithNullLastUsed]);

      const result = await service.listApiKeys({ page: 1, limit: 20 });

      expect(result.data[0].lastUsedAt).toBeNull();
    });

    it('should handle API key with null name', async () => {
      const keyWithNullName = {
        ...mockApiKey,
        name: null,
      };
      mockPrisma.apiKey.count.mockResolvedValue(1);
      mockPrisma.apiKey.findMany.mockResolvedValue([keyWithNullName]);

      const result = await service.listApiKeys({ page: 1, limit: 20 });

      expect(result.data[0].name).toBeNull();
    });

    it('should handle concurrent stat queries', async () => {
      // Simulate concurrent responses
      mockPrisma.apiKey.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(15);

      const result = await service.getApiKeyStats();

      // All queries should be executed in parallel
      expect(mockPrisma.apiKey.count).toHaveBeenCalledTimes(4);
      expect(result.total).toBe(100);
      expect(result.active).toBe(80);
    });
  });

  describe('Audit Trail', () => {
    it('should record admin ID in all operations', async () => {
      const adminId = 'admin-999';
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        accountId: 'account-123',
        prefix: 'sk_test_',
      });
      mockPrisma.apiKey.update.mockResolvedValue({});
      mockPrisma.apiKey.delete.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.revokeApiKey('key-1', adminId);
      await service.reactivateApiKey('key-2', adminId);
      await service.deleteApiKey('key-3', adminId);

      const auditCalls = mockPrisma.auditLog.create.mock.calls;
      expect(auditCalls).toHaveLength(3);
      auditCalls.forEach((call) => {
        expect(call[0].data.adminId).toBe(adminId);
      });
    });

    it('should record different actions for each operation', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        accountId: 'account-123',
        prefix: 'sk_test_',
      });
      mockPrisma.apiKey.update.mockResolvedValue({});
      mockPrisma.apiKey.delete.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.revokeApiKey('key-1', 'admin-001');
      await service.reactivateApiKey('key-2', 'admin-001');
      await service.deleteApiKey('key-3', 'admin-001');

      const actions = mockPrisma.auditLog.create.mock.calls.map(
        (call) => call[0].data.action
      );
      expect(actions).toContain('REVOKE_API_KEY');
      expect(actions).toContain('REACTIVATE_API_KEY');
      expect(actions).toContain('DELETE_API_KEY');
    });
  });
});
