/**
 * Admin-specific Rate Limiting Middleware
 * M-09: Redis-based rate limiting for distributed environments
 * Provides brute-force protection for admin authentication
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { Redis } from 'ioredis';
import { config } from '../../config/index.js';

// Configuration
const MAX_ATTEMPTS = 5;                    // Max failed attempts
const WINDOW_SECONDS = 15 * 60;            // 15 minutes window
const BLOCK_DURATION_SECONDS = 30 * 60;    // 30 minutes block

// Redis key prefixes
const RATE_LIMIT_PREFIX = 'admin_rate_limit:';
const BLOCK_PREFIX = 'admin_blocked:';

// Shared Redis instance (created lazily)
let redis: Redis | null = null;

/**
 * Get or create Redis connection
 */
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      lazyConnect: true,
      // Reconnect strategy
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redis.on('error', (err) => {
      console.error('Admin rate limit Redis error:', err);
    });
  }
  return redis;
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeRateLimitRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/**
 * Get client identifier (IP address)
 */
function getClientId(request: FastifyRequest): string {
  return request.ip ||
         request.headers['x-forwarded-for']?.toString().split(',')[0] ||
         'unknown';
}

/**
 * Admin login rate limit middleware
 * Blocks IP after too many failed login attempts
 */
export async function adminLoginRateLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const clientId = getClientId(request);
  const redisClient = getRedis();

  try {
    // Check if currently blocked
    const blockKey = `${BLOCK_PREFIX}${clientId}`;
    const blockedTtl = await redisClient.ttl(blockKey);

    if (blockedTtl > 0) {
      return reply.status(429).send({
        error: 'Too many login attempts',
        message: `Please try again in ${blockedTtl} seconds`,
        retryAfter: blockedTtl,
        code: 'RATE_LIMITED',
      });
    }
  } catch (error) {
    // Log error but don't block the request if Redis fails
    request.log.error(error, 'Admin rate limit check failed');
  }
}

/**
 * Record a failed login attempt
 * Call this after a failed login
 */
export async function recordFailedLogin(request: FastifyRequest): Promise<void> {
  const clientId = getClientId(request);
  const redisClient = getRedis();

  try {
    const attemptKey = `${RATE_LIMIT_PREFIX}${clientId}`;
    const blockKey = `${BLOCK_PREFIX}${clientId}`;

    // Increment attempt counter with atomic operation
    const attempts = await redisClient.incr(attemptKey);

    // Set expiry on first attempt
    if (attempts === 1) {
      await redisClient.expire(attemptKey, WINDOW_SECONDS);
    }

    // Block if too many attempts
    if (attempts >= MAX_ATTEMPTS) {
      await redisClient.set(blockKey, '1', 'EX', BLOCK_DURATION_SECONDS);
      // Clear the attempts counter
      await redisClient.del(attemptKey);
    }
  } catch (error) {
    // Log error but continue - rate limiting is defense in depth
    console.error('Failed to record login attempt:', error);
  }
}

/**
 * Clear login attempts after successful login
 */
export async function clearLoginAttempts(request: FastifyRequest): Promise<void> {
  const clientId = getClientId(request);
  const redisClient = getRedis();

  try {
    const attemptKey = `${RATE_LIMIT_PREFIX}${clientId}`;
    await redisClient.del(attemptKey);
  } catch (error) {
    // Log error but continue
    console.error('Failed to clear login attempts:', error);
  }
}

/**
 * Get current attempt status (for logging/monitoring)
 */
export async function getAttemptStatus(request: FastifyRequest): Promise<{
  attempts: number;
  blocked: boolean;
  remainingAttempts: number;
  blockTtl?: number;
}> {
  const clientId = getClientId(request);
  const redisClient = getRedis();

  try {
    const attemptKey = `${RATE_LIMIT_PREFIX}${clientId}`;
    const blockKey = `${BLOCK_PREFIX}${clientId}`;

    const [attemptsStr, blockedTtl] = await Promise.all([
      redisClient.get(attemptKey),
      redisClient.ttl(blockKey),
    ]);

    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
    const blocked = blockedTtl > 0;

    return {
      attempts,
      blocked,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - attempts),
      ...(blocked && { blockTtl: blockedTtl }),
    };
  } catch (error) {
    console.error('Failed to get attempt status:', error);
    return { attempts: 0, blocked: false, remainingAttempts: MAX_ATTEMPTS };
  }
}
