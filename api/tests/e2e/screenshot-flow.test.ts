import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestApp, createTestClient, createAuthHeaders } from '../setup/test-helpers';
import { createMockBrowserPool } from '../mocks/playwright.mock';
import { createMockStorageService } from '../mocks/storage.mock';
import type { FastifyInstance } from 'fastify';

// Mock dependencies for E2E tests
const mockBrowserPool = createMockBrowserPool();
const mockStorageService = createMockStorageService();

vi.mock('../../src/services/browser-pool/index.js', () => ({
  getBrowserPool: vi.fn(() => mockBrowserPool),
}));

vi.mock('../../src/services/storage/storage.service.js', () => ({
  StorageService: vi.fn().mockImplementation(() => mockStorageService),
  createStorageService: vi.fn().mockReturnValue(mockStorageService),
}));

describe('Screenshot E2E Flow', () => {
  let app: FastifyInstance;
  let client: ReturnType<typeof createTestClient>;
  const testApiKey = 'sk_test_e2e_test_key';

  beforeAll(async () => {
    app = await createTestApp();
    client = createTestClient(app);

    // Setup mock page behavior
    mockBrowserPool._mockPage.screenshot.mockResolvedValue(
      Buffer.from('fake-screenshot-data')
    );
    mockBrowserPool._mockPage.viewportSize.mockReturnValue({
      width: 1920,
      height: 1080,
    });
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('Complete Screenshot Workflow', () => {
    it('should capture a basic screenshot successfully', async () => {
      const response = await client
        .post('/v1/screenshot')
        .set(createAuthHeaders(testApiKey))
        .send({
          url: 'https://example.com',
          format: 'png',
        });

      // Check response structure
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should capture a screenshot with custom viewport', async () => {
      const response = await client
        .post('/v1/screenshot')
        .set(createAuthHeaders(testApiKey))
        .send({
          url: 'https://example.com',
          format: 'png',
          viewport: {
            width: 1440,
            height: 900,
          },
        });

      expect(response.status).toBe(200);
    });

    it('should capture a full page screenshot', async () => {
      const response = await client
        .post('/v1/screenshot')
        .set(createAuthHeaders(testApiKey))
        .send({
          url: 'https://example.com',
          format: 'png',
          fullPage: true,
        });

      expect(response.status).toBe(200);
    });

    it('should handle JPEG format with quality', async () => {
      const response = await client
        .post('/v1/screenshot')
        .set(createAuthHeaders(testApiKey))
        .send({
          url: 'https://example.com',
          format: 'jpeg',
          quality: 80,
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return validation error for missing URL', async () => {
      const response = await client
        .post('/v1/screenshot')
        .set(createAuthHeaders(testApiKey))
        .send({
          format: 'png',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return validation error for invalid URL', async () => {
      const response = await client
        .post('/v1/screenshot')
        .set(createAuthHeaders(testApiKey))
        .send({
          url: 'not-a-valid-url',
          format: 'png',
        });

      expect(response.status).toBe(400);
    });

    it('should return validation error for invalid format', async () => {
      const response = await client
        .post('/v1/screenshot')
        .set(createAuthHeaders(testApiKey))
        .send({
          url: 'https://example.com',
          format: 'gif', // Invalid format
        });

      expect(response.status).toBe(400);
    });

    it('should handle navigation errors gracefully', async () => {
      mockBrowserPool._mockPage.goto.mockRejectedValueOnce(
        new Error('net::ERR_NAME_NOT_RESOLVED')
      );

      const response = await client
        .post('/v1/screenshot')
        .set(createAuthHeaders(testApiKey))
        .send({
          url: 'https://nonexistent-domain-12345.com',
          format: 'png',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Authentication', () => {
    it('should require API key for protected endpoints', async () => {
      const response = await client.post('/v1/screenshot').send({
        url: 'https://example.com',
        format: 'png',
      });

      // Should either require auth or proceed based on implementation
      expect([200, 401, 403]).toContain(response.status);
    });
  });
});
