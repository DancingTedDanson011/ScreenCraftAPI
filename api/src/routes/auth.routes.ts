// Authentication Routes - Email/Password + Google OAuth

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import oauthPlugin from '@fastify/oauth2';
import { oauthService } from '../services/auth/oauth.service.js';
import { sessionService } from '../services/auth/session.service.js';
import { passwordService } from '../services/auth/password.service.js';
import { authConfig } from '../config/auth.config.js';

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
  // Register Google OAuth2 Plugin
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
      });

      // Create session
      const session = await sessionService.createSession(
        user.id,
        request.headers['user-agent'],
        request.ip
      );

      // Set HttpOnly session cookie
      reply.setCookie(authConfig.session.cookieName, session.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: authConfig.session.maxAge / 1000, // Convert to seconds
      });

      // Redirect to frontend dashboard
      return reply.redirect(`${authConfig.frontendUrl}/dashboard`);

    } catch (error) {
      fastify.log.error(error, 'Google OAuth callback error');
      return reply.redirect(`${authConfig.frontendUrl}/login?error=auth_failed`);
    }
  });

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
        sameSite: 'lax',
        path: '/',
        maxAge: authConfig.session.maxAge / 1000,
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
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

      // Authenticate user
      const user = await passwordService.login(email, password);

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
        sameSite: 'lax',
        path: '/',
        maxAge: authConfig.session.maxAge / 1000,
      });

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
      };
    } catch (error) {
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
   * Quick endpoint to check if session is valid
   */
  fastify.get('/auth/session', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionToken = request.cookies[authConfig.session.cookieName];

    if (!sessionToken) {
      return { authenticated: false };
    }

    const session = await sessionService.validateSession(sessionToken);

    return {
      authenticated: !!session,
      expiresAt: session?.expires?.toISOString() || null,
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
