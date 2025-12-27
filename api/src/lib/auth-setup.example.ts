// Auth System Setup Example
// This file shows how to integrate the auth system into your Fastify app

import Fastify from 'fastify';
import { Redis } from 'ioredis';
import { ApiKeyService } from '../services/auth/index.js';
import { UsageService } from '../services/billing/index.js';
import {
  createAuthMiddleware,
  createRateLimitMiddleware,
  createIpRateLimitMiddleware,
} from '../middleware/index.js';
import { EventType } from '@prisma/client';

/**
 * Initialize Auth System
 */
export function setupAuthSystem() {
  // Initialize Redis
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  });

  // Initialize services
  const apiKeyService = new ApiKeyService(redis);
  const usageService = new UsageService();

  // Create middlewares
  const authMiddleware = createAuthMiddleware({ apiKeyService });
  const rateLimitMiddleware = createRateLimitMiddleware({ redis });
  const ipRateLimitMiddleware = createIpRateLimitMiddleware({ redis });

  return {
    redis,
    apiKeyService,
    usageService,
    authMiddleware,
    rateLimitMiddleware,
    ipRateLimitMiddleware,
  };
}

/**
 * Example: Protected Route with Auth + Rate Limiting
 */
export async function exampleProtectedRoute() {
  const app = Fastify();
  const { authMiddleware, rateLimitMiddleware, usageService } = setupAuthSystem();

  app.post('/v1/screenshot', {
    preHandler: [authMiddleware, rateLimitMiddleware],
  }, async (request, reply) => {
    const { auth } = request;

    if (!auth) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Check quota
    const requiredCredits = usageService.getCreditCost(EventType.SCREENSHOT);
    const hasQuota = await usageService.checkQuota(auth.accountId, requiredCredits);

    if (!hasQuota) {
      return reply.status(402).send({
        error: 'Insufficient Credits',
        message: 'Your account has run out of credits. Please upgrade your plan.',
        code: 'INSUFFICIENT_CREDITS',
      });
    }

    // Process screenshot...
    // const screenshot = await generateScreenshot(...);

    // Record usage
    await usageService.recordUsage({
      accountId: auth.accountId,
      eventType: EventType.SCREENSHOT,
      credits: requiredCredits,
      metadata: {
        url: 'https://example.com',
        viewport: { width: 1920, height: 1080 },
      },
    });

    return reply.send({
      success: true,
      creditsUsed: requiredCredits,
      remainingCredits: auth.monthlyCredits - auth.usedCredits - requiredCredits,
    });
  });

  return app;
}

/**
 * Example: Create API Key
 */
export async function exampleCreateApiKey() {
  const { apiKeyService } = setupAuthSystem();

  // Create a new API key
  const newKey = await apiKeyService.createApiKey(
    'account-uuid-here',
    'Production API Key',
    'live'
  );

  console.log('🔑 New API Key Created:');
  console.log('Key:', newKey.key); // Show only once!
  console.log('Prefix:', newKey.prefix);
  console.log('⚠️  Save this key securely - it will not be shown again!');

  return newKey;
}

/**
 * Example: Get Usage Stats
 */
export async function exampleGetUsageStats() {
  const { usageService } = setupAuthSystem();

  const stats = await usageService.getUsage('account-uuid-here');

  console.log('📊 Usage Statistics:');
  console.log('Tier:', stats.tier);
  console.log('Used Credits:', stats.usedCredits);
  console.log('Remaining Credits:', stats.remainingCredits);
  console.log('Monthly Limit:', stats.monthlyCredits);
  console.log('Period:', stats.currentPeriodStart, 'to', stats.currentPeriodEnd);

  return stats;
}

/**
 * Example: Check Quota Before Operation
 */
export async function exampleCheckQuota(accountId: string) {
  const { usageService } = setupAuthSystem();

  const cost = usageService.estimateCost({
    eventType: EventType.SCREENSHOT_FULLPAGE,
    quantity: 10,
  });

  console.log('💰 Estimated Cost:', cost.credits, 'credits');

  const hasQuota = await usageService.checkQuota(accountId, cost.credits);

  if (!hasQuota) {
    throw new Error('Insufficient credits for this operation');
  }

  return hasQuota;
}
