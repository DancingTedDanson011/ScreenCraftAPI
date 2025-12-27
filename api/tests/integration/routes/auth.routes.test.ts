/**
 * Auth Routes Integration Tests
 *
 * Tests for Google OAuth and session management endpoints:
 * - GET /auth/me - Get current user
 * - POST /auth/logout - Logout current session
 * - POST /auth/logout-all - Logout all sessions
 * - GET /auth/session - Session check
 * - GET /auth/sessions - List user sessions
 * - DELETE /auth/sessions/:sessionId - Revoke session
 *
 * Note: Google OAuth callback is tested at a higher level
 * since it requires actual OAuth flow integration.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ============================================================================
// MOCK SETUP - Must be done before imports
// ============================================================================

// Mock OAuth Service
const mockOauthService = {
  findOrCreateUser: vi.fn(),
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  getLinkedProviders: vi.fn(),
  unlinkProvider: vi.fn(),
};

vi.mock('../../../src/services/auth/oauth.service.js', () => ({
  oauthService: mockOauthService,
  OAuthService: class {
    findOrCreateUser = mockOauthService.findOrCreateUser;
    getUserById = mockOauthService.getUserById;
    getUserByEmail = mockOauthService.getUserByEmail;
    updateUser = mockOauthService.updateUser;
    deleteUser = mockOauthService.deleteUser;
    getLinkedProviders = mockOauthService.getLinkedProviders;
    unlinkProvider = mockOauthService.unlinkProvider;
  },
}));

// Mock Session Service
const mockSessionService = {
  createSession: vi.fn(),
  validateSession: vi.fn(),
  invalidateSession: vi.fn(),
  invalidateAllUserSessions: vi.fn(),
  getUserSessions: vi.fn(),
  invalidateSessionById: vi.fn(),
  cleanupExpiredSessions: vi.fn(),
  isSessionNearExpiry: vi.fn(),
};

vi.mock('../../../src/services/auth/session.service.js', () => ({
  sessionService: mockSessionService,
  SessionService: class {
    createSession = mockSessionService.createSession;
    validateSession = mockSessionService.validateSession;
    invalidateSession = mockSessionService.invalidateSession;
    invalidateAllUserSessions = mockSessionService.invalidateAllUserSessions;
    getUserSessions = mockSessionService.getUserSessions;
    invalidateSessionById = mockSessionService.invalidateSessionById;
    cleanupExpiredSessions = mockSessionService.cleanupExpiredSessions;
    isSessionNearExpiry = mockSessionService.isSessionNearExpiry;
  },
}));

// Mock Auth Config
vi.mock('../../../src/config/auth.config.js', () => ({
  authConfig: {
    google: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      callbackUrl: 'http://localhost:3000/api/v1/auth/google/callback',
    },
    session: {
      secret: 'test-session-secret',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      cookieName: 'screencraft_session',
    },
    frontendUrl: 'http://localhost:4321',
  },
}));

// Mock fastify-oauth2 plugin
vi.mock('@fastify/oauth2', () => ({
  default: async (fastify: FastifyInstance) => {
    // Mock the OAuth plugin registration
    (fastify as any).googleOAuth2 = {
      getAccessTokenFromAuthorizationCodeFlow: vi.fn().mockResolvedValue({
        token: { access_token: 'mock-access-token' },
      }),
    };
  },
  GOOGLE_CONFIGURATION: {
    authorizeHost: 'https://accounts.google.com',
    authorizePath: '/o/oauth2/v2/auth',
    tokenHost: 'https://oauth2.googleapis.com',
    tokenPath: '/token',
  },
}));

// Import after mocking
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../../../src/routes/auth.routes.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockSession = (overrides = {}) => ({
  id: 'session-123',
  userId: 'user-123',
  sessionToken: 'hashed-token',
  expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  userAgent: 'Mozilla/5.0',
  ipAddress: '127.0.0.1',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  user: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    image: 'https://example.com/avatar.jpg',
    account: {
      id: 'account-123',
      tier: 'PRO',
      monthlyCredits: 50000,
      usedCredits: 1000,
    },
  },
  ...overrides,
});

const createMockSessionList = () => [
  {
    id: 'session-123',
    userAgent: 'Mozilla/5.0 Chrome',
    ipAddress: '192.168.1.1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    expires: new Date('2024-01-08T00:00:00Z'),
  },
  {
    id: 'session-456',
    userAgent: 'Mozilla/5.0 Firefox',
    ipAddress: '192.168.1.2',
    createdAt: new Date('2024-01-02T00:00:00Z'),
    expires: new Date('2024-01-09T00:00:00Z'),
  },
];

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Auth Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({
      logger: false,
    });

    // Register cookie plugin (required for auth routes)
    await app.register(cookie);

    // Register auth routes
    await app.register(authRoutes, { prefix: '/api/v1' });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // GET /auth/me - Get Current User
  // ==========================================================================
  describe('GET /api/v1/auth/me', () => {
    it('should return 401 when no session cookie is present', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not authenticated');
      expect(body.code).toBe('NO_SESSION');
    });

    it('should return 401 when session is expired/invalid', async () => {
      mockSessionService.validateSession.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        cookies: {
          screencraft_session: 'invalid-session-token',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Session expired');
      expect(body.code).toBe('SESSION_EXPIRED');

      // Should clear the invalid cookie
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return user data when session is valid', async () => {
      const mockSession = createMockSession();
      mockSessionService.validateSession.mockResolvedValue(mockSession);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        cookies: {
          screencraft_session: 'valid-session-token',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.user).toBeDefined();
      expect(body.user.id).toBe('user-123');
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.name).toBe('Test User');
      expect(body.user.image).toBe('https://example.com/avatar.jpg');

      expect(body.account).toBeDefined();
      expect(body.account.id).toBe('account-123');
      expect(body.account.tier).toBe('PRO');
      expect(body.account.monthlyCredits).toBe(50000);
      expect(body.account.usedCredits).toBe(1000);
    });

    it('should return null account when user has no account', async () => {
      const mockSession = createMockSession({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          image: null,
          account: null,
        },
      });
      mockSessionService.validateSession.mockResolvedValue(mockSession);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        cookies: {
          screencraft_session: 'valid-session-token',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.user).toBeDefined();
      expect(body.account).toBeNull();
    });
  });

  // ==========================================================================
  // POST /auth/logout - Logout Current Session
  // ==========================================================================
  describe('POST /api/v1/auth/logout', () => {
    it('should succeed even without session cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Should still clear cookie
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should invalidate session and clear cookie when session exists', async () => {
      mockSessionService.invalidateSession.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        cookies: {
          screencraft_session: 'valid-session-token',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      expect(mockSessionService.invalidateSession).toHaveBeenCalledWith('valid-session-token');
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  // ==========================================================================
  // POST /auth/logout-all - Logout All Sessions
  // ==========================================================================
  describe('POST /api/v1/auth/logout-all', () => {
    it('should return 401 when no session cookie is present', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not authenticated');
      expect(body.code).toBe('NO_SESSION');
    });

    it('should return 401 when session is expired/invalid', async () => {
      mockSessionService.validateSession.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        cookies: {
          screencraft_session: 'invalid-session-token',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Session expired');
      expect(body.code).toBe('SESSION_EXPIRED');
    });

    it('should invalidate all user sessions when authenticated', async () => {
      const mockSession = createMockSession();
      mockSessionService.validateSession.mockResolvedValue(mockSession);
      mockSessionService.invalidateAllUserSessions.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        cookies: {
          screencraft_session: 'valid-session-token',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      expect(mockSessionService.invalidateAllUserSessions).toHaveBeenCalledWith('user-123');
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  // ==========================================================================
  // GET /auth/session - Session Check
  // ==========================================================================
  describe('GET /api/v1/auth/session', () => {
    it('should return authenticated: false when no session cookie', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/session',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.authenticated).toBe(false);
    });

    it('should return authenticated: false when session is invalid', async () => {
      mockSessionService.validateSession.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/session',
        cookies: {
          screencraft_session: 'invalid-session-token',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.authenticated).toBe(false);
      expect(body.expiresAt).toBeNull();
    });

    it('should return authenticated: true with expiry when session is valid', async () => {
      const expiryDate = new Date('2024-01-08T00:00:00Z');
      const mockSession = createMockSession({ expires: expiryDate });
      mockSessionService.validateSession.mockResolvedValue(mockSession);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/session',
        cookies: {
          screencraft_session: 'valid-session-token',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.authenticated).toBe(true);
      expect(body.expiresAt).toBe(expiryDate.toISOString());
    });
  });

  // ==========================================================================
  // GET /auth/sessions - List User Sessions
  // ==========================================================================
  describe('GET /api/v1/auth/sessions', () => {
    it('should return 401 when no session cookie is present', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not authenticated');
      expect(body.code).toBe('NO_SESSION');
    });

    it('should return 401 when session is expired/invalid', async () => {
      mockSessionService.validateSession.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        cookies: {
          screencraft_session: 'invalid-session-token',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Session expired');
      expect(body.code).toBe('SESSION_EXPIRED');
    });

    it('should return list of user sessions when authenticated', async () => {
      const mockSession = createMockSession();
      const mockSessions = createMockSessionList();

      mockSessionService.validateSession.mockResolvedValue(mockSession);
      mockSessionService.getUserSessions.mockResolvedValue(mockSessions);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        cookies: {
          screencraft_session: 'valid-session-token',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.sessions).toBeDefined();
      expect(body.sessions).toHaveLength(2);

      // Check first session
      expect(body.sessions[0].id).toBe('session-123');
      expect(body.sessions[0].userAgent).toBe('Mozilla/5.0 Chrome');
      expect(body.sessions[0].ipAddress).toBe('192.168.1.1');
      expect(body.sessions[0].isCurrent).toBe(true); // Current session

      // Check second session
      expect(body.sessions[1].id).toBe('session-456');
      expect(body.sessions[1].isCurrent).toBe(false);
    });
  });

  // ==========================================================================
  // DELETE /auth/sessions/:sessionId - Revoke Session
  // ==========================================================================
  describe('DELETE /api/v1/auth/sessions/:sessionId', () => {
    it('should return 401 when no session cookie is present', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/sessions/session-456',
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not authenticated');
      expect(body.code).toBe('NO_SESSION');
    });

    it('should return 401 when session is expired/invalid', async () => {
      mockSessionService.validateSession.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/sessions/session-456',
        cookies: {
          screencraft_session: 'invalid-session-token',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('Session expired');
      expect(body.code).toBe('SESSION_EXPIRED');
    });

    it('should revoke session when authenticated', async () => {
      const mockSession = createMockSession();
      mockSessionService.validateSession.mockResolvedValue(mockSession);
      mockSessionService.invalidateSessionById.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/sessions/session-456',
        cookies: {
          screencraft_session: 'valid-session-token',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      expect(mockSessionService.invalidateSessionById).toHaveBeenCalledWith(
        'session-456',
        'user-123'
      );
    });
  });

  // ==========================================================================
  // Route Registration Tests
  // ==========================================================================
  describe('Route Registration', () => {
    it('should register all auth routes', async () => {
      const routes = app.printRoutes();

      expect(routes).toContain('/api/v1/auth/me');
      expect(routes).toContain('/api/v1/auth/logout');
      expect(routes).toContain('/api/v1/auth/logout-all');
      expect(routes).toContain('/api/v1/auth/session');
      expect(routes).toContain('/api/v1/auth/sessions');
      expect(routes).toContain('/api/v1/auth/sessions/:sessionId');
    });

    it('should handle correct HTTP methods', async () => {
      // GET /auth/me should work
      const meResponse = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
      expect(meResponse.statusCode).not.toBe(405);

      // POST /auth/logout should work
      const logoutResponse = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
      expect(logoutResponse.statusCode).not.toBe(405);
    });
  });
});
