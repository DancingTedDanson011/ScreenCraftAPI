// Rate Limiting Middleware - Tier-based Rate Limits

import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';
import { Tier } from '@prisma/client';
import { TIER_CONFIG } from '../types/auth.types.js';

export interface RateLimitMiddlewareOptions {
  redis: Redis;
}

/**
 * Rate Limiter Middleware
 * Implements tier-based rate limiting using Redis
 */
export class RateLimitMiddleware {
  private limiters: Map<Tier, RateLimiterRedis>;

  constructor(options: RateLimitMiddlewareOptions) {
    const { redis } = options;

    // Create a rate limiter for each tier
    this.limiters = new Map();

    for (const [tier, config] of Object.entries(TIER_CONFIG)) {
      this.limiters.set(tier as Tier, new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: `ratelimit:${tier}:`,
        points: config.points,
        duration: config.duration,
        blockDuration: 60, // Block for 1 minute if exceeded
      }));
    }
  }

  /**
   * Rate limit handler
   * Uses account tier to determine limits
   */
  async handle(request: FastifyRequest, reply: FastifyReply) {
    // Skip rate limiting if no auth
    if (!request.auth) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required for rate limiting',
        code: 'AUTH_REQUIRED',
      });
    }

    const { accountId, tier } = request.auth;
    const limiter = this.limiters.get(tier);

    if (!limiter) {
      // Fallback to FREE tier if unknown
      return this.applyRateLimit(
        this.limiters.get(Tier.FREE)!,
        accountId,
        tier,
        reply
      );
    }

    return this.applyRateLimit(limiter, accountId, tier, reply);
  }

  /**
   * Apply rate limit and set headers
   */
  private async applyRateLimit(
    limiter: RateLimiterRedis,
    accountId: string,
    tier: Tier,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const result: RateLimiterRes = await limiter.consume(accountId, 1);

      // Set rate limit headers
      this.setRateLimitHeaders(reply, result, tier);
    } catch (rateLimiterRes) {
      // Rate limit exceeded
      if (rateLimiterRes instanceof Error) {
        throw rateLimiterRes;
      }

      const res = rateLimiterRes as RateLimiterRes;
      this.setRateLimitHeaders(reply, res, tier);

      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded for ${tier} tier. Try again in ${Math.ceil(res.msBeforeNext / 1000)} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(res.msBeforeNext / 1000),
        tier,
      });
    }
  }

  /**
   * Set standard rate limit headers
   */
  private setRateLimitHeaders(
    reply: FastifyReply,
    result: RateLimiterRes,
    tier: Tier
  ): void {
    const tierConfig = TIER_CONFIG[tier];

    reply.header('X-RateLimit-Limit', tierConfig.points);
    reply.header('X-RateLimit-Remaining', result.remainingPoints);
    reply.header('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext).toISOString());
    reply.header('X-RateLimit-Tier', tier);
  }
}

/**
 * Create rate limit middleware factory
 */
export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions) {
  const middleware = new RateLimitMiddleware(options);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    return middleware.handle(request, reply);
  };
}

/**
 * Login brute-force protection
 * Tracks by IP + email to prevent credential stuffing
 * C-03: Critical security fix
 */
export function createLoginRateLimiter(options: RateLimitMiddlewareOptions) {
  const { redis } = options;

  // Track failed login attempts
  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'login_fail:',
    points: 5, // 5 failed attempts allowed
    duration: 15 * 60, // per 15 minutes
    blockDuration: 30 * 60, // Block for 30 minutes after exceeding
  });

  return {
    /**
     * Consume a point on login attempt (call before validating credentials)
     * Returns true if allowed, false if blocked
     */
    async consume(ip: string, email: string): Promise<{ allowed: boolean; retryAfter?: number }> {
      const key = `${ip}:${email.toLowerCase()}`;

      try {
        await limiter.consume(key, 1);
        return { allowed: true };
      } catch (rateLimiterRes) {
        if (rateLimiterRes instanceof Error) {
          throw rateLimiterRes;
        }
        const res = rateLimiterRes as RateLimiterRes;
        return {
          allowed: false,
          retryAfter: Math.ceil(res.msBeforeNext / 1000),
        };
      }
    },

    /**
     * Reset attempts on successful login
     */
    async reset(ip: string, email: string): Promise<void> {
      const key = `${ip}:${email.toLowerCase()}`;
      await limiter.delete(key);
    },

    /**
     * Get remaining attempts for a key
     */
    async getRemaining(ip: string, email: string): Promise<number> {
      const key = `${ip}:${email.toLowerCase()}`;
      try {
        const res = await limiter.get(key);
        return res ? Math.max(0, 5 - res.consumedPoints) : 5;
      } catch {
        return 5;
      }
    },
  };
}

/**
 * IP-based rate limiter for unauthenticated requests
 * More restrictive than authenticated limits
 */
export function createIpRateLimitMiddleware(options: RateLimitMiddlewareOptions) {
  const { redis } = options;

  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'ratelimit:ip:',
    points: 20, // 20 requests
    duration: 60, // per minute
    blockDuration: 300, // Block for 5 minutes
  });

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip if already authenticated
    if (request.auth) {
      return;
    }

    const ip = request.ip;

    try {
      const result = await limiter.consume(ip, 1);

      // Set headers
      reply.header('X-RateLimit-Limit', 20);
      reply.header('X-RateLimit-Remaining', result.remainingPoints);
      reply.header('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext).toISOString());
    } catch (rateLimiterRes) {
      if (rateLimiterRes instanceof Error) {
        throw rateLimiterRes;
      }

      const res = rateLimiterRes as RateLimiterRes;

      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(res.msBeforeNext / 1000)} seconds.`,
        code: 'IP_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(res.msBeforeNext / 1000),
      });
    }
  };
}
