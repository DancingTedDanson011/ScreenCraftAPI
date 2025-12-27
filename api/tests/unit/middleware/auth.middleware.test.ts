/**
 * Auth Middleware Unit Tests
 *
 * Tests for API Key and RapidAPI authentication middleware
 * Covers: valid/invalid auth, RapidAPI headers, fallback scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ApiKeyInfo } from '../../../src/types/auth.types.js';
import type { Tier } from '@prisma/client';

// Mock the config module BEFORE importing the middleware
vi.mock('../../../src/config/rapidapi.config.js', () => ({
  rapidApiConfig: {
    enabled: false,
    proxySecret: 'test-proxy-secret',
  },
  extractRapidApiHeaders: vi.fn(),
  validateProxySecret: vi.fn(),
}));

// Import after mocking
import {
  createAuthMiddleware,
  createOptionalAuthMiddleware,
  type AuthMiddlewareOptions,
} from '../../../src/middleware/auth.middleware.js';
import {
  rapidApiConfig,
  extractRapidApiHeaders,
  validateProxySecret,
} from '../../../src/config/rapidapi.config.js';

// Mock types
interface MockRapidApiService {
  getOrCreateAccount: Mock;
}

interface MockApiKeyService {
  validateApiKey: Mock;
}

// Helper to create mock Fastify request
function createMockRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    headers: {},
    auth: undefined,
    ...overrides,
  } as FastifyRequest;
}

// Helper to create mock Fastify reply with chainable methods
function createMockReply(): FastifyReply & {
  _statusCode: number | null;
  _sentPayload: unknown;
} {
  const reply = {
    _statusCode: null as number | null,
    _sentPayload: undefined as unknown,
    status: vi.fn().mockImplementation(function (this: typeof reply, code: number) {
      this._statusCode = code;
      return this;
    }),
    send: vi.fn().mockImplementation(function (this: typeof reply, payload: unknown) {
      this._sentPayload = payload;
      return this;
    }),
  };
  return reply as unknown as FastifyReply & {
    _statusCode: number | null;
    _sentPayload: unknown;
  };
}

// Valid API key info fixture
const validApiKeyInfo: ApiKeyInfo = {
  id: 'key-123',
  accountId: 'account-456',
  tier: 'PRO' as Tier,
  monthlyCredits: 50000,
  usedCredits: 1000,
  isActive: true,
};

// RapidAPI account fixture
const rapidApiAccount = {
  id: 'rapid-account-789',
  email: 'testuser@rapidapi.internal',
  tier: 'BUSINESS' as Tier,
  monthlyCredits: 250000,
  usedCredits: 500,
};

describe('createAuthMiddleware', () => {
  let mockApiKeyService: MockApiKeyService;
  let mockRapidApiService: MockRapidApiService;
  let authMiddleware: ReturnType<typeof createAuthMiddleware>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockApiKeyService = {
      validateApiKey: vi.fn(),
    };

    mockRapidApiService = {
      getOrCreateAccount: vi.fn(),
    };

    // Reset rapidApiConfig to disabled by default
    (rapidApiConfig as { enabled: boolean }).enabled = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Key Authentication', () => {
    beforeEach(() => {
      authMiddleware = createAuthMiddleware({
        apiKeyService: mockApiKeyService as unknown as AuthMiddlewareOptions['apiKeyService'],
      });
    });

    it('should return 401 when no Authorization header is present', async () => {
      const request = createMockRequest({ headers: {} });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing Authorization header or RapidAPI headers',
        code: 'MISSING_AUTH_HEADER',
      });
    });

    it('should return 401 when Authorization header has invalid format', async () => {
      const request = createMockRequest({
        headers: { authorization: 'InvalidFormat token123' },
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid Authorization header format. Expected: "Bearer <api_key>"',
        code: 'INVALID_AUTH_FORMAT',
      });
    });

    it('should return 401 when API key is not found/invalid', async () => {
      mockApiKeyService.validateApiKey.mockResolvedValue(null);

      const request = createMockRequest({
        headers: { authorization: 'Bearer sk_test_invalidkey123' },
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_test_invalidkey123');
      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or revoked API key',
        code: 'INVALID_API_KEY',
      });
    });

    it('should return 401 when API key is revoked (isActive: false)', async () => {
      const revokedKeyInfo: ApiKeyInfo = { ...validApiKeyInfo, isActive: false };
      mockApiKeyService.validateApiKey.mockResolvedValue(revokedKeyInfo);

      const request = createMockRequest({
        headers: { authorization: 'Bearer sk_live_revokedkey456' },
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'API key has been revoked',
        code: 'REVOKED_API_KEY',
      });
    });

    it('should authenticate successfully with valid Bearer token', async () => {
      mockApiKeyService.validateApiKey.mockResolvedValue(validApiKeyInfo);

      const request = createMockRequest({
        headers: { authorization: 'Bearer sk_live_validkey789' },
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_live_validkey789');
      expect(request.auth).toEqual(validApiKeyInfo);
      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should authenticate with valid API key without Bearer prefix (sk_ format)', async () => {
      mockApiKeyService.validateApiKey.mockResolvedValue(validApiKeyInfo);

      const request = createMockRequest({
        headers: { authorization: 'sk_test_directkey123' },
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_test_directkey123');
      expect(request.auth).toEqual(validApiKeyInfo);
    });

    it('should handle Bearer prefix case-insensitively', async () => {
      mockApiKeyService.validateApiKey.mockResolvedValue(validApiKeyInfo);

      const request = createMockRequest({
        headers: { authorization: 'BEARER sk_live_uppercase123' },
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_live_uppercase123');
      expect(request.auth).toEqual(validApiKeyInfo);
    });

    it('should trim whitespace from Bearer token', async () => {
      mockApiKeyService.validateApiKey.mockResolvedValue(validApiKeyInfo);

      const request = createMockRequest({
        headers: { authorization: '  Bearer   sk_live_spacedtoken   ' },
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_live_spacedtoken');
    });
  });

  describe('RapidAPI Authentication', () => {
    beforeEach(() => {
      // Enable RapidAPI
      (rapidApiConfig as { enabled: boolean }).enabled = true;

      authMiddleware = createAuthMiddleware({
        apiKeyService: mockApiKeyService as unknown as AuthMiddlewareOptions['apiKeyService'],
        rapidApiService: mockRapidApiService as unknown as AuthMiddlewareOptions['rapidApiService'],
      });
    });

    it('should authenticate via RapidAPI headers when enabled and valid', async () => {
      const rapidHeaders = {
        'x-rapidapi-proxy-secret': 'test-proxy-secret',
        'x-rapidapi-user': 'testuser123',
        'x-rapidapi-subscription': 'BUSINESS',
      };

      (extractRapidApiHeaders as Mock).mockReturnValue(rapidHeaders);
      (validateProxySecret as Mock).mockReturnValue(true);
      mockRapidApiService.getOrCreateAccount.mockResolvedValue(rapidApiAccount);

      const request = createMockRequest({
        headers: rapidHeaders as unknown as FastifyRequest['headers'],
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(extractRapidApiHeaders).toHaveBeenCalled();
      expect(validateProxySecret).toHaveBeenCalledWith('test-proxy-secret');
      expect(mockRapidApiService.getOrCreateAccount).toHaveBeenCalledWith(
        'testuser123',
        'BUSINESS'
      );
      expect(request.auth).toEqual({
        id: rapidApiAccount.id,
        accountId: rapidApiAccount.id,
        tier: rapidApiAccount.tier,
        monthlyCredits: rapidApiAccount.monthlyCredits,
        usedCredits: rapidApiAccount.usedCredits,
        isActive: true,
      });
      expect((request as any).rapidApiHeaders).toEqual(rapidHeaders);
      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should fall through to API key auth when RapidAPI is disabled', async () => {
      (rapidApiConfig as { enabled: boolean }).enabled = false;
      mockApiKeyService.validateApiKey.mockResolvedValue(validApiKeyInfo);

      const request = createMockRequest({
        headers: { authorization: 'Bearer sk_live_fallback123' },
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(extractRapidApiHeaders).not.toHaveBeenCalled();
      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_live_fallback123');
      expect(request.auth).toEqual(validApiKeyInfo);
    });

    it('should fall through to API key auth when no RapidAPI headers present', async () => {
      (extractRapidApiHeaders as Mock).mockReturnValue(null);
      mockApiKeyService.validateApiKey.mockResolvedValue(validApiKeyInfo);

      const request = createMockRequest({
        headers: { authorization: 'Bearer sk_live_norapid123' },
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_live_norapid123');
      expect(request.auth).toEqual(validApiKeyInfo);
    });

    it('should fall through to API key auth when RapidAPI proxy secret is invalid', async () => {
      const rapidHeaders = {
        'x-rapidapi-proxy-secret': 'wrong-secret',
        'x-rapidapi-user': 'testuser123',
      };

      (extractRapidApiHeaders as Mock).mockReturnValue(rapidHeaders);
      (validateProxySecret as Mock).mockReturnValue(false);
      mockApiKeyService.validateApiKey.mockResolvedValue(validApiKeyInfo);

      const request = createMockRequest({
        headers: {
          ...rapidHeaders,
          authorization: 'Bearer sk_live_invalidsecret123',
        } as unknown as FastifyRequest['headers'],
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(validateProxySecret).toHaveBeenCalledWith('wrong-secret');
      expect(mockRapidApiService.getOrCreateAccount).not.toHaveBeenCalled();
      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_live_invalidsecret123');
    });

    it('should fall through to API key auth when RapidAPI user header is missing', async () => {
      const rapidHeaders = {
        'x-rapidapi-proxy-secret': 'test-proxy-secret',
        'x-rapidapi-user': undefined,
      };

      (extractRapidApiHeaders as Mock).mockReturnValue(rapidHeaders);
      (validateProxySecret as Mock).mockReturnValue(true);
      mockApiKeyService.validateApiKey.mockResolvedValue(validApiKeyInfo);

      const request = createMockRequest({
        headers: {
          ...rapidHeaders,
          authorization: 'Bearer sk_live_nouser123',
        } as unknown as FastifyRequest['headers'],
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(mockRapidApiService.getOrCreateAccount).not.toHaveBeenCalled();
      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_live_nouser123');
    });

    it('should fall through to API key auth when RapidAPI service throws an error', async () => {
      const rapidHeaders = {
        'x-rapidapi-proxy-secret': 'test-proxy-secret',
        'x-rapidapi-user': 'testuser123',
      };

      (extractRapidApiHeaders as Mock).mockReturnValue(rapidHeaders);
      (validateProxySecret as Mock).mockReturnValue(true);
      mockRapidApiService.getOrCreateAccount.mockRejectedValue(new Error('Database error'));
      mockApiKeyService.validateApiKey.mockResolvedValue(validApiKeyInfo);

      // Spy on console.error to verify error logging
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const request = createMockRequest({
        headers: {
          ...rapidHeaders,
          authorization: 'Bearer sk_live_rapidapierror123',
        } as unknown as FastifyRequest['headers'],
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'RapidAPI authentication error:',
        expect.any(Error)
      );
      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_live_rapidapierror123');
      expect(request.auth).toEqual(validApiKeyInfo);
    });

    it('should prioritize RapidAPI over API key auth when both are present', async () => {
      const rapidHeaders = {
        'x-rapidapi-proxy-secret': 'test-proxy-secret',
        'x-rapidapi-user': 'priorityuser',
        'x-rapidapi-subscription': 'PRO',
      };

      (extractRapidApiHeaders as Mock).mockReturnValue(rapidHeaders);
      (validateProxySecret as Mock).mockReturnValue(true);
      mockRapidApiService.getOrCreateAccount.mockResolvedValue(rapidApiAccount);

      const request = createMockRequest({
        headers: {
          ...rapidHeaders,
          authorization: 'Bearer sk_live_shouldbeignored',
        } as unknown as FastifyRequest['headers'],
      });
      const reply = createMockReply();

      await authMiddleware(request, reply);

      expect(mockRapidApiService.getOrCreateAccount).toHaveBeenCalled();
      expect(mockApiKeyService.validateApiKey).not.toHaveBeenCalled();
      expect(request.auth?.accountId).toBe(rapidApiAccount.id);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      authMiddleware = createAuthMiddleware({
        apiKeyService: mockApiKeyService as unknown as AuthMiddlewareOptions['apiKeyService'],
      });
    });

    it('should propagate service errors correctly', async () => {
      mockApiKeyService.validateApiKey.mockRejectedValue(new Error('Service unavailable'));

      const request = createMockRequest({
        headers: { authorization: 'Bearer sk_live_serviceerror' },
      });
      const reply = createMockReply();

      await expect(authMiddleware(request, reply)).rejects.toThrow('Service unavailable');
    });
  });
});

describe('createOptionalAuthMiddleware', () => {
  let mockApiKeyService: MockApiKeyService;
  let mockRapidApiService: MockRapidApiService;
  let optionalAuthMiddleware: ReturnType<typeof createOptionalAuthMiddleware>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockApiKeyService = {
      validateApiKey: vi.fn(),
    };

    mockRapidApiService = {
      getOrCreateAccount: vi.fn(),
    };

    // Reset rapidApiConfig to disabled by default
    (rapidApiConfig as { enabled: boolean }).enabled = false;

    optionalAuthMiddleware = createOptionalAuthMiddleware({
      apiKeyService: mockApiKeyService as unknown as AuthMiddlewareOptions['apiKeyService'],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('No Authentication', () => {
    it('should continue without error when no Authorization header is present', async () => {
      const request = createMockRequest({ headers: {} });
      const reply = createMockReply();

      await optionalAuthMiddleware(request, reply);

      expect(request.auth).toBeUndefined();
      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should continue without error when Authorization header has invalid format', async () => {
      const request = createMockRequest({
        headers: { authorization: 'InvalidFormat token' },
      });
      const reply = createMockReply();

      await optionalAuthMiddleware(request, reply);

      expect(request.auth).toBeUndefined();
      expect(mockApiKeyService.validateApiKey).not.toHaveBeenCalled();
    });
  });

  describe('Valid Authentication', () => {
    it('should attach auth info when valid API key is provided', async () => {
      mockApiKeyService.validateApiKey.mockResolvedValue(validApiKeyInfo);

      const request = createMockRequest({
        headers: { authorization: 'Bearer sk_live_optionalkey123' },
      });
      const reply = createMockReply();

      await optionalAuthMiddleware(request, reply);

      expect(request.auth).toEqual(validApiKeyInfo);
    });

    it('should not attach auth info when API key is invalid', async () => {
      mockApiKeyService.validateApiKey.mockResolvedValue(null);

      const request = createMockRequest({
        headers: { authorization: 'Bearer sk_test_invalidoptional' },
      });
      const reply = createMockReply();

      await optionalAuthMiddleware(request, reply);

      expect(request.auth).toBeUndefined();
      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should not attach auth info when API key is inactive', async () => {
      const inactiveKeyInfo: ApiKeyInfo = { ...validApiKeyInfo, isActive: false };
      mockApiKeyService.validateApiKey.mockResolvedValue(inactiveKeyInfo);

      const request = createMockRequest({
        headers: { authorization: 'Bearer sk_test_inactive' },
      });
      const reply = createMockReply();

      await optionalAuthMiddleware(request, reply);

      expect(request.auth).toBeUndefined();
    });
  });

  describe('RapidAPI Optional Authentication', () => {
    beforeEach(() => {
      (rapidApiConfig as { enabled: boolean }).enabled = true;

      optionalAuthMiddleware = createOptionalAuthMiddleware({
        apiKeyService: mockApiKeyService as unknown as AuthMiddlewareOptions['apiKeyService'],
        rapidApiService: mockRapidApiService as unknown as AuthMiddlewareOptions['rapidApiService'],
      });
    });

    it('should authenticate via RapidAPI headers when valid', async () => {
      const rapidHeaders = {
        'x-rapidapi-proxy-secret': 'test-proxy-secret',
        'x-rapidapi-user': 'optionaluser',
        'x-rapidapi-subscription': 'PRO',
      };

      (extractRapidApiHeaders as Mock).mockReturnValue(rapidHeaders);
      (validateProxySecret as Mock).mockReturnValue(true);
      mockRapidApiService.getOrCreateAccount.mockResolvedValue(rapidApiAccount);

      const request = createMockRequest({
        headers: rapidHeaders as unknown as FastifyRequest['headers'],
      });
      const reply = createMockReply();

      await optionalAuthMiddleware(request, reply);

      expect(request.auth).toBeDefined();
      expect(request.auth?.accountId).toBe(rapidApiAccount.id);
    });

    it('should continue without auth when RapidAPI auth fails', async () => {
      const rapidHeaders = {
        'x-rapidapi-proxy-secret': 'test-proxy-secret',
        'x-rapidapi-user': 'failuser',
      };

      (extractRapidApiHeaders as Mock).mockReturnValue(rapidHeaders);
      (validateProxySecret as Mock).mockReturnValue(true);
      mockRapidApiService.getOrCreateAccount.mockRejectedValue(new Error('RapidAPI error'));

      // Spy on console.error to verify error logging
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const request = createMockRequest({
        headers: rapidHeaders as unknown as FastifyRequest['headers'],
      });
      const reply = createMockReply();

      await optionalAuthMiddleware(request, reply);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Optional RapidAPI auth error:',
        expect.any(Error)
      );
      expect(request.auth).toBeUndefined();
      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should fall through to API key when RapidAPI headers are missing', async () => {
      (extractRapidApiHeaders as Mock).mockReturnValue(null);
      mockApiKeyService.validateApiKey.mockResolvedValue(validApiKeyInfo);

      const request = createMockRequest({
        headers: { authorization: 'Bearer sk_live_fallbackoptional' },
      });
      const reply = createMockReply();

      await optionalAuthMiddleware(request, reply);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_live_fallbackoptional');
      expect(request.auth).toEqual(validApiKeyInfo);
    });
  });
});

describe('extractApiKey helper (implicit via middleware)', () => {
  let mockApiKeyService: MockApiKeyService;
  let authMiddleware: ReturnType<typeof createAuthMiddleware>;

  beforeEach(() => {
    mockApiKeyService = {
      validateApiKey: vi.fn().mockResolvedValue(validApiKeyInfo),
    };

    authMiddleware = createAuthMiddleware({
      apiKeyService: mockApiKeyService as unknown as AuthMiddlewareOptions['apiKeyService'],
    });
  });

  it('should extract key from "Bearer sk_xxx" format', async () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer sk_live_testkey' },
    });
    const reply = createMockReply();

    await authMiddleware(request, reply);

    expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_live_testkey');
  });

  it('should extract key from direct "sk_xxx" format', async () => {
    const request = createMockRequest({
      headers: { authorization: 'sk_test_directkey' },
    });
    const reply = createMockReply();

    await authMiddleware(request, reply);

    expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('sk_test_directkey');
  });

  it('should reject non-sk_ keys without Bearer prefix', async () => {
    const request = createMockRequest({
      headers: { authorization: 'random_token_123' },
    });
    const reply = createMockReply();

    await authMiddleware(request, reply);

    expect(mockApiKeyService.validateApiKey).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply._sentPayload).toEqual({
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Expected: "Bearer <api_key>"',
      code: 'INVALID_AUTH_FORMAT',
    });
  });
});
