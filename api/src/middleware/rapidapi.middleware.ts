// RapidAPI Middleware - Validates RapidAPI Headers and Creates/Updates Accounts

import { FastifyRequest, FastifyReply } from 'fastify';
import { RapidApiService } from '../services/rapidapi/rapidapi.service.js';
import {
  extractRapidApiHeaders,
  validateProxySecret,
  rapidApiConfig,
} from '../config/rapidapi.config.js';
import type { ApiKeyInfo } from '../types/auth.types.js';

export interface RapidApiMiddlewareOptions {
  rapidApiService: RapidApiService;
}

/**
 * RapidAPI Middleware
 * Validates RapidAPI headers and creates/updates accounts automatically
 * Attaches account info to request.auth
 */
export function createRapidApiMiddleware(options: RapidApiMiddlewareOptions) {
  const { rapidApiService } = options;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip if RapidAPI is not enabled
    if (!rapidApiConfig.enabled) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'RapidAPI integration is not enabled',
        code: 'RAPIDAPI_DISABLED',
      });
    }

    // Extract RapidAPI headers
    const rapidApiHeaders = extractRapidApiHeaders(
      request.headers as Record<string, any>
    );

    if (!rapidApiHeaders) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing required RapidAPI headers (x-rapidapi-proxy-secret, x-rapidapi-user)',
        code: 'MISSING_RAPIDAPI_HEADERS',
      });
    }

    // Validate proxy secret
    const isValidSecret = validateProxySecret(
      rapidApiHeaders['x-rapidapi-proxy-secret']
    );

    if (!isValidSecret) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid RapidAPI proxy secret',
        code: 'INVALID_PROXY_SECRET',
      });
    }

    // Get or create account for RapidAPI user
    try {
      const account = await rapidApiService.getOrCreateAccount(
        rapidApiHeaders['x-rapidapi-user']!,
        rapidApiHeaders['x-rapidapi-subscription']
      );

      // Attach auth info to request (compatible with existing auth middleware)
      const authInfo: ApiKeyInfo = {
        id: account.id, // Using account ID as key ID for RapidAPI users
        accountId: account.id,
        tier: account.tier,
        monthlyCredits: account.monthlyCredits,
        usedCredits: account.usedCredits,
        isActive: true,
      };

      request.auth = authInfo;

      // Store original RapidAPI headers for debugging/logging
      (request as any).rapidApiHeaders = rapidApiHeaders;
    } catch (error) {
      console.error('Error processing RapidAPI request:', error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process RapidAPI authentication',
        code: 'RAPIDAPI_AUTH_ERROR',
      });
    }
  };
}

/**
 * Optional RapidAPI Middleware
 * Processes RapidAPI headers if present, but doesn't require them
 */
export function createOptionalRapidApiMiddleware(options: RapidApiMiddlewareOptions) {
  const { rapidApiService } = options;

  return async (request: FastifyRequest, _reply: FastifyReply) => {
    // Skip if RapidAPI is not enabled
    if (!rapidApiConfig.enabled) {
      return;
    }

    // Extract RapidAPI headers
    const rapidApiHeaders = extractRapidApiHeaders(
      request.headers as Record<string, any>
    );

    if (!rapidApiHeaders) {
      return; // No RapidAPI headers, continue
    }

    // Validate proxy secret
    const isValidSecret = validateProxySecret(
      rapidApiHeaders['x-rapidapi-proxy-secret']
    );

    if (!isValidSecret) {
      return; // Invalid secret, continue without auth
    }

    // Get or create account
    try {
      const account = await rapidApiService.getOrCreateAccount(
        rapidApiHeaders['x-rapidapi-user']!,
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
    } catch (error) {
      console.error('Error processing optional RapidAPI request:', error);
      // Continue without auth on error
    }
  };
}

/**
 * Check if request is from RapidAPI
 */
export function isRapidApiRequest(request: FastifyRequest): boolean {
  return !!(request as any).rapidApiHeaders;
}
