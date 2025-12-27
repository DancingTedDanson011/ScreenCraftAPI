/**
 * Session Middleware Unit Tests
 *
 * Tests for session authentication, tier validation, and credit checking middleware
 * Covers: session validation, tier requirements, credit requirements, error responses
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { User, Account, Tier } from '@prisma/client';

// Mock the session service
vi.mock('../../../src/services/auth/session.service.js', () => ({
  sessionService: {
    validateSession: vi.fn(),
  },
}));

// Mock the auth config
vi.mock('../../../src/config/auth.config.js', () => ({
  authConfig: {
    session: {
      cookieName: 'screencraft_session',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secret: 'test-secret',
    },
    google: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      callbackUrl: 'http://localhost:3000/callback',
    },
    frontendUrl: 'http://localhost:4321',
  },
}));

// Import after mocking
import {
  sessionMiddleware,
  optionalSessionMiddleware,
  requireTier,
  requireCredits,
} from '../../../src/middleware/session.middleware.js';
import { sessionService } from '../../../src/services/auth/session.service.js';
import { authConfig } from '../../../src/config/auth.config.js';

// Mock user fixture
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  avatar: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  accountId: 'account-456',
};

// Mock account fixtures for different tiers
const mockFreeAccount: Account = {
  id: 'account-456',
  email: 'test@example.com',
  tier: 'FREE' as Tier,
  monthlyCredits: 1000,
  usedCredits: 100,
  lastResetAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockProAccount: Account = {
  ...mockFreeAccount,
  tier: 'PRO' as Tier,
  monthlyCredits: 50000,
  usedCredits: 5000,
};

const mockBusinessAccount: Account = {
  ...mockFreeAccount,
  tier: 'BUSINESS' as Tier,
  monthlyCredits: 250000,
  usedCredits: 10000,
};

const mockEnterpriseAccount: Account = {
  ...mockFreeAccount,
  tier: 'ENTERPRISE' as Tier,
  monthlyCredits: -1,
  usedCredits: 100000,
};

// Mock session with user and account
interface MockSession {
  id: string;
  userId: string;
  sessionToken: string;
  expires: Date;
  user: User & { account: Account | null };
}

const createMockSession = (account: Account | null = mockFreeAccount): MockSession => ({
  id: 'session-789',
  userId: mockUser.id,
  sessionToken: 'hashed-token',
  expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  user: { ...mockUser, account },
});

// Helper to create mock Fastify request with cookies
function createMockRequest(
  cookies: Record<string, string> = {},
  overrides: Partial<FastifyRequest> = {}
): FastifyRequest {
  return {
    cookies,
    headers: {},
    user: undefined,
    account: undefined,
    ...overrides,
  } as unknown as FastifyRequest;
}

// Helper to create mock Fastify reply with chainable methods
function createMockReply(): FastifyReply & {
  _statusCode: number | null;
  _sentPayload: unknown;
  _clearedCookies: Array<{ name: string; options: any }>;
} {
  const reply = {
    _statusCode: null as number | null,
    _sentPayload: undefined as unknown,
    _clearedCookies: [] as Array<{ name: string; options: any }>,
    status: vi.fn().mockImplementation(function (this: typeof reply, code: number) {
      this._statusCode = code;
      return this;
    }),
    send: vi.fn().mockImplementation(function (this: typeof reply, payload: unknown) {
      this._sentPayload = payload;
      return this;
    }),
    clearCookie: vi.fn().mockImplementation(function (
      this: typeof reply,
      name: string,
      options: any
    ) {
      this._clearedCookies.push({ name, options });
      return this;
    }),
  };
  return reply as unknown as FastifyReply & {
    _statusCode: number | null;
    _sentPayload: unknown;
    _clearedCookies: Array<{ name: string; options: any }>;
  };
}

describe('sessionMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('No Session Cookie', () => {
    it('should return 401 when session cookie is missing', async () => {
      const request = createMockRequest({});
      const reply = createMockReply();

      await sessionMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'NO_SESSION',
        message: 'Please log in to access this resource',
      });
    });

    it('should return 401 when session cookie is empty string', async () => {
      const request = createMockRequest({ [authConfig.session.cookieName]: '' });
      const reply = createMockReply();

      await sessionMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply._sentPayload).toEqual({
        error: 'Authentication required',
        code: 'NO_SESSION',
        message: 'Please log in to access this resource',
      });
    });
  });

  describe('Invalid Session', () => {
    it('should return 401 and clear cookie when session is invalid', async () => {
      (sessionService.validateSession as Mock).mockResolvedValue(null);

      const request = createMockRequest({ [authConfig.session.cookieName]: 'invalid-token' });
      const reply = createMockReply();

      await sessionMiddleware(request, reply);

      expect(sessionService.validateSession).toHaveBeenCalledWith('invalid-token');
      expect(reply.clearCookie).toHaveBeenCalledWith(authConfig.session.cookieName, { path: '/' });
      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Session expired',
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please log in again.',
      });
    });

    it('should return 401 for expired session token', async () => {
      (sessionService.validateSession as Mock).mockResolvedValue(null);

      const request = createMockRequest({ [authConfig.session.cookieName]: 'expired-token' });
      const reply = createMockReply();

      await sessionMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply._sentPayload).toMatchObject({
        code: 'SESSION_EXPIRED',
      });
    });
  });

  describe('Valid Session', () => {
    it('should attach user and account to request on valid session', async () => {
      const mockSession = createMockSession(mockProAccount);
      (sessionService.validateSession as Mock).mockResolvedValue(mockSession);

      const request = createMockRequest({ [authConfig.session.cookieName]: 'valid-token' });
      const reply = createMockReply();

      await sessionMiddleware(request, reply);

      expect(sessionService.validateSession).toHaveBeenCalledWith('valid-token');
      expect(request.user).toEqual(mockSession.user);
      expect(request.account).toEqual(mockProAccount);
      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should handle user with null account', async () => {
      const mockSession = createMockSession(null);
      (sessionService.validateSession as Mock).mockResolvedValue(mockSession);

      const request = createMockRequest({ [authConfig.session.cookieName]: 'valid-token' });
      const reply = createMockReply();

      await sessionMiddleware(request, reply);

      expect(request.user).toEqual(mockSession.user);
      expect(request.account).toBeNull();
    });

    it('should work with all tier types', async () => {
      const tiers = [mockFreeAccount, mockProAccount, mockBusinessAccount, mockEnterpriseAccount];

      for (const account of tiers) {
        vi.clearAllMocks();
        const mockSession = createMockSession(account);
        (sessionService.validateSession as Mock).mockResolvedValue(mockSession);

        const request = createMockRequest({ [authConfig.session.cookieName]: 'valid-token' });
        const reply = createMockReply();

        await sessionMiddleware(request, reply);

        expect(request.account?.tier).toBe(account.tier);
      }
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors', async () => {
      (sessionService.validateSession as Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({ [authConfig.session.cookieName]: 'valid-token' });
      const reply = createMockReply();

      await expect(sessionMiddleware(request, reply)).rejects.toThrow('Database error');
    });
  });
});

describe('optionalSessionMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('No Session Cookie', () => {
    it('should continue without error when session cookie is missing', async () => {
      const request = createMockRequest({});
      const reply = createMockReply();

      await optionalSessionMiddleware(request, reply);

      expect(sessionService.validateSession).not.toHaveBeenCalled();
      expect(request.user).toBeUndefined();
      expect(request.account).toBeUndefined();
      expect(reply.status).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Session', () => {
    it('should continue without user data when session is invalid', async () => {
      (sessionService.validateSession as Mock).mockResolvedValue(null);

      const request = createMockRequest({ [authConfig.session.cookieName]: 'invalid-token' });
      const reply = createMockReply();

      await optionalSessionMiddleware(request, reply);

      expect(request.user).toBeUndefined();
      expect(request.account).toBeUndefined();
      expect(reply.clearCookie).not.toHaveBeenCalled();
    });
  });

  describe('Valid Session', () => {
    it('should attach user and account when session is valid', async () => {
      const mockSession = createMockSession(mockProAccount);
      (sessionService.validateSession as Mock).mockResolvedValue(mockSession);

      const request = createMockRequest({ [authConfig.session.cookieName]: 'valid-token' });
      const reply = createMockReply();

      await optionalSessionMiddleware(request, reply);

      expect(request.user).toEqual(mockSession.user);
      expect(request.account).toEqual(mockProAccount);
    });
  });
});

describe('requireTier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('No Account', () => {
    it('should return 403 when account is not attached to request', async () => {
      const tierMiddleware = requireTier('PRO', 'BUSINESS');
      const request = createMockRequest({});
      const reply = createMockReply();

      await tierMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'No account found',
        code: 'NO_ACCOUNT',
        message: 'You need an account to access this resource',
      });
    });

    it('should return 403 when account is null', async () => {
      const tierMiddleware = requireTier('BUSINESS');
      const request = createMockRequest({});
      (request as any).account = null;
      const reply = createMockReply();

      await tierMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply._sentPayload).toMatchObject({ code: 'NO_ACCOUNT' });
    });
  });

  describe('Tier Validation', () => {
    it('should allow access when user tier is in allowed tiers', async () => {
      const tierMiddleware = requireTier('PRO', 'BUSINESS', 'ENTERPRISE');
      const request = createMockRequest({});
      (request as any).account = mockProAccount;
      const reply = createMockReply();

      await tierMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should return 403 when user tier is not in allowed tiers', async () => {
      const tierMiddleware = requireTier('BUSINESS', 'ENTERPRISE');
      const request = createMockRequest({});
      (request as any).account = mockFreeAccount;
      const reply = createMockReply();

      await tierMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Insufficient tier',
        code: 'TIER_REQUIRED',
        message: 'This feature requires one of the following tiers: BUSINESS, ENTERPRISE',
        currentTier: 'FREE',
        requiredTiers: ['BUSINESS', 'ENTERPRISE'],
      });
    });

    it('should work with single tier requirement', async () => {
      const tierMiddleware = requireTier('ENTERPRISE');
      const request = createMockRequest({});
      (request as any).account = mockBusinessAccount;
      const reply = createMockReply();

      await tierMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply._sentPayload).toMatchObject({
        requiredTiers: ['ENTERPRISE'],
        currentTier: 'BUSINESS',
      });
    });

    it('should allow ENTERPRISE tier for ENTERPRISE-only feature', async () => {
      const tierMiddleware = requireTier('ENTERPRISE');
      const request = createMockRequest({});
      (request as any).account = mockEnterpriseAccount;
      const reply = createMockReply();

      await tierMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should allow PRO tier for PRO feature', async () => {
      const tierMiddleware = requireTier('PRO');
      const request = createMockRequest({});
      (request as any).account = mockProAccount;
      const reply = createMockReply();

      await tierMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should handle case-sensitive tier matching', async () => {
      const tierMiddleware = requireTier('PRO');
      const request = createMockRequest({});
      (request as any).account = { ...mockProAccount, tier: 'PRO' };
      const reply = createMockReply();

      await tierMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });
  });
});

describe('requireCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('No Account', () => {
    it('should return 403 when account is not attached to request', async () => {
      const creditMiddleware = requireCredits(10);
      const request = createMockRequest({});
      const reply = createMockReply();

      await creditMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'No account found',
        code: 'NO_ACCOUNT',
        message: 'You need an account to access this resource',
      });
    });

    it('should return 403 when account is null', async () => {
      const creditMiddleware = requireCredits(5);
      const request = createMockRequest({});
      (request as any).account = null;
      const reply = createMockReply();

      await creditMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Credit Validation', () => {
    it('should allow access when user has sufficient credits', async () => {
      const creditMiddleware = requireCredits(100);
      const request = createMockRequest({});
      (request as any).account = mockFreeAccount; // 1000 monthly - 100 used = 900 available
      const reply = createMockReply();

      await creditMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should return 403 when user has insufficient credits', async () => {
      const creditMiddleware = requireCredits(1000);
      const request = createMockRequest({});
      (request as any).account = mockFreeAccount; // 1000 - 100 = 900 available, need 1000
      const reply = createMockReply();

      await creditMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        message: 'You do not have enough credits for this operation',
        available: 900,
        required: 1000,
      });
    });

    it('should return 403 when credits are exactly zero', async () => {
      const accountNoCredits: Account = {
        ...mockFreeAccount,
        monthlyCredits: 1000,
        usedCredits: 1000,
      };
      const creditMiddleware = requireCredits(1);
      const request = createMockRequest({});
      (request as any).account = accountNoCredits;
      const reply = createMockReply();

      await creditMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply._sentPayload).toMatchObject({
        available: 0,
        required: 1,
      });
    });

    it('should allow access when credits exactly match required', async () => {
      const accountExact: Account = {
        ...mockFreeAccount,
        monthlyCredits: 1000,
        usedCredits: 990,
      };
      const creditMiddleware = requireCredits(10);
      const request = createMockRequest({});
      (request as any).account = accountExact;
      const reply = createMockReply();

      await creditMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should handle large credit requirements', async () => {
      const creditMiddleware = requireCredits(100000);
      const request = createMockRequest({});
      (request as any).account = mockBusinessAccount; // 250000 - 10000 = 240000 available
      const reply = createMockReply();

      await creditMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should handle zero credit requirement', async () => {
      const creditMiddleware = requireCredits(0);
      const request = createMockRequest({});
      (request as any).account = mockFreeAccount;
      const reply = createMockReply();

      await creditMiddleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should correctly calculate available credits for different accounts', async () => {
      const testCases = [
        { account: mockFreeAccount, required: 900, shouldPass: true }, // 900 available
        { account: mockFreeAccount, required: 901, shouldPass: false }, // 900 available
        { account: mockProAccount, required: 45000, shouldPass: true }, // 45000 available
        { account: mockBusinessAccount, required: 240000, shouldPass: true }, // 240000 available
        { account: mockBusinessAccount, required: 240001, shouldPass: false },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        const creditMiddleware = requireCredits(testCase.required);
        const request = createMockRequest({});
        (request as any).account = testCase.account;
        const reply = createMockReply();

        await creditMiddleware(request, reply);

        if (testCase.shouldPass) {
          expect(reply.status).not.toHaveBeenCalled();
        } else {
          expect(reply.status).toHaveBeenCalledWith(403);
        }
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative usedCredits (edge case)', async () => {
      const accountNegativeUsed: Account = {
        ...mockFreeAccount,
        usedCredits: -50,
      };
      const creditMiddleware = requireCredits(1000);
      const request = createMockRequest({});
      (request as any).account = accountNegativeUsed;
      const reply = createMockReply();

      await creditMiddleware(request, reply);

      // 1000 - (-50) = 1050 available
      expect(reply.status).not.toHaveBeenCalled();
    });
  });
});

describe('Middleware Integration', () => {
  it('should work in sequence: sessionMiddleware -> requireTier', async () => {
    const mockSession = createMockSession(mockProAccount);
    (sessionService.validateSession as Mock).mockResolvedValue(mockSession);

    const request = createMockRequest({ [authConfig.session.cookieName]: 'valid-token' });
    const reply = createMockReply();

    // First: session middleware
    await sessionMiddleware(request, reply);
    expect(request.account).toBeDefined();

    // Second: tier middleware
    const tierMiddleware = requireTier('PRO', 'BUSINESS');
    await tierMiddleware(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  it('should work in sequence: sessionMiddleware -> requireCredits', async () => {
    const mockSession = createMockSession(mockProAccount);
    (sessionService.validateSession as Mock).mockResolvedValue(mockSession);

    const request = createMockRequest({ [authConfig.session.cookieName]: 'valid-token' });
    const reply = createMockReply();

    // First: session middleware
    await sessionMiddleware(request, reply);

    // Second: credit middleware
    const creditMiddleware = requireCredits(1000);
    await creditMiddleware(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  it('should fail at tier check after successful session validation', async () => {
    const mockSession = createMockSession(mockFreeAccount);
    (sessionService.validateSession as Mock).mockResolvedValue(mockSession);

    const request = createMockRequest({ [authConfig.session.cookieName]: 'valid-token' });
    const reply = createMockReply();

    await sessionMiddleware(request, reply);

    const tierMiddleware = requireTier('ENTERPRISE');
    await tierMiddleware(request, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply._sentPayload).toMatchObject({
      code: 'TIER_REQUIRED',
    });
  });
});
