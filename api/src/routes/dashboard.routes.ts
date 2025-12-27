// Dashboard Routes - User Dashboard API Endpoints

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  getOverview,
  getApiKeys,
  createApiKey,
  revokeApiKey,
  getUsageStats,
  getUsageTimeline,
  getSettings,
  updateSettings,
  getWebhooks,
  createWebhook,
  deleteWebhook,
} from '../controllers/dashboard.controller.js';

/**
 * Dashboard Routes
 * All routes require authentication via API key or session
 */
export async function dashboardRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // ============================================
  // OVERVIEW
  // ============================================

  /**
   * GET /dashboard/overview
   * Get complete dashboard overview including account info, quota, and recent activity
   */
  fastify.get('/overview', {
    schema: {
      description: 'Get dashboard overview with account info, quota, and recent activity',
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                account: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    tier: { type: 'string' },
                    createdAt: { type: 'string' },
                  },
                },
                quota: {
                  type: 'object',
                  properties: {
                    used: { type: 'number' },
                    limit: { type: 'number' },
                    percentage: { type: 'number' },
                    resetDate: { type: 'string' },
                  },
                },
                usage: {
                  type: 'object',
                  properties: {
                    screenshots: { type: 'number' },
                    pdfs: { type: 'number' },
                    totalCredits: { type: 'number' },
                  },
                },
                recentActivity: { type: 'array' },
              },
            },
          },
        },
      },
    },
    handler: getOverview,
  });

  // ============================================
  // API KEYS
  // ============================================

  /**
   * GET /dashboard/api-keys
   * List all API keys for the authenticated account
   */
  fastify.get('/api-keys', {
    schema: {
      description: 'List all API keys for the account',
      tags: ['Dashboard', 'API Keys'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string', nullable: true },
                  prefix: { type: 'string' },
                  isActive: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  lastUsedAt: { type: 'string', nullable: true },
                  revokedAt: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    handler: getApiKeys,
  });

  /**
   * POST /dashboard/api-keys
   * Create a new API key
   */
  fastify.post('/api-keys', {
    schema: {
      description: 'Create a new API key. The full key is only shown once!',
      tags: ['Dashboard', 'API Keys'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Optional name for the API key' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                key: { type: 'string', description: 'Full API key - shown only once!' },
                prefix: { type: 'string' },
                name: { type: 'string', nullable: true },
                createdAt: { type: 'string' },
              },
            },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: createApiKey,
  });

  /**
   * DELETE /dashboard/api-keys/:id
   * Revoke an API key
   */
  fastify.delete('/api-keys/:id', {
    schema: {
      description: 'Revoke an API key',
      tags: ['Dashboard', 'API Keys'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'API key ID to revoke' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: revokeApiKey,
  });

  // ============================================
  // USAGE
  // ============================================

  /**
   * GET /dashboard/usage/stats
   * Get usage statistics with breakdown
   */
  fastify.get('/usage/stats', {
    schema: {
      description: 'Get usage statistics with breakdown by event type',
      tags: ['Dashboard', 'Usage'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date', description: 'Start date (YYYY-MM-DD)' },
          endDate: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalRequests: { type: 'number' },
                totalCredits: { type: 'number' },
                screenshotCount: { type: 'number' },
                pdfCount: { type: 'number' },
                averageCreditsPerDay: { type: 'number' },
                breakdown: { type: 'array' },
              },
            },
          },
        },
      },
    },
    handler: getUsageStats,
  });

  /**
   * GET /dashboard/usage/timeline
   * Get usage timeline for charts
   */
  fastify.get('/usage/timeline', {
    schema: {
      description: 'Get usage timeline data for charts',
      tags: ['Dashboard', 'Usage'],
      querystring: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['day', 'week', 'month'],
            default: 'month',
            description: 'Time period for the timeline',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  screenshots: { type: 'number' },
                  pdfs: { type: 'number' },
                  credits: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    handler: getUsageTimeline,
  });

  // ============================================
  // SETTINGS
  // ============================================

  /**
   * GET /dashboard/settings
   * Get account settings
   */
  fastify.get('/settings', {
    schema: {
      description: 'Get account settings',
      tags: ['Dashboard', 'Settings'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                tier: { type: 'string' },
                createdAt: { type: 'string' },
                defaultSettings: {
                  type: 'object',
                  properties: {
                    format: { type: 'string' },
                    quality: { type: 'number' },
                    fullPage: { type: 'boolean' },
                    viewport: {
                      type: 'object',
                      properties: {
                        width: { type: 'number' },
                        height: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    handler: getSettings,
  });

  /**
   * PATCH /dashboard/settings
   * Update account settings
   */
  fastify.patch('/settings', {
    schema: {
      description: 'Update account settings',
      tags: ['Dashboard', 'Settings'],
      body: {
        type: 'object',
        properties: {
          defaultSettings: {
            type: 'object',
            properties: {
              format: { type: 'string', enum: ['png', 'jpeg', 'webp'] },
              quality: { type: 'number', minimum: 1, maximum: 100 },
              fullPage: { type: 'boolean' },
              viewport: {
                type: 'object',
                properties: {
                  width: { type: 'number', minimum: 320, maximum: 3840 },
                  height: { type: 'number', minimum: 200, maximum: 2160 },
                },
              },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: updateSettings,
  });

  // ============================================
  // WEBHOOKS
  // ============================================

  /**
   * GET /dashboard/settings/webhooks
   * List all webhooks
   */
  fastify.get('/settings/webhooks', {
    schema: {
      description: 'List all webhooks for the account',
      tags: ['Dashboard', 'Webhooks'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  url: { type: 'string' },
                  events: { type: 'array', items: { type: 'string' } },
                  isActive: { type: 'boolean' },
                  lastTriggeredAt: { type: 'string', nullable: true },
                  failCount: { type: 'number' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    handler: getWebhooks,
  });

  /**
   * POST /dashboard/settings/webhooks
   * Create a new webhook
   */
  fastify.post('/settings/webhooks', {
    schema: {
      description: 'Create a new webhook. The secret is only shown once!',
      tags: ['Dashboard', 'Webhooks'],
      body: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri', description: 'Webhook endpoint URL' },
          events: {
            type: 'array',
            items: { type: 'string' },
            description: 'Events to subscribe to (e.g., screenshot.completed, pdf.completed)',
          },
        },
        required: ['url', 'events'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                url: { type: 'string' },
                events: { type: 'array', items: { type: 'string' } },
                secret: { type: 'string', description: 'Webhook secret - shown only once!' },
                createdAt: { type: 'string' },
              },
            },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: createWebhook,
  });

  /**
   * DELETE /dashboard/settings/webhooks/:id
   * Delete a webhook
   */
  fastify.delete('/settings/webhooks/:id', {
    schema: {
      description: 'Delete a webhook',
      tags: ['Dashboard', 'Webhooks'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Webhook ID to delete' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: deleteWebhook,
  });
}
