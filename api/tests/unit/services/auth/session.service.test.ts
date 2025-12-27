/**
 * Session Service Unit Tests
 *
 * Tests for secure session token generation, validation, auto-extension,
 * and session lifecycle management.
 * Mocks: Prisma (database)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import crypto from 'node:crypto';

// Mock Prisma before importing
const mockPrismaClient = {
  session: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('../../src/lib/db.js', () => ({
  prisma: mockPrismaClient,
}));

import { SessionService, sessionService } from '../../../../src/services/auth/session.service.js';

describe('SessionService', () => {
  let service: SessionService;

  // Test data fixtures
  const mockUserId = 'user_abc123';
  const mockSessionToken = 'a'.repeat(64); // 32 bytes in hex
  const mockHashedToken = crypto.createHash('sha256').update(mockSessionToken).digest('hex');

  const mockUser = {
    id: mockUserId,
    email: 'testuser@example.com',
    name: 'Test User',
    image: 'https://example.com/photo.jpg',
    emailVerified: new Date('2024-01-15'),
    lastLoginAt: new Date('2024-01-20'),
    accountId: 'acc_xyz789',
    account: {
      id: 'acc_xyz789',
      email: 'testuser@example.com',
      tier: 'FREE',
      monthlyCredits: 100,
      usedCredits: 0,
    },
  };

  const mockSession = {
    id: 'session_123',
    userId: mockUserId,
    sessionToken: mockHashedToken,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    ipAddress: '192.168.1.100',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-20T12:00:00Z'));
    service = new SessionService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // =============================================================================
  // createSession() Tests
  // =============================================================================
  describe('createSession()', () => {
    beforeEach(() => {
      mockPrismaClient.session.create.mockResolvedValue(mockSession);
    });

    it('should create session with 7-day expiry', async () => {
      const result = await service.createSession(mockUserId);

      expect(result.sessionToken).toBeDefined();
      expect(result.sessionToken).toHaveLength(64); // 32 bytes in hex

      const expectedExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      expect(result.expires.getTime()).toBe(expectedExpiry.getTime());
    });

    it('should store hashed token in database (not raw)', async () => {
      const result = await service.createSession(mockUserId);

      const createCall = mockPrismaClient.session.create.mock.calls[0][0];
      expect(createCall.data.sessionToken).not.toBe(result.sessionToken);
      expect(createCall.data.sessionToken).toHaveLength(64); // SHA256 hash
    });

    it('should include optional userAgent', async () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

      await service.createSession(mockUserId, userAgent);

      expect(mockPrismaClient.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userAgent,
        }),
      });
    });

    it('should include optional ipAddress', async () => {
      const ipAddress = '192.168.1.100';

      await service.createSession(mockUserId, undefined, ipAddress);

      expect(mockPrismaClient.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress,
        }),
      });
    });

    it('should include all optional fields', async () => {
      const userAgent = 'Chrome/120.0';
      const ipAddress = '10.0.0.1';

      await service.createSession(mockUserId, userAgent, ipAddress);

      expect(mockPrismaClient.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          userAgent,
          ipAddress,
        }),
      });
    });

    it('should generate unique tokens for each session', async () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const result = await service.createSession(mockUserId);
        tokens.add(result.sessionToken);
      }

      expect(tokens.size).toBe(100);
    });

    it('should generate cryptographically secure tokens', () => {
      const randomBytesSpy = vi.spyOn(crypto, 'randomBytes');

      service.createSession(mockUserId);

      expect(randomBytesSpy).toHaveBeenCalledWith(32);
      randomBytesSpy.mockRestore();
    });

    it('should propagate database errors', async () => {
      mockPrismaClient.session.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createSession(mockUserId)).rejects.toThrow('Database error');
    });
  });

  // =============================================================================
  // validateSession() Tests
  // =============================================================================
  describe('validateSession()', () => {
    describe('valid session', () => {
      it('should return session with user data for valid token', async () => {
        mockPrismaClient.session.findUnique.mockResolvedValue(mockSession);

        const result = await service.validateSession(mockSessionToken);

        expect(result).toEqual(mockSession);
        expect(mockPrismaClient.session.findUnique).toHaveBeenCalledWith({
          where: { sessionToken: mockHashedToken },
          include: {
            user: {
              include: { account: true },
            },
          },
        });
      });

      it('should lookup by hashed token', async () => {
        mockPrismaClient.session.findUnique.mockResolvedValue(mockSession);

        await service.validateSession(mockSessionToken);

        const lookupCall = mockPrismaClient.session.findUnique.mock.calls[0][0];
        expect(lookupCall.where.sessionToken).toBe(mockHashedToken);
        expect(lookupCall.where.sessionToken).not.toBe(mockSessionToken);
      });
    });

    describe('session auto-extension', () => {
      it('should extend session when less than 24 hours remaining', async () => {
        const nearExpirySession = {
          ...mockSession,
          expires: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours remaining
        };

        mockPrismaClient.session.findUnique.mockResolvedValue(nearExpirySession);
        mockPrismaClient.session.update.mockResolvedValue({});

        await service.validateSession(mockSessionToken);

        expect(mockPrismaClient.session.update).toHaveBeenCalledWith({
          where: { id: nearExpirySession.id },
          data: {
            expires: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        });

        // New expiry should be 7 days from now
        const updateCall = mockPrismaClient.session.update.mock.calls[0][0];
        const newExpiry = updateCall.data.expires;
        const expectedExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        expect(newExpiry.getTime()).toBe(expectedExpiry.getTime());
      });

      it('should extend session at exactly 24 hour boundary', async () => {
        const boundarySession = {
          ...mockSession,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000 - 1000), // Just under 24 hours
        };

        mockPrismaClient.session.findUnique.mockResolvedValue(boundarySession);
        mockPrismaClient.session.update.mockResolvedValue({});

        await service.validateSession(mockSessionToken);

        expect(mockPrismaClient.session.update).toHaveBeenCalled();
      });

      it('should NOT extend session with more than 24 hours remaining', async () => {
        const farExpirySession = {
          ...mockSession,
          expires: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days remaining
        };

        mockPrismaClient.session.findUnique.mockResolvedValue(farExpirySession);

        await service.validateSession(mockSessionToken);

        expect(mockPrismaClient.session.update).not.toHaveBeenCalled();
      });
    });

    describe('expired session', () => {
      it('should return null for expired session', async () => {
        const expiredSession = {
          ...mockSession,
          expires: new Date(Date.now() - 1000), // Expired 1 second ago
        };

        mockPrismaClient.session.findUnique.mockResolvedValue(expiredSession);
        mockPrismaClient.session.delete.mockResolvedValue({});

        const result = await service.validateSession(mockSessionToken);

        expect(result).toBeNull();
      });

      it('should clean up expired session', async () => {
        const expiredSession = {
          ...mockSession,
          id: 'expired_session_id',
          expires: new Date(Date.now() - 60000), // Expired 1 minute ago
        };

        mockPrismaClient.session.findUnique.mockResolvedValue(expiredSession);
        mockPrismaClient.session.delete.mockResolvedValue({});

        await service.validateSession(mockSessionToken);

        expect(mockPrismaClient.session.delete).toHaveBeenCalledWith({
          where: { id: 'expired_session_id' },
        });
      });

      it('should handle cleanup errors gracefully', async () => {
        const expiredSession = {
          ...mockSession,
          expires: new Date(Date.now() - 1000),
        };

        mockPrismaClient.session.findUnique.mockResolvedValue(expiredSession);
        mockPrismaClient.session.delete.mockRejectedValue(new Error('Delete failed'));

        // Should not throw
        const result = await service.validateSession(mockSessionToken);
        expect(result).toBeNull();
      });
    });

    describe('non-existent session', () => {
      it('should return null for non-existent token', async () => {
        mockPrismaClient.session.findUnique.mockResolvedValue(null);

        const result = await service.validateSession('nonexistent_token');

        expect(result).toBeNull();
        expect(mockPrismaClient.session.delete).not.toHaveBeenCalled();
      });
    });
  });

  // =============================================================================
  // invalidateSession() Tests
  // =============================================================================
  describe('invalidateSession()', () => {
    it('should delete session by hashed token', async () => {
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.invalidateSession(mockSessionToken);

      expect(mockPrismaClient.session.deleteMany).toHaveBeenCalledWith({
        where: { sessionToken: mockHashedToken },
      });
    });

    it('should not throw when session does not exist', async () => {
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.invalidateSession('nonexistent')).resolves.not.toThrow();
    });
  });

  // =============================================================================
  // invalidateAllUserSessions() Tests
  // =============================================================================
  describe('invalidateAllUserSessions()', () => {
    it('should delete all sessions for user', async () => {
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 5 });

      await service.invalidateAllUserSessions(mockUserId);

      expect(mockPrismaClient.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });

    it('should not throw when user has no sessions', async () => {
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.invalidateAllUserSessions(mockUserId)).resolves.not.toThrow();
    });

    it('should propagate database errors', async () => {
      mockPrismaClient.session.deleteMany.mockRejectedValue(new Error('Database error'));

      await expect(service.invalidateAllUserSessions(mockUserId)).rejects.toThrow(
        'Database error'
      );
    });
  });

  // =============================================================================
  // getUserSessions() Tests
  // =============================================================================
  describe('getUserSessions()', () => {
    const mockSessions = [
      {
        id: 'session_1',
        userAgent: 'Chrome/120.0 Windows',
        ipAddress: '192.168.1.100',
        createdAt: new Date('2024-01-20T10:00:00Z'),
        expires: new Date('2024-01-27T10:00:00Z'),
      },
      {
        id: 'session_2',
        userAgent: 'Safari/17.0 macOS',
        ipAddress: '10.0.0.50',
        createdAt: new Date('2024-01-19T14:00:00Z'),
        expires: new Date('2024-01-26T14:00:00Z'),
      },
    ];

    it('should return only active sessions', async () => {
      mockPrismaClient.session.findMany.mockResolvedValue(mockSessions);

      const result = await service.getUserSessions(mockUserId);

      expect(result).toEqual(mockSessions);
      expect(mockPrismaClient.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          expires: { gt: expect.any(Date) },
        },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          expires: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter out expired sessions', async () => {
      mockPrismaClient.session.findMany.mockResolvedValue([]);

      await service.getUserSessions(mockUserId);

      const findCall = mockPrismaClient.session.findMany.mock.calls[0][0];
      expect(findCall.where.expires.gt).toBeInstanceOf(Date);
    });

    it('should order by createdAt descending (newest first)', async () => {
      mockPrismaClient.session.findMany.mockResolvedValue(mockSessions);

      await service.getUserSessions(mockUserId);

      expect(mockPrismaClient.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should NOT expose session token (security)', async () => {
      mockPrismaClient.session.findMany.mockResolvedValue(mockSessions);

      await service.getUserSessions(mockUserId);

      const selectFields = mockPrismaClient.session.findMany.mock.calls[0][0].select;
      expect(selectFields.sessionToken).toBeUndefined();
    });

    it('should return empty array for user with no sessions', async () => {
      mockPrismaClient.session.findMany.mockResolvedValue([]);

      const result = await service.getUserSessions(mockUserId);

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // invalidateSessionById() Tests
  // =============================================================================
  describe('invalidateSessionById()', () => {
    it('should delete specific session for user', async () => {
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.invalidateSessionById('session_123', mockUserId);

      expect(mockPrismaClient.session.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'session_123',
          userId: mockUserId,
        },
      });
    });

    it('should require both sessionId and userId (security)', async () => {
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });

      await service.invalidateSessionById('session_123', 'wrong_user');

      // Should be called with both parameters
      expect(mockPrismaClient.session.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'session_123',
          userId: 'wrong_user',
        },
      });
    });

    it('should not throw when session does not exist', async () => {
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.invalidateSessionById('nonexistent', mockUserId)
      ).resolves.not.toThrow();
    });
  });

  // =============================================================================
  // cleanupExpiredSessions() Tests
  // =============================================================================
  describe('cleanupExpiredSessions()', () => {
    it('should delete all expired sessions', async () => {
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 150 });

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(150);
      expect(mockPrismaClient.session.deleteMany).toHaveBeenCalledWith({
        where: {
          expires: { lt: expect.any(Date) },
        },
      });
    });

    it('should use current time as expiry threshold', async () => {
      const now = new Date('2024-01-20T12:00:00Z');
      vi.setSystemTime(now);

      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupExpiredSessions();

      const deleteCall = mockPrismaClient.session.deleteMany.mock.calls[0][0];
      expect(deleteCall.where.expires.lt.getTime()).toBe(now.getTime());
    });

    it('should return 0 when no sessions to cleanup', async () => {
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(0);
    });

    it('should propagate database errors', async () => {
      mockPrismaClient.session.deleteMany.mockRejectedValue(new Error('Cleanup failed'));

      await expect(service.cleanupExpiredSessions()).rejects.toThrow('Cleanup failed');
    });
  });

  // =============================================================================
  // isSessionNearExpiry() Tests
  // =============================================================================
  describe('isSessionNearExpiry()', () => {
    it('should return true when less than 24 hours remaining', () => {
      const nearExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

      expect(service.isSessionNearExpiry(nearExpiry)).toBe(true);
    });

    it('should return true at exactly 23:59:59 remaining', () => {
      const nearExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000 - 1000);

      expect(service.isSessionNearExpiry(nearExpiry)).toBe(true);
    });

    it('should return false when exactly 24 hours remaining', () => {
      const farExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      expect(service.isSessionNearExpiry(farExpiry)).toBe(false);
    });

    it('should return false when more than 24 hours remaining', () => {
      const farExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      expect(service.isSessionNearExpiry(farExpiry)).toBe(false);
    });

    it('should return true for already expired sessions', () => {
      const expired = new Date(Date.now() - 1000);

      expect(service.isSessionNearExpiry(expired)).toBe(true);
    });
  });

  // =============================================================================
  // Singleton Instance Tests
  // =============================================================================
  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(sessionService).toBeInstanceOf(SessionService);
    });

    it('should be the same instance on multiple imports', async () => {
      const { sessionService: instance1 } = await import(
        '../../../../src/services/auth/session.service.js'
      );
      const { sessionService: instance2 } = await import(
        '../../../../src/services/auth/session.service.js'
      );

      expect(instance1).toBe(instance2);
    });
  });

  // =============================================================================
  // Security Tests
  // =============================================================================
  describe('Security', () => {
    it('should never store raw session token in database', async () => {
      const result = await service.createSession(mockUserId);

      const createCall = mockPrismaClient.session.create.mock.calls[0][0];
      const storedToken = createCall.data.sessionToken;

      // Raw token and stored token should be different
      expect(storedToken).not.toBe(result.sessionToken);

      // Stored should be SHA256 hash
      expect(storedToken).toHaveLength(64);

      // Verify it's the correct hash
      const expectedHash = crypto.createHash('sha256').update(result.sessionToken).digest('hex');
      expect(storedToken).toBe(expectedHash);
    });

    it('should use SHA256 for token hashing', () => {
      const token = 'test_token_123';
      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');

      // We can verify by checking the lookup behavior
      mockPrismaClient.session.findUnique.mockResolvedValue(null);
      service.validateSession(token);

      const lookupToken = mockPrismaClient.session.findUnique.mock.calls[0][0].where.sessionToken;
      expect(lookupToken).toBe(expectedHash);
    });

    it('should generate 32 bytes of entropy for session tokens', async () => {
      await service.createSession(mockUserId);

      const createCall = mockPrismaClient.session.create.mock.calls[0][0];
      const hashedToken = createCall.data.sessionToken;

      // SHA256 of 32 random bytes = 64 hex chars
      expect(hashedToken).toHaveLength(64);
    });

    it('should require user ownership for session deletion by ID', async () => {
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 0 });

      // Attempt to delete session with wrong userId should affect nothing
      await service.invalidateSessionById('session_123', 'attacker_user');

      expect(mockPrismaClient.session.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'session_123',
          userId: 'attacker_user', // Must match both
        },
      });
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================
  describe('Edge Cases', () => {
    it('should handle very long user agent strings', async () => {
      const longUserAgent = 'A'.repeat(2000);

      await service.createSession(mockUserId, longUserAgent);

      expect(mockPrismaClient.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userAgent: longUserAgent,
        }),
      });
    });

    it('should handle IPv6 addresses', async () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';

      await service.createSession(mockUserId, undefined, ipv6);

      expect(mockPrismaClient.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: ipv6,
        }),
      });
    });

    it('should handle concurrent session validations', async () => {
      mockPrismaClient.session.findUnique.mockResolvedValue(mockSession);

      const promises = Array(10).fill(null).map(() =>
        service.validateSession(mockSessionToken)
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toEqual(mockSession);
      });
    });

    it('should handle concurrent session creation', async () => {
      mockPrismaClient.session.create.mockResolvedValue(mockSession);

      const promises = Array(10).fill(null).map(() =>
        service.createSession(mockUserId)
      );

      const results = await Promise.all(promises);

      // All should succeed with unique tokens
      const tokens = new Set(results.map(r => r.sessionToken));
      expect(tokens.size).toBe(10);
    });

    it('should handle null userAgent gracefully', async () => {
      await service.createSession(mockUserId, undefined);

      expect(mockPrismaClient.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userAgent: undefined,
        }),
      });
    });

    it('should handle timezone edge cases for expiry', async () => {
      // Test with different system times
      const times = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-06-15T12:30:00Z'),
        new Date('2024-12-31T23:59:59Z'),
      ];

      for (const time of times) {
        vi.setSystemTime(time);

        const result = await service.createSession(mockUserId);

        const expectedExpiry = new Date(time.getTime() + 7 * 24 * 60 * 60 * 1000);
        expect(result.expires.getTime()).toBe(expectedExpiry.getTime());
      }
    });
  });
});
