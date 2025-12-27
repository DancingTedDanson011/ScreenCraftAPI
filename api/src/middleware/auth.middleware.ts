// Auth Middleware - API Key Validation with RapidAPI Support

import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiKeyService } from '../services/auth/api-key.service.js';
import { RapidApiService } from '../services/rapidapi/rapidapi.service.js';
import {
  extractRapidApiHeaders,
  validateProxySecret,
  rapidApiConfig,
} from '../config/rapidapi.config.js';
import type { ApiKeyInfo } from '../types/auth.types.js';

// Extend Fastify Request to include auth info
declare module 'fastify' {
  interface FastifyRequest {
    auth?: ApiKeyInfo;
  }
}

export interface AuthMiddlewareOptions {
  apiKeyService: ApiKeyService;
  rapidApiService?: RapidApiService;
}

/**
 * Auth Middleware
 * Supports BOTH:
 * 1. RapidAPI Headers (prioritized)
 * 2. API Key from Authorization header
 *
 * Attaches account/tier info to request
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  const { apiKeyService, rapidApiService } = options;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // PRIORITY 1: Check for RapidAPI headers
    if (rapidApiConfig.enabled && rapidApiService) {
      const rapidApiHeaders = extractRapidApiHeaders(
        request.headers as Record<string, any>
      );

      if (rapidApiHeaders) {
        // Validate proxy secret
        const isValidSecret = validateProxySecret(
          rapidApiHeaders['x-rapidapi-proxy-secret']
        );

        if (isValidSecret && rapidApiHeaders['x-rapidapi-user']) {
          try {
            const account = await rapidApiService.getOrCreateAccount(
              rapidApiHeaders['x-rapidapi-user'],
              rapidApiHeaders['x-rapidapi-subscription']
            );

            const authInfo: ApiKeyInfo = {
              id: account.id,
              accountId: account.id,
              tier: account.tier,
              monthlyCredits: account.monthlyCredits,
              usedCredits: account.usedCredits,
              isActive: true,
            };

            request.auth = authInfo;
            (request as any).rapidApiHeaders = rapidApiHeaders;
            return; // Successfully authenticated via RapidAPI
          } catch (error) {
            console.error('RapidAPI authentication error:', error);
            // Fall through to API key auth
          }
        }
      }
    }

    // PRIORITY 2: Check for API Key in Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing Authorization header or RapidAPI headers',
        code: 'MISSING_AUTH_HEADER',
      });
    }

    // Extract API key
    const apiKey = extractApiKey(authHeader);
    if (!apiKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid Authorization header format. Expected: "Bearer <api_key>"',
        code: 'INVALID_AUTH_FORMAT',
      });
    }

    // Validate API key
    const keyInfo = await apiKeyService.validateApiKey(apiKey);
    if (!keyInfo) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or revoked API key',
        code: 'INVALID_API_KEY',
      });
    }

    // Check if key is active
    if (!keyInfo.isActive) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'API key has been revoked',
        code: 'REVOKED_API_KEY',
      });
    }

    // Attach auth info to request
    request.auth = keyInfo;
  };
}

/**
 * Extract API key from Authorization header
 * Supports:
 * - Bearer <key>
 * - <key>
 */
function extractApiKey(authHeader: string): string | null {
  // Remove "Bearer " prefix if present
  const normalized = authHeader.trim();

  if (normalized.toLowerCase().startsWith('bearer ')) {
    return normalized.substring(7).trim();
  }

  // Direct API key
  if (normalized.startsWith('sk_')) {
    return normalized;
  }

  return null;
}

/**
 * Optional auth middleware
 * Validates key if present, but doesn't require it
 * Supports both RapidAPI headers and API keys
 */
export function createOptionalAuthMiddleware(options: AuthMiddlewareOptions) {
  const { apiKeyService, rapidApiService } = options;

  return async (request: FastifyRequest, _reply: FastifyReply) => {
    // PRIORITY 1: Check for RapidAPI headers
    if (rapidApiConfig.enabled && rapidApiService) {
      const rapidApiHeaders = extractRapidApiHeaders(
        request.headers as Record<string, any>
      );

      if (rapidApiHeaders) {
        const isValidSecret = validateProxySecret(
          rapidApiHeaders['x-rapidapi-proxy-secret']
        );

        if (isValidSecret && rapidApiHeaders['x-rapidapi-user']) {
          try {
            const account = await rapidApiService.getOrCreateAccount(
              rapidApiHeaders['x-rapidapi-user'],
              rapidApiHeaders['x-rapidapi-subscription']
            );

            const authInfo: ApiKeyInfo = {
              id: account.id,
              accountId: account.id,
              tier: account.tier,
              monthlyCredits: account.monthlyCredits,
              usedCredits: account.usedCredits,
              isActive: true,
            };

            request.auth = authInfo;
            (request as any).rapidApiHeaders = rapidApiHeaders;
            return; // Successfully authenticated via RapidAPI
          } catch (error) {
            console.error('Optional RapidAPI auth error:', error);
          }
        }
      }
    }

    // PRIORITY 2: Check for API key
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return; // No auth header, continue without auth
    }

    const apiKey = extractApiKey(authHeader);
    if (!apiKey) {
      return; // Invalid format, continue without auth
    }

    const keyInfo = await apiKeyService.validateApiKey(apiKey);
    if (keyInfo && keyInfo.isActive) {
      request.auth = keyInfo;
    }
  };
}
