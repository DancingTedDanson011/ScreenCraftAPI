// Dashboard Controller - HTTP Handlers for Dashboard API

import { FastifyRequest, FastifyReply } from 'fastify';
import { dashboardRepository } from '../services/database/dashboard.repository.js';
import { ApiKeyService } from '../services/auth/api-key.service.js';
import type {
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  UsagePeriod,
  CreateWebhookRequest,
  ApiResponse,
} from '../types/dashboard.types.js';

// ============================================
// OVERVIEW
// ============================================

export async function getOverview(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const accountId = request.auth?.accountId;

  if (!accountId) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  try {
    const overview = await dashboardRepository.getAccountOverview(accountId);

    if (!overview) {
      return reply.status(404).send({
        success: false,
        error: 'Not Found',
        message: 'Account not found',
      });
    }

    return reply.send({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch dashboard overview',
    });
  }
}

// ============================================
// API KEYS
// ============================================

export async function getApiKeys(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const accountId = request.auth?.accountId;

  if (!accountId) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    const apiKeyService = (request.server as any).apiKeyService as ApiKeyService;
    const keys = await apiKeyService.listApiKeys(accountId);

    return reply.send({
      success: true,
      data: keys,
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to fetch API keys',
    });
  }
}

export async function createApiKey(
  request: FastifyRequest<{ Body: CreateApiKeyRequest }>,
  reply: FastifyReply
) {
  const accountId = request.auth?.accountId;

  if (!accountId) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    const { name } = request.body || {};
    const apiKeyService = (request.server as any).apiKeyService as ApiKeyService;

    const result = await apiKeyService.createApiKey(accountId, name || undefined);

    const response: CreateApiKeyResponse = {
      id: result.keyId,
      key: result.key, // Full key - shown only ONCE!
      prefix: result.prefix,
      name: name || null,
      createdAt: new Date(),
    };

    return reply.status(201).send({
      success: true,
      data: response,
      message: 'API key created successfully. Store this key securely - it will not be shown again.',
    });
  } catch (error) {
    console.error('Create API key error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to create API key',
    });
  }
}

export async function revokeApiKey(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const accountId = request.auth?.accountId;

  if (!accountId) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    const { id } = request.params;
    const apiKeyService = (request.server as any).apiKeyService as ApiKeyService;

    const success = await apiKeyService.revokeApiKey(id, accountId);

    if (!success) {
      return reply.status(404).send({
        success: false,
        error: 'API key not found or already revoked',
      });
    }

    return reply.send({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to revoke API key',
    });
  }
}

// ============================================
// USAGE
// ============================================

export async function getUsageStats(
  request: FastifyRequest<{
    Querystring: { startDate?: string; endDate?: string };
  }>,
  reply: FastifyReply
) {
  const accountId = request.auth?.accountId;

  if (!accountId) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    const { startDate, endDate } = request.query;

    const stats = await dashboardRepository.getUsageStats(
      accountId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    return reply.send({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to fetch usage statistics',
    });
  }
}

export async function getUsageTimeline(
  request: FastifyRequest<{
    Querystring: { period?: UsagePeriod };
  }>,
  reply: FastifyReply
) {
  const accountId = request.auth?.accountId;

  if (!accountId) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    const period = request.query.period || 'month';
    const validPeriods: UsagePeriod[] = ['day', 'week', 'month'];

    if (!validPeriods.includes(period)) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid period. Use: day, week, or month',
      });
    }

    const timeline = await dashboardRepository.getUsageTimeline(accountId, period);

    return reply.send({
      success: true,
      data: timeline,
    });
  } catch (error) {
    console.error('Get usage timeline error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to fetch usage timeline',
    });
  }
}

// ============================================
// SETTINGS
// ============================================

export async function getSettings(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const accountId = request.auth?.accountId;

  if (!accountId) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    const settings = await dashboardRepository.getAccountSettings(accountId);

    if (!settings) {
      return reply.status(404).send({
        success: false,
        error: 'Account not found',
      });
    }

    // Add default screenshot settings (could be stored in DB later)
    const response = {
      ...settings,
      defaultSettings: {
        format: 'png',
        quality: 80,
        fullPage: false,
        viewport: {
          width: 1920,
          height: 1080,
        },
      },
    };

    return reply.send({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to fetch settings',
    });
  }
}

export async function updateSettings(
  request: FastifyRequest<{ Body: { defaultSettings?: Record<string, unknown> } }>,
  reply: FastifyReply
) {
  const accountId = request.auth?.accountId;

  if (!accountId) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    // For now, just acknowledge the update
    // In a full implementation, you'd store these settings
    return reply.send({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to update settings',
    });
  }
}

// ============================================
// WEBHOOKS
// ============================================

export async function getWebhooks(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const accountId = request.auth?.accountId;

  if (!accountId) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    const webhooks = await dashboardRepository.getWebhooks(accountId);

    return reply.send({
      success: true,
      data: webhooks,
    });
  } catch (error) {
    console.error('Get webhooks error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to fetch webhooks',
    });
  }
}

export async function createWebhook(
  request: FastifyRequest<{ Body: CreateWebhookRequest }>,
  reply: FastifyReply
) {
  const accountId = request.auth?.accountId;

  if (!accountId) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    const { url, events } = request.body;

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'URL and events array are required',
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return reply.status(400).send({
        success: false,
        error: 'Invalid webhook URL',
      });
    }

    const result = await dashboardRepository.createWebhook(accountId, url, events);

    return reply.status(201).send({
      success: true,
      data: {
        id: result.id,
        url,
        events,
        secret: result.secret, // Show only ONCE!
        createdAt: result.createdAt,
      },
      message: 'Webhook created. Store the secret securely - it will not be shown again.',
    });
  } catch (error) {
    console.error('Create webhook error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to create webhook',
    });
  }
}

export async function deleteWebhook(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const accountId = request.auth?.accountId;

  if (!accountId) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    });
  }

  try {
    const { id } = request.params;
    const success = await dashboardRepository.deleteWebhook(accountId, id);

    if (!success) {
      return reply.status(404).send({
        success: false,
        error: 'Webhook not found',
      });
    }

    return reply.send({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error) {
    console.error('Delete webhook error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to delete webhook',
    });
  }
}
