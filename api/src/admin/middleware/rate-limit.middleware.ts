/**
 * Admin-specific Rate Limiting Middleware
 * Provides brute-force protection for admin authentication
 */

import { FastifyRequest, FastifyReply } from 'fastify';

// Simple in-memory rate limiter for login attempts
// In production, use Redis for distributed rate limiting
interface LoginAttempt {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const loginAttempts = new Map<string, LoginAttempt>();

// Configuration
const MAX_ATTEMPTS = 5;              // Max failed attempts
const WINDOW_MS = 15 * 60 * 1000;    // 15 minutes window
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes block

/**
 * Get client identifier (IP address)
 */
function getClientId(request: FastifyRequest): string {
  return request.ip ||
         request.headers['x-forwarded-for']?.toString().split(',')[0] ||
         'unknown';
}

/**
 * Clean up old entries periodically
 */
function cleanupOldEntries(): void {
  const now = Date.now();
  for (const [key, attempt] of loginAttempts.entries()) {
    if (now - attempt.firstAttempt > WINDOW_MS && !attempt.blockedUntil) {
      loginAttempts.delete(key);
    }
    if (attempt.blockedUntil && now > attempt.blockedUntil) {
      loginAttempts.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupOldEntries, 5 * 60 * 1000);

/**
 * Admin login rate limit middleware
 * Blocks IP after too many failed login attempts
 */
export async function adminLoginRateLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const clientId = getClientId(request);
  const now = Date.now();

  let attempt = loginAttempts.get(clientId);

  // Check if currently blocked
  if (attempt?.blockedUntil && now < attempt.blockedUntil) {
    const remainingSeconds = Math.ceil((attempt.blockedUntil - now) / 1000);
    return reply.status(429).send({
      error: 'Too many login attempts',
      message: `Please try again in ${remainingSeconds} seconds`,
      retryAfter: remainingSeconds,
    });
  }

  // Reset if window expired
  if (attempt && (now - attempt.firstAttempt > WINDOW_MS)) {
    loginAttempts.delete(clientId);
    attempt = undefined;
  }
}

/**
 * Record a failed login attempt
 * Call this after a failed login
 */
export function recordFailedLogin(request: FastifyRequest): void {
  const clientId = getClientId(request);
  const now = Date.now();

  let attempt = loginAttempts.get(clientId);

  if (!attempt || (now - attempt.firstAttempt > WINDOW_MS)) {
    attempt = { count: 1, firstAttempt: now };
  } else {
    attempt.count++;

    // Block if too many attempts
    if (attempt.count >= MAX_ATTEMPTS) {
      attempt.blockedUntil = now + BLOCK_DURATION_MS;
    }
  }

  loginAttempts.set(clientId, attempt);
}

/**
 * Clear login attempts after successful login
 */
export function clearLoginAttempts(request: FastifyRequest): void {
  const clientId = getClientId(request);
  loginAttempts.delete(clientId);
}

/**
 * Get current attempt status (for logging/monitoring)
 */
export function getAttemptStatus(request: FastifyRequest): {
  attempts: number;
  blocked: boolean;
  remainingAttempts: number;
} {
  const clientId = getClientId(request);
  const attempt = loginAttempts.get(clientId);

  if (!attempt) {
    return { attempts: 0, blocked: false, remainingAttempts: MAX_ATTEMPTS };
  }

  const blocked = attempt.blockedUntil ? Date.now() < attempt.blockedUntil : false;

  return {
    attempts: attempt.count,
    blocked,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - attempt.count),
  };
}
