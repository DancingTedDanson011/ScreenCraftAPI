// RapidAPI Configuration
// Handles RapidAPI subscription to internal tier mapping

import { z } from 'zod';
import { Tier } from '@prisma/client';

const rapidApiEnvSchema = z.object({
  RAPIDAPI_PROXY_SECRET: z.string().optional(),
  RAPIDAPI_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
});

const parsedRapidApiEnv = rapidApiEnvSchema.parse(process.env);

export const rapidApiConfig = {
  enabled: parsedRapidApiEnv.RAPIDAPI_ENABLED,
  proxySecret: parsedRapidApiEnv.RAPIDAPI_PROXY_SECRET,
} as const;

/**
 * RapidAPI Subscription Tier Mapping
 * Maps RapidAPI subscription names to internal tier levels
 */
export const RAPIDAPI_SUBSCRIPTION_MAPPING: Record<string, Tier> = {
  // Free tier
  BASIC: Tier.FREE,
  basic: Tier.FREE,
  free: Tier.FREE,
  FREE: Tier.FREE,

  // Pro tier
  PRO: Tier.PRO,
  pro: Tier.PRO,
  PROFESSIONAL: Tier.PRO,
  professional: Tier.PRO,
  PLUS: Tier.PRO,
  plus: Tier.PRO,

  // Business tier
  BUSINESS: Tier.BUSINESS,
  business: Tier.BUSINESS,
  ULTRA: Tier.BUSINESS,
  ultra: Tier.BUSINESS,
  MEGA: Tier.BUSINESS,
  mega: Tier.BUSINESS,

  // Enterprise tier
  ENTERPRISE: Tier.ENTERPRISE,
  enterprise: Tier.ENTERPRISE,
  UNLIMITED: Tier.ENTERPRISE,
  unlimited: Tier.ENTERPRISE,
};

/**
 * Map RapidAPI subscription to internal tier
 * Defaults to FREE if subscription is unknown
 */
export function mapSubscriptionToTier(subscription: string | undefined): Tier {
  if (!subscription) {
    return Tier.FREE;
  }

  const tier = RAPIDAPI_SUBSCRIPTION_MAPPING[subscription];
  return tier ?? Tier.FREE;
}

/**
 * Validate RapidAPI Proxy Secret
 */
export function validateProxySecret(secret: string | undefined): boolean {
  if (!rapidApiConfig.enabled) {
    return false; // RapidAPI not enabled
  }

  if (!rapidApiConfig.proxySecret) {
    console.warn('RAPIDAPI_PROXY_SECRET not configured');
    return false;
  }

  return secret === rapidApiConfig.proxySecret;
}

/**
 * RapidAPI Headers
 */
export interface RapidApiHeaders {
  'x-rapidapi-proxy-secret'?: string;
  'x-rapidapi-user'?: string;
  'x-rapidapi-subscription'?: string;
}

/**
 * Extract RapidAPI headers from request
 */
export function extractRapidApiHeaders(headers: Record<string, any>): RapidApiHeaders | null {
  const proxySecret = headers['x-rapidapi-proxy-secret'];
  const user = headers['x-rapidapi-user'];
  const subscription = headers['x-rapidapi-subscription'];

  // Must have at least proxy secret and user
  if (!proxySecret || !user) {
    return null;
  }

  return {
    'x-rapidapi-proxy-secret': proxySecret,
    'x-rapidapi-user': user,
    'x-rapidapi-subscription': subscription,
  };
}
