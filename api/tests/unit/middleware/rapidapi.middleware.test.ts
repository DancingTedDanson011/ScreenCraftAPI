import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';

// Define Tier enum locally to avoid import hoisting issues with mocks
const Tier = {
  FREE: 'FREE',
  PRO: 'PRO',
  BUSINESS: 'BUSINESS',
  ENTERPRISE: 'ENTERPRISE',
} as const;
type TierType = (typeof Tier)[keyof typeof Tier];

// Mock the config module before importing middleware
vi.mock('../../../src/config/rapidapi.config.js', () => ({
  rapidApiConfig: {
    enabled: true,
    proxySecret: 'test-secret-12345',
  },
  extractRapidApiHeaders: vi.fn(),
  validateProxySecret: vi.fn(),
}));

// Mock the service
vi.mock('../../../src/services/rapidapi/rapidapi.service.js', () => ({
  RapidApiService: vi.fn(),
}));

// Import after mocking
const { rapidApiConfig, extractRapidApiHeaders, validateProxySecret } = await import(
  '../../../src/config/rapidapi.config.js'
);

const {
  createRapidApiMiddleware,
  createOptionalRapidApiMiddleware,
  isRapidApiRequest,
} = await import('../../../src/middleware/rapidapi.middleware.js');

// Mock RapidApiService
function createMockRapidApiService() {
  return {
    getOrCreateAccount: vi.fn(),
    trackUsage: vi.fn(),
    hasCredits: vi.fn(),
    getUsageStats: vi.fn(),
  };
}

// Mock request factory
function createMockRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    id: 'test-request-id-12345',
    headers: {},
    body: {},
    params: {},
    query: {},
    ip: '127.0.0.1',
    auth: undefined,
    ...overrides,
  } as unknown as FastifyRequest;
}

