/**
 * Dashboard Routes Integration Tests
 *
 * Tests for dashboard API endpoints:
 * - GET /dashboard/overview - Get account overview
 * - GET /dashboard/api-keys - List API keys
 * - POST /dashboard/api-keys - Create API key
 * - DELETE /dashboard/api-keys/:id - Revoke API key
 * - GET /dashboard/usage/stats - Get usage statistics
 * - GET /dashboard/usage/timeline - Get usage timeline
 * - GET /dashboard/settings - Get account settings
 * - PATCH /dashboard/settings - Update account settings
 * - GET /dashboard/settings/webhooks - List webhooks
 * - POST /dashboard/settings/webhooks - Create webhook
 * - DELETE /dashboard/settings/webhooks/:id - Delete webhook
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ============================================================================
// MOCK SETUP - Must be done before imports
// ============================================================================

// Mock Dashboard Repository
const mockDashboardRepository = {
  getAccountOverview: vi.fn(),
  getUsageStats: vi.fn(),
  getUsageTimeline: vi.fn(),
  getAccountSettings: vi.fn(),
  updateAccountSettings: vi.fn(),
  getWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
};

vi.mock('../../../src/services/database/dashboard.repository.js', () => ({
  dashboardRepository: mockDashboardRepository,
}));

// Mock API Key Service
const mockApiKeyService = {
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  validateApiKey: vi.fn(),
};

vi.mock('../../../src/services/auth/api-key.service.js', () => ({
  ApiKeyService: class MockApiKeyService {
    listApiKeys = mockApiKeyService.listApiKeys;
    createApiKey = mockApiKeyService.createApiKey;
    revokeApiKey = mockApiKeyService.revokeApiKey;
    validateApiKey = mockApiKeyService.validateApiKey;
  },
}));

// Import after mocking
import Fastify from 'fastify';
import { dashboardRoutes } from '../../../src/routes/dashboard.routes.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const mockAccountOverview = {
  account: {
    id: 'account-123',
    email: 'test@example.com',
    tier: 'PRO',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  quota: {
    used: 1500,
    limit: 50000,
    percentage: 3,
    resetDate: '2024-02-01T00:00:00.000Z',
  },
  usage: {
    screenshots: 100,
    pdfs: 50,
    totalCredits: 1500,
  },
  recentActivity: [
    { type: 'screenshot', id: 'ss-1', createdAt: '2024-01-15T10:00:00.000Z' },
    { type: 'pdf', id: 'pdf-1', createdAt: '2024-01-15T09:00:00.000Z' },
  ],
};

const mockApiKeys = [
  {
    id: 'key-1',
    name: 'Production Key',
    prefix: 'sk_live_abc',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUsedAt: '2024-01-15T10:00:00.000Z',
    revokedAt: null,
  },
  {
    id: 'key-2',
    name: 'Development Key',
    prefix: 'sk_test_xyz',
    isActive: true,
    createdAt: '2024-01-02T00:00:00.000Z',
    lastUsedAt: null,
    revokedAt: null,
  },
];

const mockUsageStats = {
  totalRequests: 150,
  totalCredits: 1500,
  screenshotCount: 100,
  pdfCount: 50,
  averageCreditsPerDay: 50,
  breakdown: [
    { eventType: 'screenshot', count: 100, credits: 1000 },
    { eventType: 'pdf', count: 50, credits: 500 },
  ],
};

const mockUsageTimeline = [
  { date: '2024-01-13', screenshots: 10, pdfs: 5, credits: 150 },
  { date: '2024-01-14', screenshots: 15, pdfs: 8, credits: 230 },
  { date: '2024-01-15', screenshots: 20, pdfs: 10, credits: 300 },
];

const mockAccountSettings = {
  id: 'account-123',
  email: 'test@example.com',
  tier: 'PRO',
  createdAt: '2024-01-01T00:00:00.000Z',
};

const mockWebhooks = [
  {
    id: 'webhook-1',
    url: 'https://example.com/webhook',
    events: ['screenshot.completed', 'pdf.completed'],
    isActive: true,
    lastTriggeredAt: '2024-01-15T10:00:00.000Z',
    failCount: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Dashboard Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({
      logger: false,
    });

    // Add mock auth decorator
    app.decorateRequest('auth', null);

    // Decorate server with apiKeyService (required by dashboard controller)
    app.decorate('apiKeyService', {
      listApiKeys: mockApiKeyService.listApiKeys,
      createApiKey: mockApiKeyService.createApiKey,
      revokeApiKey: mockApiKeyService.revokeApiKey,
      validateApiKey: mockApiKeyService.validateApiKey,
    });

    // Add auth hook - simulates authenticated request
    app.addHook('preHandler', async (request) => {
      // Check for test header to simulate unauthenticated requests
      if (request.headers['x-test-unauthenticated']) {
        (request as any).auth = undefined;
      } else {
        (request as any).auth = { accountId: 'account-123' };
      }
    });

    // Register dashboard routes with prefix
    await app.register(dashboardRoutes, { prefix: '/dashboard' });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // GET /dashboard/overview - Get Account Overview
  // ==========================================================================
  describe('GET /dashboard/overview', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/overview',
        headers: { 'x-test-unauthenticated': 'true' },
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Unauthorized');
    });

    it('should return account overview when authenticated', async () => {
      mockDashboardRepository.getAccountOverview.mockResolvedValue(mockAccountOverview);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/overview',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.account.id).toBe('account-123');
      expect(body.data.quota.used).toBe(1500);
      expect(body.data.usage.screenshots).toBe(100);
    });

    it('should return 404 when account not found', async () => {
      mockDashboardRepository.getAccountOverview.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/overview',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Not Found');
    });

    it('should return 500 on repository error', async () => {
      mockDashboardRepository.getAccountOverview.mockRejectedValue(new Error('Database error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/overview',
      });

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal Server Error');

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // GET /dashboard/api-keys - List API Keys
  // ==========================================================================
  describe('GET /dashboard/api-keys', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/api-keys',
        headers: { 'x-test-unauthenticated': 'true' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return list of API keys', async () => {
      mockApiKeyService.listApiKeys.mockResolvedValue(mockApiKeys);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/api-keys',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].id).toBe('key-1');
      expect(body.data[0].prefix).toBe('sk_live_abc');
    });

    it('should return empty array when no API keys', async () => {
      mockApiKeyService.listApiKeys.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/api-keys',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
    });
  });

  // ==========================================================================
  // POST /dashboard/api-keys - Create API Key
  // ==========================================================================
  describe('POST /dashboard/api-keys', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/api-keys',
        headers: { 'x-test-unauthenticated': 'true' },
        payload: { name: 'Test Key' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should create API key with name', async () => {
      mockApiKeyService.createApiKey.mockResolvedValue({
        keyId: 'key-new',
        key: 'sk_live_fullkey123',
        prefix: 'sk_live_ful',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/api-keys',
        payload: { name: 'My Production Key' },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('key-new');
      expect(body.data.key).toBe('sk_live_fullkey123'); // Full key shown once
      expect(body.data.prefix).toBe('sk_live_ful');
      expect(body.data.name).toBe('My Production Key');
      expect(body.message).toContain('Store this key securely');
    });

    it('should create API key without name', async () => {
      mockApiKeyService.createApiKey.mockResolvedValue({
        keyId: 'key-new',
        key: 'sk_test_noname456',
        prefix: 'sk_test_non',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/api-keys',
        payload: {},
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBeNull();
    });

    it('should return 500 on service error', async () => {
      mockApiKeyService.createApiKey.mockRejectedValue(new Error('Service error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/api-keys',
        payload: { name: 'Test Key' },
      });

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // DELETE /dashboard/api-keys/:id - Revoke API Key
  // ==========================================================================
  describe('DELETE /dashboard/api-keys/:id', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/dashboard/api-keys/key-1',
        headers: { 'x-test-unauthenticated': 'true' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should revoke API key successfully', async () => {
      mockApiKeyService.revokeApiKey.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/dashboard/api-keys/key-1',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('API key revoked successfully');
      expect(mockApiKeyService.revokeApiKey).toHaveBeenCalledWith('key-1', 'account-123');
    });

    it('should return 404 when key not found or already revoked', async () => {
      mockApiKeyService.revokeApiKey.mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: '/dashboard/api-keys/non-existent',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('not found or already revoked');
    });
  });

  // ==========================================================================
  // GET /dashboard/usage/stats - Get Usage Statistics
  // ==========================================================================
  describe('GET /dashboard/usage/stats', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/usage/stats',
        headers: { 'x-test-unauthenticated': 'true' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return usage statistics', async () => {
      mockDashboardRepository.getUsageStats.mockResolvedValue(mockUsageStats);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/usage/stats',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.totalRequests).toBe(150);
      expect(body.data.screenshotCount).toBe(100);
      expect(body.data.pdfCount).toBe(50);
    });

    it('should pass date filters to repository', async () => {
      mockDashboardRepository.getUsageStats.mockResolvedValue(mockUsageStats);

      await app.inject({
        method: 'GET',
        url: '/dashboard/usage/stats?startDate=2024-01-01&endDate=2024-01-31',
      });

      expect(mockDashboardRepository.getUsageStats).toHaveBeenCalledWith(
        'account-123',
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  // ==========================================================================
  // GET /dashboard/usage/timeline - Get Usage Timeline
  // ==========================================================================
  describe('GET /dashboard/usage/timeline', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/usage/timeline',
        headers: { 'x-test-unauthenticated': 'true' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return usage timeline with default period', async () => {
      mockDashboardRepository.getUsageTimeline.mockResolvedValue(mockUsageTimeline);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/usage/timeline',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(mockDashboardRepository.getUsageTimeline).toHaveBeenCalledWith('account-123', 'month');
    });

    it('should accept valid period: day', async () => {
      mockDashboardRepository.getUsageTimeline.mockResolvedValue(mockUsageTimeline);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/usage/timeline?period=day',
      });

      expect(response.statusCode).toBe(200);
      expect(mockDashboardRepository.getUsageTimeline).toHaveBeenCalledWith('account-123', 'day');
    });

    it('should accept valid period: week', async () => {
      mockDashboardRepository.getUsageTimeline.mockResolvedValue(mockUsageTimeline);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/usage/timeline?period=week',
      });

      expect(response.statusCode).toBe(200);
      expect(mockDashboardRepository.getUsageTimeline).toHaveBeenCalledWith('account-123', 'week');
    });

    it('should return 400 for invalid period', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/usage/timeline?period=invalid',
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid period');
    });
  });

  // ==========================================================================
  // GET /dashboard/settings - Get Account Settings
  // ==========================================================================
  describe('GET /dashboard/settings', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/settings',
        headers: { 'x-test-unauthenticated': 'true' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return account settings with defaults', async () => {
      mockDashboardRepository.getAccountSettings.mockResolvedValue(mockAccountSettings);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/settings',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('account-123');
      expect(body.data.email).toBe('test@example.com');
      expect(body.data.defaultSettings).toBeDefined();
      expect(body.data.defaultSettings.format).toBe('png');
      expect(body.data.defaultSettings.quality).toBe(80);
      expect(body.data.defaultSettings.viewport.width).toBe(1920);
    });

    it('should return 404 when account not found', async () => {
      mockDashboardRepository.getAccountSettings.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/settings',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  // ==========================================================================
  // PATCH /dashboard/settings - Update Account Settings
  // ==========================================================================
  describe('PATCH /dashboard/settings', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/dashboard/settings',
        headers: { 'x-test-unauthenticated': 'true' },
        payload: { defaultSettings: { format: 'jpeg' } },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should update settings successfully', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/dashboard/settings',
        payload: {
          defaultSettings: {
            format: 'jpeg',
            quality: 90,
            fullPage: true,
            viewport: { width: 1280, height: 720 },
          },
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Settings updated successfully');
    });
  });

  // ==========================================================================
  // GET /dashboard/settings/webhooks - List Webhooks
  // ==========================================================================
  describe('GET /dashboard/settings/webhooks', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/settings/webhooks',
        headers: { 'x-test-unauthenticated': 'true' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return list of webhooks', async () => {
      mockDashboardRepository.getWebhooks.mockResolvedValue(mockWebhooks);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/settings/webhooks',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].url).toBe('https://example.com/webhook');
      expect(body.data[0].events).toContain('screenshot.completed');
    });

    it('should return empty array when no webhooks', async () => {
      mockDashboardRepository.getWebhooks.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/settings/webhooks',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
    });
  });

  // ==========================================================================
  // POST /dashboard/settings/webhooks - Create Webhook
  // ==========================================================================
  describe('POST /dashboard/settings/webhooks', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/settings/webhooks',
        headers: { 'x-test-unauthenticated': 'true' },
        payload: {
          url: 'https://example.com/webhook',
          events: ['screenshot.completed'],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should create webhook successfully', async () => {
      mockDashboardRepository.createWebhook.mockResolvedValue({
        id: 'webhook-new',
        secret: 'whsec_secretkey123',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/settings/webhooks',
        payload: {
          url: 'https://example.com/webhook/new',
          events: ['screenshot.completed', 'pdf.completed'],
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('webhook-new');
      expect(body.data.url).toBe('https://example.com/webhook/new');
      expect(body.data.events).toContain('screenshot.completed');
      expect(body.data.secret).toBe('whsec_secretkey123'); // Secret shown once
      expect(body.message).toContain('Store the secret securely');
    });

    it('should return 400 for missing URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/settings/webhooks',
        payload: {
          events: ['screenshot.completed'],
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('URL and events');
    });

    it('should return 400 for missing events', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/settings/webhooks',
        payload: {
          url: 'https://example.com/webhook',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 for empty events array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/settings/webhooks',
        payload: {
          url: 'https://example.com/webhook',
          events: [],
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 for invalid URL format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/settings/webhooks',
        payload: {
          url: 'not-a-valid-url',
          events: ['screenshot.completed'],
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid webhook URL');
    });
  });

  // ==========================================================================
  // DELETE /dashboard/settings/webhooks/:id - Delete Webhook
  // ==========================================================================
  describe('DELETE /dashboard/settings/webhooks/:id', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/dashboard/settings/webhooks/webhook-1',
        headers: { 'x-test-unauthenticated': 'true' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should delete webhook successfully', async () => {
      mockDashboardRepository.deleteWebhook.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/dashboard/settings/webhooks/webhook-1',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Webhook deleted successfully');
      expect(mockDashboardRepository.deleteWebhook).toHaveBeenCalledWith('account-123', 'webhook-1');
    });

    it('should return 404 when webhook not found', async () => {
      mockDashboardRepository.deleteWebhook.mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: '/dashboard/settings/webhooks/non-existent',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Webhook not found');
    });
  });

  // ==========================================================================
  // Route Registration Tests
  // ==========================================================================
  describe('Route Registration', () => {
    it('should register all dashboard routes', async () => {
      const routes = app.printRoutes();

      expect(routes).toContain('/dashboard/overview');
      expect(routes).toContain('/dashboard/api-keys');
      expect(routes).toContain('/dashboard/api-keys/:id');
      expect(routes).toContain('/dashboard/usage/stats');
      expect(routes).toContain('/dashboard/usage/timeline');
      expect(routes).toContain('/dashboard/settings');
      expect(routes).toContain('/dashboard/settings/webhooks');
      expect(routes).toContain('/dashboard/settings/webhooks/:id');
    });

    it('should have correct content type header', async () => {
      mockDashboardRepository.getAccountOverview.mockResolvedValue(mockAccountOverview);

      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/overview',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});
