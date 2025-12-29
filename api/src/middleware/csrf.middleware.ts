/**
 * CSRF Protection Middleware
 * H-06: Protect against Cross-Site Request Forgery attacks
 *
 * Uses Double Submit Cookie pattern:
 * 1. Server generates a random CSRF token and sets it in a cookie
 * 2. Client must include the token in a custom header (X-CSRF-Token)
 * 3. Server validates that cookie value matches header value
 *
 * This works because:
 * - Cookies are sent automatically by the browser
 * - Custom headers cannot be set by cross-origin requests without CORS approval
 * - An attacker cannot read the CSRF cookie value due to SameSite cookie policy
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Methods that require CSRF protection
const PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

// Paths that are exempt from CSRF protection (webhooks use their own verification)
const EXEMPT_PATHS = [
  '/v1/payment/webhooks/stripe',
  '/health',
];

/**
 * Generate a random CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * CSRF Protection Middleware
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 */
export async function csrfMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
  if (!PROTECTED_METHODS.includes(request.method)) {
    return;
  }

  // Skip CSRF for exempt paths (webhooks)
  if (EXEMPT_PATHS.some((path) => request.url.startsWith(path))) {
    return;
  }

  // Skip CSRF for API key authenticated requests
  // API keys are not vulnerable to CSRF as they're not automatically sent by browsers
  if (request.auth?.source === 'api-key' || request.auth?.source === 'rapidapi') {
    return;
  }

  // For session-based auth, validate CSRF token
  const cookieToken = request.cookies[CSRF_COOKIE_NAME];
  const headerToken = request.headers[CSRF_HEADER_NAME] as string | undefined;

  // If no session cookie, no CSRF check needed
  // (Request will fail auth anyway)
  if (!request.cookies['screencraft_session']) {
    return;
  }

  // Validate CSRF token
  if (!cookieToken || !headerToken) {
    reply.status(403).send({
      success: false,
      error: 'CSRF token missing',
      code: 'CSRF_MISSING',
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(cookieToken, headerToken)) {
    reply.status(403).send({
      success: false,
      error: 'CSRF token invalid',
      code: 'CSRF_INVALID',
    });
    return;
  }
}

/**
 * Constant-time string comparison
 * Prevents timing attacks by always comparing all bytes
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Set CSRF cookie on responses
 * Should be called after successful authentication
 * @param reply - Fastify reply object
 * @param domain - Optional cookie domain for cross-subdomain auth
 */
export function setCsrfCookie(reply: FastifyReply, domain?: string): string {
  const token = generateCsrfToken();

  reply.setCookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
    domain, // For cross-subdomain auth
  });

  return token;
}

/**
 * Register CSRF protection plugin
 */
export async function registerCsrfProtection(fastify: FastifyInstance): Promise<void> {
  // Add hook to check CSRF on protected methods
  fastify.addHook('preHandler', csrfMiddleware);

  // Add endpoint to get new CSRF token
  fastify.get('/auth/csrf-token', async (request, reply) => {
    const token = setCsrfCookie(reply);

    return {
      success: true,
      token,
    };
  });
}

/**
 * Export constants for use in frontend
 */
export const CSRF_CONFIG = {
  cookieName: CSRF_COOKIE_NAME,
  headerName: CSRF_HEADER_NAME,
} as const;
