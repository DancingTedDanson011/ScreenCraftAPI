// Session Authentication Middleware

import { FastifyRequest, FastifyReply } from 'fastify';
import { sessionService } from '../services/auth/session.service.js';
import { authConfig } from '../config/auth.config.js';
import { User, Account } from '@prisma/client';

// Extend FastifyRequest to include user and account
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    account?: Account | null;
  }
}

/**
 * Session middleware to protect routes
 * Validates session cookie and attaches user data to request
 */
export async function sessionMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const sessionToken = request.cookies[authConfig.session.cookieName];

  if (!sessionToken) {
    return reply.status(401).send({
      error: 'Authentication required',
      code: 'NO_SESSION',
      message: 'Please log in to access this resource',
    });
  }

  const session = await sessionService.validateSession(sessionToken);

  if (!session) {
    // Clear invalid cookie
    reply.clearCookie(authConfig.session.cookieName, { path: '/' });
    return reply.status(401).send({
      error: 'Session expired',
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please log in again.',
    });
  }

  // Attach user and account to request for use in route handlers
  request.user = session.user;
  request.account = session.user.account;
}

/**
 * Optional session middleware - doesn't fail if not authenticated
 * Useful for routes that behave differently for authenticated users
 */
export async function optionalSessionMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const sessionToken = request.cookies[authConfig.session.cookieName];

  if (!sessionToken) {
    return; // Continue without user data
  }

  const session = await sessionService.validateSession(sessionToken);

  if (session) {
    request.user = session.user;
    request.account = session.user.account;
  }
}

/**
 * Account tier middleware - checks if user has required tier
 * Must be used after sessionMiddleware
 */
export function requireTier(...allowedTiers: string[]) {
  return async function tierMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    if (!request.account) {
      return reply.status(403).send({
        error: 'No account found',
        code: 'NO_ACCOUNT',
        message: 'You need an account to access this resource',
      });
    }

    if (!allowedTiers.includes(request.account.tier)) {
      return reply.status(403).send({
        error: 'Insufficient tier',
        code: 'TIER_REQUIRED',
        message: `This feature requires one of the following tiers: ${allowedTiers.join(', ')}`,
        currentTier: request.account.tier,
        requiredTiers: allowedTiers,
      });
    }
  };
}

/**
 * Credit check middleware - ensures user has enough credits
 * Must be used after sessionMiddleware
 */
export function requireCredits(creditsNeeded: number) {
  return async function creditMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    if (!request.account) {
      return reply.status(403).send({
        error: 'No account found',
        code: 'NO_ACCOUNT',
        message: 'You need an account to access this resource',
      });
    }

    const availableCredits = request.account.monthlyCredits - request.account.usedCredits;

    if (availableCredits < creditsNeeded) {
      return reply.status(403).send({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        message: 'You do not have enough credits for this operation',
        available: availableCredits,
        required: creditsNeeded,
      });
    }
  };
}