// Mock reply factory
function createMockReply(): FastifyReply & { _statusCode: number; _sentData: any } {
  const reply = {
    _statusCode: 200,
    _sentData: null,
    status: vi.fn().mockImplementation(function (this: any, code: number) {
      this._statusCode = code;
      return this;
    }),
    send: vi.fn().mockImplementation(function (this: any, data: any) {
      this._sentData = data;
      return this;
    }),
    code: vi.fn().mockImplementation(function (this: any, code: number) {
      this._statusCode = code;
      return this;
    }),
    header: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply & { _statusCode: number; _sentData: any };
}

describe('RapidAPI Middleware', () => {
  let mockRapidApiService: ReturnType<typeof createMockRapidApiService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRapidApiService = createMockRapidApiService();

    // Reset mocks to default behavior
    (rapidApiConfig as any).enabled = true;
    (rapidApiConfig as any).proxySecret = 'test-secret-12345';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createRapidApiMiddleware', () => {
    describe('RapidAPI disabled', () => {
      it('should return 503 when RapidAPI is disabled', async () => {
        (rapidApiConfig as any).enabled = false;

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest({
          headers: {
            'x-rapidapi-proxy-secret': 'test-secret-12345',
            'x-rapidapi-user': 'test-user',
          },
        });
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).toHaveBeenCalledWith(503);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Service Unavailable',
            message: 'RapidAPI integration is not enabled',
            code: 'RAPIDAPI_DISABLED',
          })
        );
      });
    });

    describe('header validation', () => {
      it('should return 401 when RapidAPI headers are missing', async () => {
        (extractRapidApiHeaders as any).mockReturnValue(null);

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest({
          headers: {},
        });
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).toHaveBeenCalledWith(401);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Unauthorized',
            message: 'Missing required RapidAPI headers (x-rapidapi-proxy-secret, x-rapidapi-user)',
            code: 'MISSING_RAPIDAPI_HEADERS',
          })
        );
      });

      it('should return 401 when only proxy-secret is provided', async () => {
        (extractRapidApiHeaders as any).mockReturnValue(null);

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest({
          headers: {
            'x-rapidapi-proxy-secret': 'test-secret-12345',
          },
        });
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).toHaveBeenCalledWith(401);
        expect(reply._sentData.code).toBe('MISSING_RAPIDAPI_HEADERS');
      });

      it('should return 401 when only user header is provided', async () => {
        (extractRapidApiHeaders as any).mockReturnValue(null);

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest({
          headers: {
            'x-rapidapi-user': 'test-user',
          },
        });
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).toHaveBeenCalledWith(401);
      });
    });

    describe('proxy secret validation', () => {
      it('should return 401 when proxy secret is invalid', async () => {
        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': 'wrong-secret',
          'x-rapidapi-user': 'test-user',
        });
        (validateProxySecret as any).mockReturnValue(false);

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest({
          headers: {
            'x-rapidapi-proxy-secret': 'wrong-secret',
            'x-rapidapi-user': 'test-user',
          },
        });
        const reply = createMockReply();

        await middleware(request, reply);

        expect(validateProxySecret).toHaveBeenCalledWith('wrong-secret');
        expect(reply.status).toHaveBeenCalledWith(401);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Unauthorized',
            message: 'Invalid RapidAPI proxy secret',
            code: 'INVALID_PROXY_SECRET',
          })
        );
      });

      it('should return 401 when proxy secret is empty', async () => {
        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': '',
          'x-rapidapi-user': 'test-user',
        });
        (validateProxySecret as any).mockReturnValue(false);

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).toHaveBeenCalledWith(401);
        expect(reply._sentData.code).toBe('INVALID_PROXY_SECRET');
      });
    });

    describe('successful authentication', () => {
      const mockAccount = {
        id: 'account-uuid-12345',
        email: 'testuser@rapidapi.internal',
        tier: Tier.PRO,
        monthlyCredits: 50000,
        usedCredits: 100,
        lastResetAt: new Date('2025-01-01'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      beforeEach(() => {
        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': 'test-secret-12345',
          'x-rapidapi-user': 'testuser',
          'x-rapidapi-subscription': 'PRO',
        });
        (validateProxySecret as any).mockReturnValue(true);
      });

      it('should authenticate and attach auth info to request', async () => {
        mockRapidApiService.getOrCreateAccount.mockResolvedValue(mockAccount);

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest({
          headers: {
            'x-rapidapi-proxy-secret': 'test-secret-12345',
            'x-rapidapi-user': 'testuser',
            'x-rapidapi-subscription': 'PRO',
          },
        });
        const reply = createMockReply();

        await middleware(request, reply);

        expect(mockRapidApiService.getOrCreateAccount).toHaveBeenCalledWith('testuser', 'PRO');
        expect(reply.status).not.toHaveBeenCalled();
        expect(request.auth).toEqual({
          id: 'account-uuid-12345',
          accountId: 'account-uuid-12345',
          tier: Tier.PRO,
          monthlyCredits: 50000,
          usedCredits: 100,
          isActive: true,
        });
      });

      it('should attach rapidApiHeaders to request', async () => {
        mockRapidApiService.getOrCreateAccount.mockResolvedValue(mockAccount);

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest({
          headers: {
            'x-rapidapi-proxy-secret': 'test-secret-12345',
            'x-rapidapi-user': 'testuser',
            'x-rapidapi-subscription': 'PRO',
          },
        });
        const reply = createMockReply();

        await middleware(request, reply);

        expect((request as any).rapidApiHeaders).toEqual({
          'x-rapidapi-proxy-secret': 'test-secret-12345',
          'x-rapidapi-user': 'testuser',
          'x-rapidapi-subscription': 'PRO',
        });
      });

      it('should handle FREE tier accounts', async () => {
        const freeAccount = { ...mockAccount, tier: Tier.FREE, monthlyCredits: 1000 };
        mockRapidApiService.getOrCreateAccount.mockResolvedValue(freeAccount);

        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': 'test-secret-12345',
          'x-rapidapi-user': 'freeuser',
          'x-rapidapi-subscription': 'BASIC',
        });

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(request.auth?.tier).toBe(Tier.FREE);
        expect(request.auth?.monthlyCredits).toBe(1000);
      });

      it('should handle BUSINESS tier accounts', async () => {
        const businessAccount = { ...mockAccount, tier: Tier.BUSINESS, monthlyCredits: 250000 };
        mockRapidApiService.getOrCreateAccount.mockResolvedValue(businessAccount);

        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': 'test-secret-12345',
          'x-rapidapi-user': 'businessuser',
          'x-rapidapi-subscription': 'BUSINESS',
        });

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(request.auth?.tier).toBe(Tier.BUSINESS);
      });

      it('should handle ENTERPRISE tier accounts', async () => {
        const enterpriseAccount = {
          ...mockAccount,
          tier: Tier.ENTERPRISE,
          monthlyCredits: -1,
        };
        mockRapidApiService.getOrCreateAccount.mockResolvedValue(enterpriseAccount);

        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': 'test-secret-12345',
          'x-rapidapi-user': 'enterpriseuser',
          'x-rapidapi-subscription': 'ENTERPRISE',
        });

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(request.auth?.tier).toBe(Tier.ENTERPRISE);
        expect(request.auth?.monthlyCredits).toBe(-1);
      });

      it('should handle missing subscription header (defaults to FREE)', async () => {
        const freeAccount = { ...mockAccount, tier: Tier.FREE };
        mockRapidApiService.getOrCreateAccount.mockResolvedValue(freeAccount);

        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': 'test-secret-12345',
          'x-rapidapi-user': 'newuser',
          'x-rapidapi-subscription': undefined,
        });

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(mockRapidApiService.getOrCreateAccount).toHaveBeenCalledWith('newuser', undefined);
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': 'test-secret-12345',
          'x-rapidapi-user': 'testuser',
        });
        (validateProxySecret as any).mockReturnValue(true);
      });

      it('should return 500 when service throws an error', async () => {
        mockRapidApiService.getOrCreateAccount.mockRejectedValue(
          new Error('Database connection failed')
        );

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).toHaveBeenCalledWith(500);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Internal Server Error',
            message: 'Failed to process RapidAPI authentication',
            code: 'RAPIDAPI_AUTH_ERROR',
          })
        );
      });

      it('should return 500 when Redis is unavailable', async () => {
        mockRapidApiService.getOrCreateAccount.mockRejectedValue(
          new Error('Redis connection refused')
        );

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).toHaveBeenCalledWith(500);
        expect(reply._sentData.code).toBe('RAPIDAPI_AUTH_ERROR');
      });

      it('should return 500 when Prisma throws', async () => {
        mockRapidApiService.getOrCreateAccount.mockRejectedValue(
          new Error('Prisma: Unable to connect to database')
        );

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).toHaveBeenCalledWith(500);
      });

      it('should log error to console', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const testError = new Error('Test error for logging');
        mockRapidApiService.getOrCreateAccount.mockRejectedValue(testError);

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(consoleSpy).toHaveBeenCalledWith('Error processing RapidAPI request:', testError);
        consoleSpy.mockRestore();
      });
    });
  });

  describe('createOptionalRapidApiMiddleware', () => {
    const mockAccount = {
      id: 'account-uuid-12345',
      email: 'testuser@rapidapi.internal',
      tier: Tier.PRO,
      monthlyCredits: 50000,
      usedCredits: 100,
      lastResetAt: new Date('2025-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2025-01-01'),
    };

    describe('RapidAPI disabled', () => {
      it('should silently continue when RapidAPI is disabled', async () => {
        (rapidApiConfig as any).enabled = false;

        const middleware = createOptionalRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest({
          headers: {
            'x-rapidapi-proxy-secret': 'test-secret-12345',
            'x-rapidapi-user': 'test-user',
          },
        });
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).not.toHaveBeenCalled();
        expect(reply.send).not.toHaveBeenCalled();
        expect(request.auth).toBeUndefined();
      });
    });

    describe('missing headers', () => {
      it('should silently continue when headers are missing', async () => {
        (extractRapidApiHeaders as any).mockReturnValue(null);

        const middleware = createOptionalRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest({
          headers: {},
        });
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).not.toHaveBeenCalled();
        expect(request.auth).toBeUndefined();
      });
    });

    describe('invalid secret', () => {
      it('should silently continue when proxy secret is invalid', async () => {
        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': 'wrong-secret',
          'x-rapidapi-user': 'test-user',
        });
        (validateProxySecret as any).mockReturnValue(false);

        const middleware = createOptionalRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).not.toHaveBeenCalled();
        expect(request.auth).toBeUndefined();
      });
    });

    describe('successful authentication', () => {
      beforeEach(() => {
        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': 'test-secret-12345',
          'x-rapidapi-user': 'testuser',
          'x-rapidapi-subscription': 'PRO',
        });
        (validateProxySecret as any).mockReturnValue(true);
      });

      it('should authenticate when valid headers are present', async () => {
        mockRapidApiService.getOrCreateAccount.mockResolvedValue(mockAccount);

        const middleware = createOptionalRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(request.auth).toEqual({
          id: 'account-uuid-12345',
          accountId: 'account-uuid-12345',
          tier: Tier.PRO,
          monthlyCredits: 50000,
          usedCredits: 100,
          isActive: true,
        });
      });

      it('should attach rapidApiHeaders to request', async () => {
        mockRapidApiService.getOrCreateAccount.mockResolvedValue(mockAccount);

        const middleware = createOptionalRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect((request as any).rapidApiHeaders).toBeDefined();
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': 'test-secret-12345',
          'x-rapidapi-user': 'testuser',
        });
        (validateProxySecret as any).mockReturnValue(true);
      });

      it('should silently continue on service error', async () => {
        mockRapidApiService.getOrCreateAccount.mockRejectedValue(
          new Error('Database connection failed')
        );

        const middleware = createOptionalRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(reply.status).not.toHaveBeenCalled();
        expect(request.auth).toBeUndefined();
      });

      it('should log error to console on service error', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const testError = new Error('Test error');
        mockRapidApiService.getOrCreateAccount.mockRejectedValue(testError);

        const middleware = createOptionalRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(consoleSpy).toHaveBeenCalledWith(
          'Error processing optional RapidAPI request:',
          testError
        );
        consoleSpy.mockRestore();
      });
    });
  });

  describe('isRapidApiRequest', () => {
    it('should return true when rapidApiHeaders is attached', () => {
      const request = createMockRequest();
      (request as any).rapidApiHeaders = {
        'x-rapidapi-proxy-secret': 'test-secret',
        'x-rapidapi-user': 'test-user',
      };

      expect(isRapidApiRequest(request)).toBe(true);
    });

    it('should return false when rapidApiHeaders is not attached', () => {
      const request = createMockRequest();

      expect(isRapidApiRequest(request)).toBe(false);
    });

    it('should return false when rapidApiHeaders is undefined', () => {
      const request = createMockRequest();
      (request as any).rapidApiHeaders = undefined;

      expect(isRapidApiRequest(request)).toBe(false);
    });

    it('should return false when rapidApiHeaders is null', () => {
      const request = createMockRequest();
      (request as any).rapidApiHeaders = null;

      expect(isRapidApiRequest(request)).toBe(false);
    });

    it('should return true when rapidApiHeaders is empty object', () => {
      const request = createMockRequest();
      (request as any).rapidApiHeaders = {};

      // Empty object is truthy, so this should return true
      expect(isRapidApiRequest(request)).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    const mockAccount = {
      id: 'account-uuid-12345',
      email: 'testuser@rapidapi.internal',
      tier: Tier.PRO,
      monthlyCredits: 50000,
      usedCredits: 100,
      lastResetAt: new Date('2025-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2025-01-01'),
    };

    beforeEach(() => {
      (validateProxySecret as any).mockReturnValue(true);
    });

    it('should handle concurrent requests', async () => {
      mockRapidApiService.getOrCreateAccount.mockResolvedValue(mockAccount);

      (extractRapidApiHeaders as any).mockReturnValue({
        'x-rapidapi-proxy-secret': 'test-secret-12345',
        'x-rapidapi-user': 'user1',
      });

      const middleware = createRapidApiMiddleware({
        rapidApiService: mockRapidApiService as any,
      });

      const requests = Array.from({ length: 10 }, () => createMockRequest());
      const replies = requests.map(() => createMockReply());

      await Promise.all(requests.map((req, i) => middleware(req, replies[i])));

      expect(mockRapidApiService.getOrCreateAccount).toHaveBeenCalledTimes(10);
      requests.forEach((req) => {
        expect(req.auth).toBeDefined();
      });
    });

    it('should handle special characters in username', async () => {
      mockRapidApiService.getOrCreateAccount.mockResolvedValue({
        ...mockAccount,
        email: 'user+test@rapidapi.internal',
      });

      (extractRapidApiHeaders as any).mockReturnValue({
        'x-rapidapi-proxy-secret': 'test-secret-12345',
        'x-rapidapi-user': 'user+test',
        'x-rapidapi-subscription': 'PRO',
      });

      const middleware = createRapidApiMiddleware({
        rapidApiService: mockRapidApiService as any,
      });

      const request = createMockRequest();
      const reply = createMockReply();

      await middleware(request, reply);

      expect(mockRapidApiService.getOrCreateAccount).toHaveBeenCalledWith('user+test', 'PRO');
      expect(request.auth).toBeDefined();
    });

    it('should handle very long usernames', async () => {
      const longUsername = 'a'.repeat(255);
      mockRapidApiService.getOrCreateAccount.mockResolvedValue({
        ...mockAccount,
        email: `${longUsername}@rapidapi.internal`,
      });

      (extractRapidApiHeaders as any).mockReturnValue({
        'x-rapidapi-proxy-secret': 'test-secret-12345',
        'x-rapidapi-user': longUsername,
      });

      const middleware = createRapidApiMiddleware({
        rapidApiService: mockRapidApiService as any,
      });

      const request = createMockRequest();
      const reply = createMockReply();

      await middleware(request, reply);

      expect(mockRapidApiService.getOrCreateAccount).toHaveBeenCalledWith(longUsername, undefined);
    });

    it('should handle subscription tier upgrade', async () => {
      // First request as FREE
      const freeAccount = { ...mockAccount, tier: Tier.FREE, monthlyCredits: 1000 };
      mockRapidApiService.getOrCreateAccount.mockResolvedValue(freeAccount);

      (extractRapidApiHeaders as any).mockReturnValue({
        'x-rapidapi-proxy-secret': 'test-secret-12345',
        'x-rapidapi-user': 'upgradeuser',
        'x-rapidapi-subscription': 'BASIC',
      });

      const middleware = createRapidApiMiddleware({
        rapidApiService: mockRapidApiService as any,
      });

      const request1 = createMockRequest();
      const reply1 = createMockReply();

      await middleware(request1, reply1);

      expect(request1.auth?.tier).toBe(Tier.FREE);

      // Second request as PRO (upgraded)
      mockRapidApiService.getOrCreateAccount.mockResolvedValue(mockAccount);

      (extractRapidApiHeaders as any).mockReturnValue({
        'x-rapidapi-proxy-secret': 'test-secret-12345',
        'x-rapidapi-user': 'upgradeuser',
        'x-rapidapi-subscription': 'PRO',
      });

      const request2 = createMockRequest();
      const reply2 = createMockReply();

      await middleware(request2, reply2);

      expect(request2.auth?.tier).toBe(Tier.PRO);
      expect(request2.auth?.monthlyCredits).toBe(50000);
    });

    it('should handle case-insensitive subscription names', async () => {
      mockRapidApiService.getOrCreateAccount.mockResolvedValue(mockAccount);

      const subscriptionVariants = ['pro', 'PRO', 'Pro', 'pRo'];

      for (const subscription of subscriptionVariants) {
        (extractRapidApiHeaders as any).mockReturnValue({
          'x-rapidapi-proxy-secret': 'test-secret-12345',
          'x-rapidapi-user': 'testuser',
          'x-rapidapi-subscription': subscription,
        });

        const middleware = createRapidApiMiddleware({
          rapidApiService: mockRapidApiService as any,
        });

        const request = createMockRequest();
        const reply = createMockReply();

        await middleware(request, reply);

        expect(mockRapidApiService.getOrCreateAccount).toHaveBeenCalledWith('testuser', subscription);
      }
    });
  });
});
