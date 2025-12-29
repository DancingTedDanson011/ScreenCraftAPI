// Authentication Routes - Email/Password + Google OAuth

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import oauthPlugin from '@fastify/oauth2';
import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import { oauthService } from '../services/auth/oauth.service.js';
import { sessionService } from '../services/auth/session.service.js';
import { passwordService } from '../services/auth/password.service.js';
import { authConfig } from '../config/auth.config.js';
import { config } from '../config/index.js';
import { createLoginRateLimiter } from '../middleware/rate-limit.middleware.js';
import { setCsrfCookie } from '../middleware/csrf.middleware.js';

// M-08: OAuth state prefix for Redis storage
const OAUTH_STATE_PREFIX = 'oauth_state:';

// Extend FastifyInstance to include googleOAuth2
declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2: {
      getAccessTokenFromAuthorizationCodeFlow: (
        request: FastifyRequest
      ) => Promise<{ token: { access_token: string } }>;
    };
  }
}

export async function authRoutes(fastify: FastifyInstance) {
  // Initialize Redis for login rate limiting (C-03: Brute-force protection)
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  });

  const loginRateLimiter = createLoginRateLimiter({ redis });

  // Cleanup Redis on server close
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });

  // M-08: OAuth state generation function for CSRF protection
  const generateStateFunction = async (): Promise<string> => {
    const state = randomBytes(32).toString('hex');
    // Store state in Redis with 10-minute TTL
    await redis.set(`${OAUTH_STATE_PREFIX}${state}`, '1', 'EX', 600);
    return state;
  };

  // M-08: OAuth state validation function
  const checkStateFunction = async (request: FastifyRequest, callback: (err?: Error) => void): Promise<void> => {
    const state = (request.query as { state?: string }).state;

    if (!state) {
      return callback(new Error('Missing OAuth state parameter'));
    }

    const key = `${OAUTH_STATE_PREFIX}${state}`;
    const exists = await redis.get(key);

    if (!exists) {
      return callback(new Error('Invalid or expired OAuth state'));
    }

    // Delete state after use (one-time use)
    await redis.del(key);
    callback();
  };

  // Register Google OAuth2 Plugin with CSRF state protection
  await fastify.register(oauthPlugin, {
    name: 'googleOAuth2',
    scope: ['profile', 'email'],
    credentials: {
      client: {
        id: authConfig.google.clientId,
        secret: authConfig.google.clientSecret,
      },
      auth: oauthPlugin.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/auth/google',
    callbackUri: authConfig.google.callbackUrl,
    // M-08: Enable CSRF protection via state parameter
    generateStateFunction,
    checkStateFunction,
  });

  /**
   * Google OAuth Callback
   * Handles the redirect from Google after user authentication
   */
  fastify.get('/auth/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Exchange authorization code for access token
      const { token } = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

      // Fetch user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });

      if (!userInfoResponse.ok) {
        fastify.log.error('Failed to fetch Google user info');
        return reply.redirect(`${authConfig.frontendUrl}/login?error=google_fetch_failed`);
      }

      const googleUser = await userInfoResponse.json() as {
        id: string;
        email: string;
        name: string;
        picture: string;
      };

      // Find or create user in database
      const user = await oauthService.findOrCreateUser({
        id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        provider: 'google',
      });

      // Create session
      const session = await sessionService.createSession(
        user.id,
        request.headers['user-agent'],
        request.ip
      );

      // Set HttpOnly session cookie
      // Note: Use 'lax' for OAuth flows (strict blocks cross-origin redirects)
      reply.setCookie(authConfig.session.cookieName, session.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: authConfig.session.maxAge / 1000, // Convert to seconds
        domain: authConfig.session.cookieDomain, // For cross-subdomain auth
      });

      // H-06: Set CSRF cookie for session-based auth
      setCsrfCookie(reply, authConfig.session.cookieDomain);

      // Redirect to frontend dashboard
      return reply.redirect(`${authConfig.frontendUrl}/dashboard`);

    } catch (error) {
      fastify.log.error(error, 'Google OAuth callback error');
      return reply.redirect(`${authConfig.frontendUrl}/login?error=auth_failed`);
    }
  });

  // ============================================
  // GITHUB OAUTH
  // ============================================

  // Register GitHub OAuth2 Plugin with CSRF state protection
  if (authConfig.github.clientId && authConfig.github.clientSecret) {
    await fastify.register(oauthPlugin, {
      name: 'githubOAuth2',
      scope: ['read:user', 'user:email'],
      credentials: {
        client: {
          id: authConfig.github.clientId,
          secret: authConfig.github.clientSecret,
        },
        auth: oauthPlugin.GITHUB_CONFIGURATION,
      },
      startRedirectPath: '/auth/github',
      callbackUri: authConfig.github.callbackUrl,
      // M-08: Enable CSRF protection via state parameter
      generateStateFunction,
      checkStateFunction,
    });

    // Extend FastifyInstance for GitHub OAuth
    const githubOAuth2 = (fastify as any).githubOAuth2;

    /**
     * GitHub OAuth Callback
     * Handles the redirect from GitHub after user authentication
     */
    fastify.get('/auth/github/callback', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Exchange authorization code for access token
        const { token } = await githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

        // Fetch user info from GitHub
        const userInfoResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'ScreenCraft-API',
          },
        });

        if (!userInfoResponse.ok) {
          fastify.log.error('Failed to fetch GitHub user info');
          return reply.redirect(`${authConfig.frontendUrl}/login?error=github_fetch_failed`);
        }

        const githubUser = await userInfoResponse.json() as {
          id: number;
          login: string;
          name: string | null;
          email: string | null;
          avatar_url: string;
        };

        // If no public email, fetch from emails endpoint
        let email = githubUser.email;
        if (!email) {
          const emailsResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'ScreenCraft-API',
            },
          });

          if (emailsResponse.ok) {
            const emails = await emailsResponse.json() as Array<{
              email: string;
              primary: boolean;
              verified: boolean;
            }>;
            const primaryEmail = emails.find(e => e.primary && e.verified);
            email = primaryEmail?.email || emails.find(e => e.verified)?.email || null;
          }
        }

        if (!email) {
          fastify.log.error('No verified email found for GitHub user');
          return reply.redirect(`${authConfig.frontendUrl}/login?error=github_no_email`);
        }

        // Find or create user in database
        const user = await oauthService.findOrCreateUser({
          id: String(githubUser.id),
          email: email,
          name: githubUser.name || githubUser.login,
          picture: githubUser.avatar_url,
          provider: 'github',
        });

        // Create session
        const session = await sessionService.createSession(
          user.id,
          request.headers['user-agent'],
          request.ip
        );

        // Set HttpOnly session cookie
        // Note: Use 'lax' for OAuth flows (strict blocks cross-origin redirects)
        reply.setCookie(authConfig.session.cookieName, session.sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: authConfig.session.maxAge / 1000,
          domain: authConfig.session.cookieDomain, // For cross-subdomain auth
        });

        // H-06: Set CSRF cookie for session-based auth
        setCsrfCookie(reply, authConfig.session.cookieDomain);

        // Redirect to frontend dashboard
        return reply.redirect(`${authConfig.frontendUrl}/dashboard`);

      } catch (error) {
        fastify.log.error(error, 'GitHub OAuth callback error');
        return reply.redirect(`${authConfig.frontendUrl}/login?error=auth_failed`);
      }
    });
  }

  // ============================================
  // EMAIL/PASSWORD AUTHENTICATION
  // ============================================

  /**
   * Register with Email/Password
   */
  fastify.post<{
    Body: { email: string; password: string; name?: string };
  }>('/auth/register', async (request, reply) => {
    try {
      const { email, password, name } = request.body;

      if (!email || !password) {
        return reply.status(400).send({
          error: 'Email and password are required',
          code: 'MISSING_FIELDS',
        });
      }

      // Register user
      const user = await passwordService.register(email, password, name);

      // Create session
      const session = await sessionService.createSession(
        user.id,
        request.headers['user-agent'],
        request.ip
      );

      // Set session cookie
      reply.setCookie(authConfig.session.cookieName, session.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: authConfig.session.maxAge / 1000,
        domain: authConfig.session.cookieDomain, // For cross-subdomain auth
      });

      // H-06: Set CSRF cookie for session-based auth
      const csrfToken = setCsrfCookie(reply, authConfig.session.cookieDomain);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        csrfToken, // Return token so client can use it immediately
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      return reply.status(400).send({
        error: message,
        code: 'REGISTRATION_FAILED',
      });
    }
  });

  /**
   * Login with Email/Password
   * C-03: Protected against brute-force attacks with progressive rate limiting
   */
  fastify.post<{
    Body: { email: string; password: string };
  }>('/auth/login', async (request, reply) => {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.status(400).send({
          error: 'Email and password are required',
          code: 'MISSING_FIELDS',
        });
      }

      // C-03: Check brute-force protection before attempting login
      const rateLimitResult = await loginRateLimiter.consume(request.ip, email);
      if (!rateLimitResult.allowed) {
        return reply.status(429).send({
          error: 'Too many login attempts. Please try again later.',
          code: 'TOO_MANY_ATTEMPTS',
          retryAfter: rateLimitResult.retryAfter,
        });
      }

      // Authenticate user
      // H-16: Pass context for security logging
      const user = await passwordService.login(email, password, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      // C-03: Reset rate limiter on successful login
      await loginRateLimiter.reset(request.ip, email);

      // Create session
      const session = await sessionService.createSession(
        user.id,
        request.headers['user-agent'],
        request.ip
      );

      // Set session cookie
      reply.setCookie(authConfig.session.cookieName, session.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: authConfig.session.maxAge / 1000,
        domain: authConfig.session.cookieDomain, // For cross-subdomain auth
      });

      // H-06: Set CSRF cookie for session-based auth
      const csrfToken = setCsrfCookie(reply, authConfig.session.cookieDomain);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        },
        account: user.account ? {
          id: user.account.id,
          tier: user.account.tier,
          monthlyCredits: user.account.monthlyCredits,
          usedCredits: user.account.usedCredits,
        } : null,
        csrfToken, // Return token so client can use it immediately
      };
    } catch (error) {
      // C-03: Rate limit point already consumed, so failed attempts are tracked
      const message = error instanceof Error ? error.message : 'Login failed';
      return reply.status(401).send({
        error: message,
        code: 'LOGIN_FAILED',
      });
    }
  });

  /**
   * Change Password (authenticated)
   */
  fastify.post<{
    Body: { currentPassword: string; newPassword: string };
  }>('/auth/change-password', async (request, reply) => {
    const sessionToken = request.cookies[authConfig.session.cookieName];

    if (!sessionToken) {
      return reply.status(401).send({
        error: 'Not authenticated',
        code: 'NO_SESSION',
      });
    }

    const session = await sessionService.validateSession(sessionToken);

    if (!session) {
      reply.clearCookie(authConfig.session.cookieName, { path: '/' });
      return reply.status(401).send({
        error: 'Session expired',
        code: 'SESSION_EXPIRED',
      });
    }

    try {
      const { currentPassword, newPassword } = request.body;

      if (!currentPassword || !newPassword) {
        return reply.status(400).send({
          error: 'Current and new password are required',
          code: 'MISSING_FIELDS',
        });
      }

      await passwordService.changePassword(session.user.id, currentPassword, newPassword);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password change failed';
      return reply.status(400).send({
        error: message,
        code: 'PASSWORD_CHANGE_FAILED',
      });
    }
  });

  // ============================================
  // GOOGLE OAUTH (unchanged)
  // ============================================

  /**
   * Get Current User
   * Returns the authenticated user's data
   */
  fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionToken = request.cookies[authConfig.session.cookieName];

    if (!sessionToken) {
      return reply.status(401).send({
        error: 'Not authenticated',
        code: 'NO_SESSION',
      });
    }

    const session = await sessionService.validateSession(sessionToken);

    if (!session) {
      // Clear invalid cookie
      reply.clearCookie(authConfig.session.cookieName, { path: '/' });
      return reply.status(401).send({
        error: 'Session expired',
        code: 'SESSION_EXPIRED',
      });
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
      account: session.user.account ? {
        id: session.user.account.id,
        tier: session.user.account.tier,
        monthlyCredits: session.user.account.monthlyCredits,
        usedCredits: session.user.account.usedCredits,
      } : null,
    };
  });

  /**
   * Logout
   * Invalidates the current session
   */
  fastify.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionToken = request.cookies[authConfig.session.cookieName];

    if (sessionToken) {
      await sessionService.invalidateSession(sessionToken);
    }

    reply.clearCookie(authConfig.session.cookieName, { path: '/' });

    return { success: true };
  });

  /**
   * Logout Everywhere
   * Invalidates all sessions for the current user
   */
  fastify.post('/auth/logout-all', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionToken = request.cookies[authConfig.session.cookieName];

    if (!sessionToken) {
      return reply.status(401).send({
        error: 'Not authenticated',
        code: 'NO_SESSION',
      });
    }

    const session = await sessionService.validateSession(sessionToken);

    if (!session) {
      reply.clearCookie(authConfig.session.cookieName, { path: '/' });
      return reply.status(401).send({
        error: 'Session expired',
        code: 'SESSION_EXPIRED',
      });
    }

    // Invalidate all sessions for this user
    await sessionService.invalidateAllUserSessions(session.user.id);

    reply.clearCookie(authConfig.session.cookieName, { path: '/' });

    return { success: true };
  });

  /**
   * Session Check
   * Quick endpoint to check if session is valid and get user info
   */
  fastify.get('/auth/session', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionToken = request.cookies[authConfig.session.cookieName];

    if (!sessionToken) {
      return { authenticated: false };
    }

    const session = await sessionService.validateSession(sessionToken);

    if (!session) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      expiresAt: session.expires?.toISOString() || null,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        avatarUrl: session.user.image,
      },
    };
  });

  /**
   * Get User Sessions
   * Returns all active sessions for the current user
   */
  fastify.get('/auth/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionToken = request.cookies[authConfig.session.cookieName];

    if (!sessionToken) {
      return reply.status(401).send({
        error: 'Not authenticated',
        code: 'NO_SESSION',
      });
    }

    const session = await sessionService.validateSession(sessionToken);

    if (!session) {
      reply.clearCookie(authConfig.session.cookieName, { path: '/' });
      return reply.status(401).send({
        error: 'Session expired',
        code: 'SESSION_EXPIRED',
      });
    }

    const sessions = await sessionService.getUserSessions(session.user.id);

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expires.toISOString(),
        isCurrent: s.id === session.id,
      })),
    };
  });

  /**
   * Revoke Session
   * Invalidates a specific session by ID
   */
  fastify.delete<{ Params: { sessionId: string } }>(
    '/auth/sessions/:sessionId',
    async (request, reply) => {
      const sessionToken = request.cookies[authConfig.session.cookieName];

      if (!sessionToken) {
        return reply.status(401).send({
          error: 'Not authenticated',
          code: 'NO_SESSION',
        });
      }

      const session = await sessionService.validateSession(sessionToken);

      if (!session) {
        reply.clearCookie(authConfig.session.cookieName, { path: '/' });
        return reply.status(401).send({
          error: 'Session expired',
          code: 'SESSION_EXPIRED',
        });
      }

      await sessionService.invalidateSessionById(request.params.sessionId, session.user.id);

      return { success: true };
    }
  );
}
