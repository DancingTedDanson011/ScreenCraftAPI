import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Prisma client
const mockPrisma = {
  auditLog: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    groupBy: vi.fn(),
  },
};

vi.mock('../../../../src/lib/db.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
const { AdminLogsService } = await import(
  '../../../../src/admin/services/admin-logs.service.js'
);

describe('AdminLogsService', () => {
  let service: InstanceType<typeof AdminLogsService>;

  // Test fixtures
  const mockAuditLog = {
    id: 'log-123',
    adminId: 'admin-001',
    admin: {
      email: 'admin@example.com',
    },
    action: 'SUSPEND_USER',
    targetType: 'user',
    targetId: 'user-123',
    details: { reason: 'Abuse' },
    ipAddress: '192.168.1.1',
    createdAt: new Date('2024-01-15T10:00:00Z'),
  };

  const mockAuditLogs = [
    mockAuditLog,
    {
      id: 'log-456',
      adminId: 'admin-002',
      admin: {
        email: 'admin2@example.com',
      },
      action: 'REVOKE_API_KEY',
      targetType: 'api_key',
      targetId: 'key-456',
      details: { prefix: 'sk_test_' },
      ipAddress: '10.0.0.1',
      createdAt: new Date('2024-01-15T09:00:00Z'),
    },
    {
      id: 'log-789',
      adminId: null,
      admin: null,
      action: 'SYSTEM_CLEANUP',
      targetType: null,
      targetId: null,
      details: { cleanedRecords: 100 },
      ipAddress: null,
      createdAt: new Date('2024-01-15T08:00:00Z'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminLogsService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listAuditLogs', () => {
    it('should return paginated audit logs with default params', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(3);
      mockPrisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      const result = await service.listAuditLogs({ page: 1, limit: 50 });

      expect(result.data).toHaveLength(3);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 3,
        totalPages: 1,
      });
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: {
              email: true,
            },
          },
        },
      });
    });

    it('should apply adminId filter', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      await service.listAuditLogs({
        page: 1,
        limit: 50,
        adminId: 'admin-001',
      });

      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: { adminId: 'admin-001' },
      });
    });

    it('should apply accountId filter', async () => {
      const logWithAccountId = {
        ...mockAuditLog,
        accountId: 'account-123',
      };
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([logWithAccountId]);

      await service.listAuditLogs({
        page: 1,
        limit: 50,
        accountId: 'account-123',
      });

      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: { accountId: 'account-123' },
      });
    });

    it('should apply action filter with case-insensitive contains', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      await service.listAuditLogs({
        page: 1,
        limit: 50,
        action: 'SUSPEND',
      });

      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: { action: { contains: 'SUSPEND', mode: 'insensitive' } },
      });
    });

    it('should apply targetType filter', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLogs[1]]);

      await service.listAuditLogs({
        page: 1,
        limit: 50,
        targetType: 'api_key',
      });

      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: { targetType: 'api_key' },
      });
    });

    it('should apply date range filter with startDate only', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      mockPrisma.auditLog.count.mockResolvedValue(2);
      mockPrisma.auditLog.findMany.mockResolvedValue(mockAuditLogs.slice(0, 2));

      await service.listAuditLogs({
        page: 1,
        limit: 50,
        startDate,
      });

      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: startDate },
        },
      });
    });

    it('should apply date range filter with endDate only', async () => {
      const endDate = new Date('2024-01-15T23:59:59Z');
      mockPrisma.auditLog.count.mockResolvedValue(3);
      mockPrisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      await service.listAuditLogs({
        page: 1,
        limit: 50,
        endDate,
      });

      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: {
          createdAt: { lte: endDate },
        },
      });
    });

    it('should apply date range filter with both dates', async () => {
      const startDate = new Date('2024-01-14T00:00:00Z');
      const endDate = new Date('2024-01-16T00:00:00Z');
      mockPrisma.auditLog.count.mockResolvedValue(3);
      mockPrisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      await service.listAuditLogs({
        page: 1,
        limit: 50,
        startDate,
        endDate,
      });

      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      });
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(150);
      mockPrisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      const result = await service.listAuditLogs({ page: 3, limit: 50 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 100, // (3-1) * 50
          take: 50,
        })
      );
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should apply custom sorting', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(3);
      mockPrisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      await service.listAuditLogs({
        page: 1,
        limit: 50,
        sortBy: 'action',
        sortOrder: 'asc',
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { action: 'asc' },
        })
      );
    });

    it('should transform logs to response format correctly', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      const result = await service.listAuditLogs({ page: 1, limit: 50 });

      expect(result.data[0]).toEqual({
        id: 'log-123',
        adminId: 'admin-001',
        adminEmail: 'admin@example.com',
        action: 'SUSPEND_USER',
        targetType: 'user',
        targetId: 'user-123',
        details: { reason: 'Abuse' },
        ipAddress: '192.168.1.1',
        createdAt: mockAuditLog.createdAt,
      });
    });

    it('should handle logs without admin (system logs)', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLogs[2]]);

      const result = await service.listAuditLogs({ page: 1, limit: 50 });

      expect(result.data[0].adminId).toBeNull();
      expect(result.data[0].adminEmail).toBeNull();
    });

    it('should combine multiple filters', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      await service.listAuditLogs({
        page: 1,
        limit: 50,
        adminId: 'admin-001',
        action: 'SUSPEND',
        targetType: 'user',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: {
          adminId: 'admin-001',
          action: { contains: 'SUSPEND', mode: 'insensitive' },
          targetType: 'user',
          createdAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
      });
    });
  });

  describe('getAuditLog', () => {
    it('should return audit log with admin details', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue({
        ...mockAuditLog,
        admin: { email: 'admin@example.com', name: 'Admin User' },
      });

      const result = await service.getAuditLog('log-123');

      expect(result).not.toBeNull();
      expect(result).toEqual({
        id: 'log-123',
        adminId: 'admin-001',
        adminEmail: 'admin@example.com',
        action: 'SUSPEND_USER',
        targetType: 'user',
        targetId: 'user-123',
        details: { reason: 'Abuse' },
        ipAddress: '192.168.1.1',
        createdAt: mockAuditLog.createdAt,
      });
    });

    it('should return null for non-existent log', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(null);

      const result = await service.getAuditLog('nonexistent');

      expect(result).toBeNull();
    });

    it('should include admin name in query', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(mockAuditLog);

      await service.getAuditLog('log-123');

      expect(mockPrisma.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        include: {
          admin: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });
    });

    it('should handle log without admin', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(mockAuditLogs[2]);

      const result = await service.getAuditLog('log-789');

      expect(result!.adminEmail).toBeNull();
    });
  });

  describe('getLogsForUser', () => {
    it('should return logs for a specific user', async () => {
      const userLogs = mockAuditLogs.filter(
        (log) => log.targetType === 'user'
      );
      mockPrisma.auditLog.findMany.mockResolvedValue(userLogs);

      const result = await service.getLogsForUser('account-123');

      expect(result).toHaveLength(1);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { accountId: 'account-123' },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: {
              email: true,
            },
          },
        },
      });
    });

    it('should respect custom limit', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      await service.getLogsForUser('account-123', 10);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('should return empty array for user with no logs', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getLogsForUser('no-logs-user');

      expect(result).toHaveLength(0);
    });

    it('should transform logs to correct format', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      const result = await service.getLogsForUser('account-123');

      expect(result[0]).toEqual({
        id: 'log-123',
        adminId: 'admin-001',
        adminEmail: 'admin@example.com',
        action: 'SUSPEND_USER',
        targetType: 'user',
        targetId: 'user-123',
        details: { reason: 'Abuse' },
        ipAddress: '192.168.1.1',
        createdAt: mockAuditLog.createdAt,
      });
    });
  });

  describe('getActionTypes', () => {
    it('should return distinct action types', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { action: 'CREATE_USER' },
        { action: 'DELETE_USER' },
        { action: 'REVOKE_API_KEY' },
        { action: 'SUSPEND_USER' },
      ]);

      const result = await service.getActionTypes();

      expect(result).toEqual([
        'CREATE_USER',
        'DELETE_USER',
        'REVOKE_API_KEY',
        'SUSPEND_USER',
      ]);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' },
      });
    });

    it('should return empty array when no logs exist', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getActionTypes();

      expect(result).toEqual([]);
    });
  });

  describe('getTargetTypes', () => {
    it('should return distinct target types excluding null', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { targetType: 'api_key' },
        { targetType: 'job' },
        { targetType: 'user' },
      ]);

      const result = await service.getTargetTypes();

      expect(result).toEqual(['api_key', 'job', 'user']);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { targetType: { not: null } },
        select: { targetType: true },
        distinct: ['targetType'],
        orderBy: { targetType: 'asc' },
      });
    });

    it('should return empty array when no target types exist', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getTargetTypes();

      expect(result).toEqual([]);
    });
  });

  describe('getLogStats', () => {
    it('should return log statistics for default 24 hours', async () => {
      mockPrisma.auditLog.count
        .mockResolvedValueOnce(1000) // total
        .mockResolvedValueOnce(50); // recent

      mockPrisma.auditLog.groupBy.mockResolvedValue([
        { action: 'SUSPEND_USER', _count: { action: 20 } },
        { action: 'REVOKE_API_KEY', _count: { action: 15 } },
        { action: 'DELETE_JOB', _count: { action: 10 } },
      ]);

      mockPrisma.auditLog.findMany.mockResolvedValue([
        { adminId: 'admin-001' },
        { adminId: 'admin-002' },
        { adminId: 'admin-003' },
      ]);

      const result = await service.getLogStats();

      expect(result).toEqual({
        totalLogs: 1000,
        recentLogs: 50,
        actionBreakdown: {
          SUSPEND_USER: 20,
          REVOKE_API_KEY: 15,
          DELETE_JOB: 10,
        },
        activeAdmins: 3,
      });
    });

    it('should use custom hours parameter', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(now);

      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.groupBy.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.getLogStats(48); // 48 hours

      // Verify the time filter is correct
      const expectedSince = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      expect(mockPrisma.auditLog.count).toHaveBeenNthCalledWith(2, {
        where: { createdAt: { gte: expect.any(Date) } },
      });

      vi.useRealTimers();
    });

    it('should count active admins correctly', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.groupBy.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { adminId: 'admin-001' },
        { adminId: 'admin-002' },
      ]);

      const result = await service.getLogStats();

      expect(result.activeAdmins).toBe(2);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: expect.any(Date) },
          adminId: { not: null },
        },
        select: { adminId: true },
        distinct: ['adminId'],
      });
    });

    it('should handle empty action breakdown', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.groupBy.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getLogStats();

      expect(result.actionBreakdown).toEqual({});
    });

    it('should handle zero stats', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.groupBy.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getLogStats();

      expect(result).toEqual({
        totalLogs: 0,
        recentLogs: 0,
        actionBreakdown: {},
        activeAdmins: 0,
      });
    });
  });

  describe('cleanOldLogs', () => {
    it('should delete logs older than specified days', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 500 });

      const result = await service.cleanOldLogs(90);

      expect(result).toBe(500);
    });

    it('should use correct cutoff date', async () => {
      const now = new Date('2024-03-15T12:00:00Z');
      vi.setSystemTime(now);

      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanOldLogs(30);

      const expectedCutoff = new Date('2024-02-14T12:00:00Z');
      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      });

      const call = mockPrisma.auditLog.deleteMany.mock.calls[0][0];
      const actualCutoff = call.where.createdAt.lt;
      expect(actualCutoff.getTime()).toBeCloseTo(expectedCutoff.getTime(), -4);

      vi.useRealTimers();
    });

    it('should return 0 when no logs to delete', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanOldLogs(365);

      expect(result).toBe(0);
    });

    it('should handle large delete counts', async () => {
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 100000 });

      const result = await service.cleanOldLogs(7);

      expect(result).toBe(100000);
    });
  });

  describe('exportLogs', () => {
    it('should export logs within date range', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');
      mockPrisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      const result = await service.exportLogs(startDate, endDate);

      expect(result).toHaveLength(3);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        take: 10000,
        orderBy: { createdAt: 'asc' },
        include: {
          admin: {
            select: {
              email: true,
            },
          },
        },
      });
    });

    it('should respect custom limit', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      await service.exportLogs(startDate, endDate, 5000);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5000,
        })
      );
    });

    it('should order by createdAt ascending for export', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      mockPrisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      await service.exportLogs(startDate, endDate);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });

    it('should transform exported logs correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      const result = await service.exportLogs(startDate, endDate);

      expect(result[0]).toEqual({
        id: 'log-123',
        adminId: 'admin-001',
        adminEmail: 'admin@example.com',
        action: 'SUSPEND_USER',
        targetType: 'user',
        targetId: 'user-123',
        details: { reason: 'Abuse' },
        ipAddress: '192.168.1.1',
        createdAt: mockAuditLog.createdAt,
      });
    });

    it('should return empty array for date range with no logs', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.exportLogs(startDate, endDate);

      expect(result).toEqual([]);
    });

    it('should use default limit of 10000', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.exportLogs(startDate, endDate);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10000,
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty log list', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.listAuditLogs({ page: 1, limit: 50 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should handle log with null details', async () => {
      const logWithNullDetails = { ...mockAuditLog, details: null };
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([logWithNullDetails]);

      const result = await service.listAuditLogs({ page: 1, limit: 50 });

      expect(result.data[0].details).toBeNull();
    });

    it('should handle log with null targetId', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLogs[2]]);

      const result = await service.listAuditLogs({ page: 1, limit: 50 });

      expect(result.data[0].targetId).toBeNull();
      expect(result.data[0].targetType).toBeNull();
    });

    it('should handle log with null ipAddress', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLogs[2]]);

      const result = await service.listAuditLogs({ page: 1, limit: 50 });

      expect(result.data[0].ipAddress).toBeNull();
    });

    it('should handle details as complex object', async () => {
      const logWithComplexDetails = {
        ...mockAuditLog,
        details: {
          reason: 'Abuse',
          previousState: { status: 'ACTIVE' },
          newState: { status: 'SUSPENDED' },
          metadata: { source: 'admin-panel', timestamp: 1705315200000 },
        },
      };
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([logWithComplexDetails]);

      const result = await service.listAuditLogs({ page: 1, limit: 50 });

      expect(result.data[0].details).toEqual({
        reason: 'Abuse',
        previousState: { status: 'ACTIVE' },
        newState: { status: 'SUSPENDED' },
        metadata: { source: 'admin-panel', timestamp: 1705315200000 },
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent stat queries', async () => {
      mockPrisma.auditLog.count
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(50);
      mockPrisma.auditLog.groupBy.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getLogStats();

      // All queries should be executed in parallel
      expect(mockPrisma.auditLog.count).toHaveBeenCalledTimes(2);
      expect(result.totalLogs).toBe(1000);
      expect(result.recentLogs).toBe(50);
    });
  });
});
