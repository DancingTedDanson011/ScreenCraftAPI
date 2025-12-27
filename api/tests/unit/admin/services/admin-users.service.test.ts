// Admin Users Service Unit Tests
// Tests user management operations: list, block, delete, tier updates

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminUsersService } from '../../../../src/admin/services/admin-users.service.js';
import { Tier } from '@prisma/client';

// Mock Prisma client
vi.mock('../../../../src/lib/db.js', () => ({
  prisma: {
    account: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    apiKey: {
      updateMany: vi.fn(),
    },
    screenshot: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    pdf: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Import mocked prisma after vi.mock
import { prisma } from '../../../../src/lib/db.js';

describe('AdminUsersService', () => {
  let service: AdminUsersService;

  beforeEach(() => {
    service = new AdminUsersService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // listUsers Tests
  // ============================================
  describe('listUsers', () => {
    const mockAccounts = [
      {
        id: 'account-1',
        email: 'user1@example.com',
        tier: 'FREE' as Tier,
        monthlyCredits: 100,
        usedCredits: 25,
        createdAt: new Date('2024-01-01'),
        user: {
          name: 'User One',
          lastLoginAt: new Date('2024-06-01'),
        },
        _count: {
          apiKeys: 2,
        },
      },
      {
        id: 'account-2',
        email: 'user2@example.com',
        tier: 'PRO' as Tier,
        monthlyCredits: 5000,
        usedCredits: 1000,
        createdAt: new Date('2024-02-01'),
        user: {
          name: 'User Two',
          lastLoginAt: null,
        },
        _count: {
          apiKeys: 5,
        },
      },
    ];

    it('should return paginated user list with default parameters', async () => {
      vi.mocked(prisma.account.count).mockResolvedValue(2);
      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts);

      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should apply search filter for email', async () => {
      vi.mocked(prisma.account.count).mockResolvedValue(1);
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockAccounts[0]]);

      await service.listUsers({ page: 1, limit: 20, search: 'user1' });

      expect(prisma.account.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { email: { contains: 'user1', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter by tier', async () => {
      vi.mocked(prisma.account.count).mockResolvedValue(1);
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockAccounts[1]]);

      await service.listUsers({ page: 1, limit: 20, tier: 'PRO' as Tier });

      expect(prisma.account.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tier: 'PRO' }),
        })
      );
    });

    it('should calculate pagination correctly for page 2', async () => {
      vi.mocked(prisma.account.count).mockResolvedValue(50);
      vi.mocked(prisma.account.findMany).mockResolvedValue([]);

      const result = await service.listUsers({ page: 2, limit: 20 });

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 })
      );
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should apply custom sort order', async () => {
      vi.mocked(prisma.account.count).mockResolvedValue(2);
      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts);

      await service.listUsers({
        page: 1,
        limit: 20,
        sortBy: 'email',
        sortOrder: 'asc',
      });

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { email: 'asc' },
        })
      );
    });

    it('should correctly transform account data to AdminUserListItem', async () => {
      vi.mocked(prisma.account.count).mockResolvedValue(1);
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockAccounts[0]]);

      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result.data[0]).toEqual({
        id: 'account-1',
        email: 'user1@example.com',
        name: 'User One',
        tier: 'FREE',
        monthlyCredits: 100,
        usedCredits: 25,
        apiKeyCount: 2,
        createdAt: new Date('2024-01-01'),
        lastLoginAt: new Date('2024-06-01'),
        isBanned: false,
      });
    });

    it('should detect banned users (FREE tier with 0 credits)', async () => {
      const bannedAccount = {
        ...mockAccounts[0],
        tier: 'FREE' as Tier,
        monthlyCredits: 0,
      };
      vi.mocked(prisma.account.count).mockResolvedValue(1);
      vi.mocked(prisma.account.findMany).mockResolvedValue([bannedAccount]);

      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result.data[0].isBanned).toBe(true);
    });

    it('should handle users without user profile', async () => {
      const accountWithoutUser = {
        ...mockAccounts[0],
        user: null,
      };
      vi.mocked(prisma.account.count).mockResolvedValue(1);
      vi.mocked(prisma.account.findMany).mockResolvedValue([accountWithoutUser]);

      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result.data[0].name).toBeNull();
      expect(result.data[0].lastLoginAt).toBeNull();
    });
  });

  // ============================================
  // getUser Tests
  // ============================================
  describe('getUser', () => {
    const mockFullAccount = {
      id: 'user-123',
      email: 'test@example.com',
      tier: 'PRO' as Tier,
      monthlyCredits: 5000,
      usedCredits: 1500,
      stripeCustomerId: 'cus_test123',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-06-01'),
      lastResetAt: new Date('2024-06-01'),
      user: {
        id: 'auth-user-123',
        name: 'Test User',
        email: 'test@example.com',
        image: 'https://example.com/avatar.jpg',
        emailVerified: new Date('2024-01-02'),
        lastLoginAt: new Date('2024-06-15'),
        createdAt: new Date('2024-01-01'),
      },
      apiKeys: [
        {
          id: 'key-1',
          prefix: 'sc_test',
          name: 'Production Key',
          isActive: true,
          lastUsedAt: new Date('2024-06-14'),
          createdAt: new Date('2024-02-01'),
        },
      ],
      subscriptions: [{ status: 'ACTIVE' }],
    };

    beforeEach(() => {
      vi.mocked(prisma.screenshot.count).mockResolvedValue(50);
      vi.mocked(prisma.pdf.count).mockResolvedValue(25);
      vi.mocked(prisma.screenshot.findMany).mockResolvedValue([]);
      vi.mocked(prisma.pdf.findMany).mockResolvedValue([]);
    });

    it('should return full user details', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockFullAccount);

      const result = await service.getUser('user-123');

      expect(result).not.toBeNull();
      expect(result!.account.id).toBe('user-123');
      expect(result!.account.tier).toBe('PRO');
      expect(result!.user!.name).toBe('Test User');
    });

    it('should return null for non-existent user', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(null);

      const result = await service.getUser('non-existent');

      expect(result).toBeNull();
    });

    it('should include stats with correct counts', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockFullAccount);
      vi.mocked(prisma.screenshot.count).mockResolvedValue(150);
      vi.mocked(prisma.pdf.count).mockResolvedValue(75);

      const result = await service.getUser('user-123');

      expect(result!.stats).toEqual({
        totalScreenshots: 150,
        totalPdfs: 75,
        apiKeyCount: 1,
        hasActiveSubscription: true,
      });
    });

    it('should detect no active subscription', async () => {
      const accountNoSubscription = {
        ...mockFullAccount,
        subscriptions: [],
      };
      vi.mocked(prisma.account.findUnique).mockResolvedValue(accountNoSubscription);

      const result = await service.getUser('user-123');

      expect(result!.stats.hasActiveSubscription).toBe(false);
    });

    it('should handle user without profile', async () => {
      const accountWithoutProfile = {
        ...mockFullAccount,
        user: null,
      };
      vi.mocked(prisma.account.findUnique).mockResolvedValue(accountWithoutProfile);

      const result = await service.getUser('user-123');

      expect(result!.user).toBeNull();
    });

    it('should include recent activity', async () => {
      const recentScreenshots = [
        {
          id: 'ss-1',
          url: 'https://example.com',
          status: 'COMPLETED',
          createdAt: new Date(),
        },
      ];
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockFullAccount);
      vi.mocked(prisma.screenshot.findMany).mockResolvedValue(recentScreenshots);

      const result = await service.getUser('user-123');

      expect(result!.recentActivity.screenshots).toHaveLength(1);
      expect(prisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: 'user-123' },
          take: 5,
        })
      );
    });
  });

  // ============================================
  // updateUserTier Tests
  // ============================================
  describe('updateUserTier', () => {
    it('should update user to PRO tier with correct credits', async () => {
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.updateUserTier('user-123', 'PRO' as Tier, 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          tier: 'PRO',
          monthlyCredits: 5000,
        },
      });
    });

    it('should update user to BUSINESS tier with correct credits', async () => {
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.updateUserTier('user-123', 'BUSINESS' as Tier, 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          tier: 'BUSINESS',
          monthlyCredits: 25000,
        },
      });
    });

    it('should update user to ENTERPRISE tier with correct credits', async () => {
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.updateUserTier('user-123', 'ENTERPRISE' as Tier, 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          tier: 'ENTERPRISE',
          monthlyCredits: 100000,
        },
      });
    });

    it('should create audit log for tier update', async () => {
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.updateUserTier('user-123', 'PRO' as Tier, 'admin-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          accountId: 'user-123',
          action: 'UPDATE_USER_TIER',
          targetType: 'account',
          targetId: 'user-123',
          details: { newTier: 'PRO' },
        },
      });
    });
  });

  // ============================================
  // resetUserCredits Tests
  // ============================================
  describe('resetUserCredits', () => {
    it('should reset usedCredits to 0', async () => {
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.resetUserCredits('user-123', 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });

    it('should create audit log for credit reset', async () => {
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.resetUserCredits('user-123', 'admin-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          accountId: 'user-123',
          action: 'RESET_USER_CREDITS',
          targetType: 'account',
          targetId: 'user-123',
        },
      });
    });
  });

  // ============================================
  // addBonusCredits Tests
  // ============================================
  describe('addBonusCredits', () => {
    it('should increment monthly credits by specified amount', async () => {
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.addBonusCredits('user-123', 500, 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          monthlyCredits: { increment: 500 },
        },
      });
    });

    it('should create audit log with bonus amount', async () => {
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.addBonusCredits('user-123', 1000, 'admin-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          accountId: 'user-123',
          action: 'ADD_BONUS_CREDITS',
          targetType: 'account',
          targetId: 'user-123',
          details: { amount: 1000 },
        },
      });
    });
  });

  // ============================================
  // banUser Tests
  // ============================================
  describe('banUser', () => {
    it('should revoke all API keys', async () => {
      vi.mocked(prisma.apiKey.updateMany).mockResolvedValue({ count: 3 });
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.banUser('user-123', 'Violation of TOS', 'admin-1');

      expect(prisma.apiKey.updateMany).toHaveBeenCalledWith({
        where: { accountId: 'user-123' },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
    });

    it('should set credits to 0', async () => {
      vi.mocked(prisma.apiKey.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.banUser('user-123', 'Spam abuse', 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          monthlyCredits: 0,
          usedCredits: 0,
        },
      });
    });

    it('should create audit log with ban reason', async () => {
      vi.mocked(prisma.apiKey.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.banUser('user-123', 'API abuse detected', 'admin-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          accountId: 'user-123',
          action: 'BAN_USER',
          targetType: 'account',
          targetId: 'user-123',
          details: { reason: 'API abuse detected' },
        },
      });
    });
  });

  // ============================================
  // unbanUser Tests
  // ============================================
  describe('unbanUser', () => {
    it('should restore credits based on user tier (FREE)', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue({ tier: 'FREE' as Tier });
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.unbanUser('user-123', 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { monthlyCredits: 100 },
      });
    });

    it('should restore credits based on user tier (PRO)', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue({ tier: 'PRO' as Tier });
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.unbanUser('user-123', 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { monthlyCredits: 5000 },
      });
    });

    it('should restore credits based on user tier (BUSINESS)', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue({ tier: 'BUSINESS' as Tier });
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.unbanUser('user-123', 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { monthlyCredits: 25000 },
      });
    });

    it('should restore credits based on user tier (ENTERPRISE)', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue({ tier: 'ENTERPRISE' as Tier });
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.unbanUser('user-123', 'admin-1');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { monthlyCredits: 100000 },
      });
    });

    it('should throw error if account not found', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(null);

      await expect(service.unbanUser('non-existent', 'admin-1')).rejects.toThrow(
        'Account not found'
      );
    });

    it('should create audit log for unban', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue({ tier: 'FREE' as Tier });
      vi.mocked(prisma.account.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.unbanUser('user-123', 'admin-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          accountId: 'user-123',
          action: 'UNBAN_USER',
          targetType: 'account',
          targetId: 'user-123',
        },
      });
    });
  });

  // ============================================
  // deleteUser Tests
  // ============================================
  describe('deleteUser', () => {
    it('should delete the account', async () => {
      vi.mocked(prisma.account.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.deleteUser('user-123', 'admin-1');

      expect(prisma.account.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should create audit log for deletion', async () => {
      vi.mocked(prisma.account.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await service.deleteUser('user-123', 'admin-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: 'DELETE_USER',
          targetType: 'account',
          targetId: 'user-123',
        },
      });
    });

    it('should throw error if account does not exist', async () => {
      vi.mocked(prisma.account.delete).mockRejectedValue(
        new Error('Record to delete does not exist')
      );

      await expect(service.deleteUser('non-existent', 'admin-1')).rejects.toThrow();
    });
  });
});
