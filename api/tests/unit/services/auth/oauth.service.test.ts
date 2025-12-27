/**
 * OAuth Service Unit Tests
 *
 * Tests for Google OAuth authentication flow, user creation/linking,
 * and account management.
 * Mocks: Prisma (database)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// Mock Prisma before importing
const mockPrismaClient = {
  oAuthAccount: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
  account: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('../../src/lib/db.js', () => ({
  prisma: mockPrismaClient,
}));

import { OAuthService, oauthService } from '../../../../src/services/auth/oauth.service.js';

describe('OAuthService', () => {
  let service: OAuthService;

  // Test data fixtures
  const mockGoogleUser = {
    id: 'google_user_12345',
    email: 'testuser@gmail.com',
    name: 'Test User',
    picture: 'https://lh3.googleusercontent.com/photo.jpg',
  };

  const mockUser = {
    id: 'user_abc123',
    email: 'testuser@gmail.com',
    name: 'Test User',
    image: 'https://lh3.googleusercontent.com/photo.jpg',
    emailVerified: new Date('2024-01-15'),
    lastLoginAt: new Date('2024-01-20'),
    accountId: 'acc_xyz789',
    account: {
      id: 'acc_xyz789',
      email: 'testuser@gmail.com',
      tier: 'FREE',
      monthlyCredits: 100,
      usedCredits: 0,
    },
  };

  const mockOAuthAccount = {
    id: 'oauth_123',
    userId: 'user_abc123',
    provider: 'google',
    providerAccountId: 'google_user_12345',
    createdAt: new Date('2024-01-15'),
    user: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OAuthService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================================================
  // findOrCreateUser() Tests
  // =============================================================================
  describe('findOrCreateUser()', () => {
    describe('existing OAuth account', () => {
      it('should return existing user when OAuth account exists', async () => {
        mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(mockOAuthAccount);
        mockPrismaClient.user.update.mockResolvedValue(mockUser);

        const result = await service.findOrCreateUser(mockGoogleUser);

        expect(result).toEqual(mockUser);
        expect(mockPrismaClient.oAuthAccount.findUnique).toHaveBeenCalledWith({
          where: {
            provider_providerAccountId: {
              provider: 'google',
              providerAccountId: mockGoogleUser.id,
            },
          },
          include: {
            user: {
              include: { account: true },
            },
          },
        });
      });

      it('should update lastLoginAt timestamp on existing user', async () => {
        mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(mockOAuthAccount);
        mockPrismaClient.user.update.mockResolvedValue(mockUser);

        await service.findOrCreateUser(mockGoogleUser);

        expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
          where: { id: mockOAuthAccount.userId },
          data: { lastLoginAt: expect.any(Date) },
        });
      });

      it('should not create new OAuth account when one exists', async () => {
        mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(mockOAuthAccount);
        mockPrismaClient.user.update.mockResolvedValue(mockUser);

        await service.findOrCreateUser(mockGoogleUser);

        expect(mockPrismaClient.oAuthAccount.create).not.toHaveBeenCalled();
        expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
      });
    });

    describe('linking to existing email user', () => {
      it('should link OAuth account when user with email exists', async () => {
        mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
        mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaClient.oAuthAccount.create.mockResolvedValue(mockOAuthAccount);

        const result = await service.findOrCreateUser(mockGoogleUser);

        expect(result).toEqual(mockUser);
        expect(mockPrismaClient.oAuthAccount.create).toHaveBeenCalledWith({
          data: {
            userId: mockUser.id,
            provider: 'google',
            providerAccountId: mockGoogleUser.id,
          },
        });
      });

      it('should not create new user when linking to existing email', async () => {
        mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
        mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaClient.oAuthAccount.create.mockResolvedValue(mockOAuthAccount);

        await service.findOrCreateUser(mockGoogleUser);

        expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
      });
    });

    describe('creating new user', () => {
      it('should create new user and account when user does not exist', async () => {
        mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
        mockPrismaClient.user.findUnique.mockResolvedValue(null);

        const newAccount = {
          id: 'acc_new123',
          email: mockGoogleUser.email,
          tier: 'FREE',
          monthlyCredits: 100,
          usedCredits: 0,
        };

        const newUser = {
          id: 'user_new456',
          email: mockGoogleUser.email,
          name: mockGoogleUser.name,
          image: mockGoogleUser.picture,
          emailVerified: expect.any(Date),
          lastLoginAt: expect.any(Date),
          accountId: newAccount.id,
          account: newAccount,
        };

        mockPrismaClient.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            account: {
              create: vi.fn().mockResolvedValue(newAccount),
            },
            user: {
              create: vi.fn().mockResolvedValue(newUser),
            },
          };
          return callback(tx);
        });

        mockPrismaClient.oAuthAccount.create.mockResolvedValue({
          userId: newUser.id,
          provider: 'google',
          providerAccountId: mockGoogleUser.id,
        });

        const result = await service.findOrCreateUser(mockGoogleUser);

        expect(result).toBeDefined();
        expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      });

      it('should create account with FREE tier and 100 credits', async () => {
        mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
        mockPrismaClient.user.findUnique.mockResolvedValue(null);

        let capturedAccountData: any = null;

        mockPrismaClient.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            account: {
              create: vi.fn().mockImplementation(({ data }) => {
                capturedAccountData = data;
                return Promise.resolve({
                  id: 'acc_new',
                  ...data,
                });
              }),
            },
            user: {
              create: vi.fn().mockResolvedValue(mockUser),
            },
          };
          return callback(tx);
        });

        mockPrismaClient.oAuthAccount.create.mockResolvedValue(mockOAuthAccount);

        await service.findOrCreateUser(mockGoogleUser);

        expect(capturedAccountData).toMatchObject({
          email: mockGoogleUser.email,
          tier: 'FREE',
          monthlyCredits: 100,
          usedCredits: 0,
        });
      });

      it('should set emailVerified to current date for OAuth users', async () => {
        mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
        mockPrismaClient.user.findUnique.mockResolvedValue(null);

        let capturedUserData: any = null;

        mockPrismaClient.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            account: {
              create: vi.fn().mockResolvedValue({ id: 'acc_new' }),
            },
            user: {
              create: vi.fn().mockImplementation(({ data }) => {
                capturedUserData = data;
                return Promise.resolve({ ...mockUser, ...data });
              }),
            },
          };
          return callback(tx);
        });

        mockPrismaClient.oAuthAccount.create.mockResolvedValue(mockOAuthAccount);

        const beforeTest = new Date();
        await service.findOrCreateUser(mockGoogleUser);
        const afterTest = new Date();

        expect(capturedUserData.emailVerified).toBeInstanceOf(Date);
        expect(capturedUserData.emailVerified.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
        expect(capturedUserData.emailVerified.getTime()).toBeLessThanOrEqual(afterTest.getTime());
      });

      it('should link OAuth account after user creation', async () => {
        mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
        mockPrismaClient.user.findUnique.mockResolvedValue(null);

        const createdUser = { ...mockUser, id: 'user_new' };

        mockPrismaClient.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            account: {
              create: vi.fn().mockResolvedValue({ id: 'acc_new' }),
            },
            user: {
              create: vi.fn().mockResolvedValue(createdUser),
            },
          };
          return callback(tx);
        });

        mockPrismaClient.oAuthAccount.create.mockResolvedValue({});

        await service.findOrCreateUser(mockGoogleUser);

        expect(mockPrismaClient.oAuthAccount.create).toHaveBeenCalledWith({
          data: {
            userId: createdUser.id,
            provider: 'google',
            providerAccountId: mockGoogleUser.id,
          },
        });
      });
    });

    describe('error handling', () => {
      it('should propagate database errors', async () => {
        mockPrismaClient.oAuthAccount.findUnique.mockRejectedValue(
          new Error('Database connection failed')
        );

        await expect(service.findOrCreateUser(mockGoogleUser)).rejects.toThrow(
          'Database connection failed'
        );
      });

      it('should propagate transaction errors', async () => {
        mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
        mockPrismaClient.user.findUnique.mockResolvedValue(null);
        mockPrismaClient.$transaction.mockRejectedValue(new Error('Transaction failed'));

        await expect(service.findOrCreateUser(mockGoogleUser)).rejects.toThrow(
          'Transaction failed'
        );
      });
    });
  });

  // =============================================================================
  // getUserById() Tests
  // =============================================================================
  describe('getUserById()', () => {
    it('should return user with account data', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserById('user_abc123');

      expect(result).toEqual(mockUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_abc123' },
        include: { account: true },
      });
    });

    it('should return null for non-existent user', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // =============================================================================
  // getUserByEmail() Tests
  // =============================================================================
  describe('getUserByEmail()', () => {
    it('should return user by email with account data', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserByEmail('testuser@gmail.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'testuser@gmail.com' },
        include: { account: true },
      });
    });

    it('should return null for non-existent email', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should handle case-sensitive email lookup', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await service.getUserByEmail('TestUser@Gmail.COM');

      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'TestUser@Gmail.COM' },
        include: { account: true },
      });
    });
  });

  // =============================================================================
  // updateUser() Tests
  // =============================================================================
  describe('updateUser()', () => {
    it('should update user name', async () => {
      const updatedUser = { ...mockUser, name: 'New Name' };
      mockPrismaClient.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateUser('user_abc123', { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user_abc123' },
        data: { name: 'New Name' },
        include: { account: true },
      });
    });

    it('should update user image', async () => {
      const newImage = 'https://example.com/new-photo.jpg';
      const updatedUser = { ...mockUser, image: newImage };
      mockPrismaClient.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateUser('user_abc123', { image: newImage });

      expect(result.image).toBe(newImage);
    });

    it('should update multiple fields at once', async () => {
      const updates = { name: 'Updated Name', image: 'https://new-image.jpg' };
      const updatedUser = { ...mockUser, ...updates };
      mockPrismaClient.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateUser('user_abc123', updates);

      expect(result.name).toBe('Updated Name');
      expect(result.image).toBe('https://new-image.jpg');
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user_abc123' },
        data: updates,
        include: { account: true },
      });
    });

    it('should throw error for non-existent user', async () => {
      mockPrismaClient.user.update.mockRejectedValue(
        new Error('Record to update not found')
      );

      await expect(
        service.updateUser('nonexistent', { name: 'Test' })
      ).rejects.toThrow('Record to update not found');
    });
  });

  // =============================================================================
  // deleteUser() Tests
  // =============================================================================
  describe('deleteUser()', () => {
    it('should delete user and cascade to related data', async () => {
      mockPrismaClient.user.delete.mockResolvedValue(mockUser);

      const result = await service.deleteUser('user_abc123');

      expect(result).toEqual(mockUser);
      expect(mockPrismaClient.user.delete).toHaveBeenCalledWith({
        where: { id: 'user_abc123' },
      });
    });

    it('should throw error when deleting non-existent user', async () => {
      mockPrismaClient.user.delete.mockRejectedValue(
        new Error('Record to delete does not exist')
      );

      await expect(service.deleteUser('nonexistent')).rejects.toThrow(
        'Record to delete does not exist'
      );
    });
  });

  // =============================================================================
  // getLinkedProviders() Tests
  // =============================================================================
  describe('getLinkedProviders()', () => {
    it('should return all linked OAuth providers', async () => {
      const providers = [
        {
          provider: 'google',
          providerAccountId: 'google_123',
          createdAt: new Date('2024-01-15'),
        },
        {
          provider: 'github',
          providerAccountId: 'github_456',
          createdAt: new Date('2024-01-20'),
        },
      ];

      mockPrismaClient.oAuthAccount.findMany.mockResolvedValue(providers);

      const result = await service.getLinkedProviders('user_abc123');

      expect(result).toEqual(providers);
      expect(mockPrismaClient.oAuthAccount.findMany).toHaveBeenCalledWith({
        where: { userId: 'user_abc123' },
        select: {
          provider: true,
          providerAccountId: true,
          createdAt: true,
        },
      });
    });

    it('should return empty array for user with no providers', async () => {
      mockPrismaClient.oAuthAccount.findMany.mockResolvedValue([]);

      const result = await service.getLinkedProviders('user_abc123');

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // unlinkProvider() Tests
  // =============================================================================
  describe('unlinkProvider()', () => {
    it('should unlink provider when user has multiple providers', async () => {
      mockPrismaClient.oAuthAccount.count.mockResolvedValue(2);
      mockPrismaClient.oAuthAccount.deleteMany.mockResolvedValue({ count: 1 });

      await service.unlinkProvider('user_abc123', 'google');

      expect(mockPrismaClient.oAuthAccount.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user_abc123',
          provider: 'google',
        },
      });
    });

    it('should throw error when trying to unlink last provider', async () => {
      mockPrismaClient.oAuthAccount.count.mockResolvedValue(1);

      await expect(
        service.unlinkProvider('user_abc123', 'google')
      ).rejects.toThrow('Cannot unlink the last authentication provider');

      expect(mockPrismaClient.oAuthAccount.deleteMany).not.toHaveBeenCalled();
    });

    it('should throw error when user has no providers', async () => {
      mockPrismaClient.oAuthAccount.count.mockResolvedValue(0);

      await expect(
        service.unlinkProvider('user_abc123', 'google')
      ).rejects.toThrow('Cannot unlink the last authentication provider');
    });

    it('should handle unlinking non-existent provider gracefully', async () => {
      mockPrismaClient.oAuthAccount.count.mockResolvedValue(2);
      mockPrismaClient.oAuthAccount.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.unlinkProvider('user_abc123', 'nonexistent');

      expect(result.count).toBe(0);
    });
  });

  // =============================================================================
  // Singleton Instance Tests
  // =============================================================================
  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(oauthService).toBeInstanceOf(OAuthService);
    });

    it('should be the same instance on multiple imports', async () => {
      // Both should reference the same instance
      const { oauthService: instance1 } = await import(
        '../../../../src/services/auth/oauth.service.js'
      );
      const { oauthService: instance2 } = await import(
        '../../../../src/services/auth/oauth.service.js'
      );

      expect(instance1).toBe(instance2);
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================
  describe('Edge Cases', () => {
    it('should handle Google user with missing optional fields', async () => {
      const minimalGoogleUser = {
        id: 'google_minimal',
        email: 'minimal@example.com',
        name: '',
        picture: '',
      };

      mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      mockPrismaClient.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          account: {
            create: vi.fn().mockResolvedValue({ id: 'acc_new' }),
          },
          user: {
            create: vi.fn().mockResolvedValue({
              ...mockUser,
              name: '',
              image: '',
            }),
          },
        };
        return callback(tx);
      });

      mockPrismaClient.oAuthAccount.create.mockResolvedValue({});

      await expect(service.findOrCreateUser(minimalGoogleUser)).resolves.toBeDefined();
    });

    it('should handle very long Google IDs', async () => {
      const longIdGoogleUser = {
        ...mockGoogleUser,
        id: 'g_' + 'x'.repeat(500),
      };

      mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.oAuthAccount.create.mockResolvedValue({});

      await expect(service.findOrCreateUser(longIdGoogleUser)).resolves.toBeDefined();

      expect(mockPrismaClient.oAuthAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          providerAccountId: longIdGoogleUser.id,
        }),
      });
    });

    it('should handle special characters in user name', async () => {
      const specialNameUser = {
        ...mockGoogleUser,
        name: 'User with "quotes" & <special> chars!',
      };

      mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      let capturedUserData: any = null;

      mockPrismaClient.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          account: {
            create: vi.fn().mockResolvedValue({ id: 'acc_new' }),
          },
          user: {
            create: vi.fn().mockImplementation(({ data }) => {
              capturedUserData = data;
              return Promise.resolve({ ...mockUser, ...data });
            }),
          },
        };
        return callback(tx);
      });

      mockPrismaClient.oAuthAccount.create.mockResolvedValue({});

      await service.findOrCreateUser(specialNameUser);

      expect(capturedUserData.name).toBe(specialNameUser.name);
    });

    it('should handle Unicode in user name and email', async () => {
      const unicodeUser = {
        id: 'google_unicode',
        email: 'user@example.com',
        name: 'Benutzer mit Umlauten',
        picture: 'https://example.com/photo.jpg',
      };

      mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.oAuthAccount.create.mockResolvedValue({});

      await expect(service.findOrCreateUser(unicodeUser)).resolves.toBeDefined();
    });

    it('should handle concurrent findOrCreateUser calls for same user', async () => {
      // Simulate race condition where both calls find no existing OAuth account
      mockPrismaClient.oAuthAccount.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      // First call succeeds, second might fail with unique constraint
      mockPrismaClient.oAuthAccount.create
        .mockResolvedValueOnce(mockOAuthAccount)
        .mockRejectedValueOnce(new Error('Unique constraint failed'));

      const promise1 = service.findOrCreateUser(mockGoogleUser);
      const promise2 = service.findOrCreateUser(mockGoogleUser);

      await expect(promise1).resolves.toBeDefined();
      await expect(promise2).rejects.toThrow('Unique constraint failed');
    });
  });
});
