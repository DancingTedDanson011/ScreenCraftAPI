/**
 * Screenshot Routes Integration Tests
 *
 * Tests for screenshot API endpoints:
 * - POST /v1/screenshots - Create screenshot
 * - GET /v1/screenshots/:id - Get screenshot status
 * - GET /v1/screenshots - List screenshots
 * - GET /v1/screenshots/:id/download - Download screenshot
 * - DELETE /v1/screenshots/:id - Delete screenshot
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Screenshot } from '@prisma/client';

// ============================================================================
// MOCK SETUP - Must be done before imports
// ============================================================================

// Mock Screenshot Repository
const mockScreenshotRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByAccountId: vi.fn(),
  markAsProcessing: vi.fn(),
  markAsCompleted: vi.fn(),
  markAsFailed: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../../src/services/database/screenshot.repository', () => ({
  screenshotRepository: mockScreenshotRepository,
}));

// Mock Screenshot Service
const mockScreenshotService = {
  validateRequest: vi.fn(),
  captureScreenshot: vi.fn(),
  getContentType: vi.fn(),
  checkHealth: vi.fn(),
};

vi.mock('../../../src/services/screenshot/index.js', () => ({
  getScreenshotService: vi.fn(() => mockScreenshotService),
  ScreenshotError: class ScreenshotError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ScreenshotError';
    }
  },
}));

// Mock Storage Service
const mockStorageService = {
  generateScreenshotKey: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  getSignedUrl: vi.fn(),
};

vi.mock('../../../src/services/storage/storage.service.js', () => ({
  StorageService: class MockStorageService {
    generateScreenshotKey = mockStorageService.generateScreenshotKey;
    upload = mockStorageService.upload;
    download = mockStorageService.download;
    delete = mockStorageService.delete;
    getSignedUrl = mockStorageService.getSignedUrl;
  },
}));

// Mock Queue Service
const mockQueueService = {
  addScreenshotJob: vi.fn(),
};

vi.mock('../../../src/services/queue/queue.service.js', () => ({
  getQueueService: vi.fn(() => mockQueueService),
}));

// Mock Queue Config
vi.mock('../../../src/services/queue/queue.config.js', () => ({
  JobPriority: {
    HIGH: 1,
    NORMAL: 5,
    LOW: 10,
  },
}));

// Import after mocking
import Fastify from 'fastify';
import screenshotRoutes from '../../../src/routes/screenshot.routes.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockScreenshot = (overrides: Partial<Screenshot> = {}): Screenshot => ({
  id: 'screenshot-123',
  accountId: 'account-123',
  url: 'https://example.com',
  status: 'PENDING',
  format: 'PNG',
  fullPage: false,
  quality: null,
  viewport: null,
  clip: null,
  waitOptions: null,
  headers: null,
  cookies: null,
  userAgent: null,
  blockResources: null,
  omitBackground: false,
  encoding: 'binary',
  metadata: null,
  webhookUrl: null,
  downloadUrl: null,
  storageKey: null,
  fileSize: null,
  error: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  completedAt: null,
  ...overrides,
});

const validScreenshotRequest = {
  url: 'https://example.com',
  format: 'png',
  fullPage: false,
  viewport: { width: 1920, height: 1080 },
};

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Screenshot Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({
      logger: false,
    });

    // Add mock auth decorator
    app.decorateRequest('auth', null);
    app.addHook('preHandler', async (request) => {
      // Simulate authenticated request with accountId
      (request as any).auth = { accountId: 'account-123' };
    });

    // Register screenshot routes with prefix
    await app.register(screenshotRoutes, { prefix: '/v1' });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock implementations
    mockScreenshotService.getContentType.mockReturnValue('image/png');
    mockStorageService.generateScreenshotKey.mockReturnValue('screenshots/account-123/123456-test.png');
  });

  // ==========================================================================
  // POST /v1/screenshots - Create Screenshot
  // ==========================================================================
  describe('POST /v1/screenshots', () => {
    describe('Synchronous Processing', () => {
      it('should create screenshot synchronously and return 201', async () => {
        const mockScreenshot = createMockScreenshot();
        const completedScreenshot = createMockScreenshot({
          status: 'COMPLETED',
          downloadUrl: 'https://api.example.com/v1/screenshots/screenshot-123/download',
          storageKey: 'screenshots/account-123/123456-test.png',
          fileSize: 12345,
          completedAt: new Date(),
        });

        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockScreenshotRepository.markAsProcessing.mockResolvedValue({
          ...mockScreenshot,
          status: 'PROCESSING',
        });
        mockScreenshotRepository.markAsCompleted.mockResolvedValue(completedScreenshot);
        mockScreenshotService.captureScreenshot.mockResolvedValue({
          buffer: Buffer.from('test-image'),
          format: 'png',
          width: 1920,
          height: 1080,
          fileSize: 12345,
        });
        mockStorageService.upload.mockResolvedValue('screenshots/account-123/123456-test.png');

        const response = await app.inject({
          method: 'POST',
          url: '/v1/screenshots',
          payload: { ...validScreenshotRequest, async: false },
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('completed');
        expect(body.data.id).toBe('screenshot-123');
      });

      it('should mark screenshot as failed when capture fails', async () => {
        const mockScreenshot = createMockScreenshot();
        const failedScreenshot = createMockScreenshot({
          status: 'FAILED',
          error: 'Navigation timeout',
        });

        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockScreenshotRepository.markAsProcessing.mockResolvedValue({
          ...mockScreenshot,
          status: 'PROCESSING',
        });
        mockScreenshotRepository.markAsFailed.mockResolvedValue(failedScreenshot);
        mockScreenshotService.captureScreenshot.mockRejectedValue(
          new Error('Navigation timeout')
        );

        const response = await app.inject({
          method: 'POST',
          url: '/v1/screenshots',
          payload: { ...validScreenshotRequest, async: false },
        });

        expect(response.statusCode).toBe(500);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('PROCESSING_FAILED');
      });
    });

    describe('Asynchronous Processing', () => {
      it('should queue screenshot and return 202 for async request', async () => {
        const mockScreenshot = createMockScreenshot();
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id-123');

        const response = await app.inject({
          method: 'POST',
          url: '/v1/screenshots',
          payload: { ...validScreenshotRequest, async: true },
        });

        expect(response.statusCode).toBe(202);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('pending');
        expect(mockQueueService.addScreenshotJob).toHaveBeenCalled();
      });
    });

    describe('Validation', () => {
      it('should return 400 for missing URL', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/screenshots',
          payload: { format: 'png' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for invalid URL format', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/screenshots',
          payload: { url: 'not-a-valid-url', format: 'png' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for invalid format', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/screenshots',
          payload: { url: 'https://example.com', format: 'gif' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid formats: png, jpeg, webp', async () => {
        mockScreenshotRepository.create.mockResolvedValue(createMockScreenshot());
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id');

        for (const format of ['png', 'jpeg', 'webp']) {
          const response = await app.inject({
            method: 'POST',
            url: '/v1/screenshots',
            payload: { url: 'https://example.com', format, async: true },
          });

          expect(response.statusCode).toBe(202);
        }
      });
    });

    describe('Request Options', () => {
      it('should accept all valid screenshot options', async () => {
        const mockScreenshot = createMockScreenshot();
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id');

        const fullRequest = {
          url: 'https://example.com',
          format: 'jpeg',
          fullPage: true,
          quality: 80,
          viewport: { width: 1280, height: 720 },
          clip: { x: 0, y: 0, width: 800, height: 600 },
          waitOptions: { waitUntil: 'networkidle0', timeout: 45000 },
          headers: { 'Accept-Language': 'en-US' },
          cookies: [{ name: 'session', value: 'test', domain: 'example.com' }],
          userAgent: 'Custom User Agent',
          blockResources: ['image', 'font'],
          omitBackground: true,
          encoding: 'base64',
          metadata: { custom: 'data' },
          webhookUrl: 'https://webhook.example.com/callback',
          async: true,
        };

        const response = await app.inject({
          method: 'POST',
          url: '/v1/screenshots',
          payload: fullRequest,
        });

        expect(response.statusCode).toBe(202);
        expect(mockScreenshotRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://example.com',
            format: 'JPEG',
            fullPage: true,
            quality: 80,
          })
        );
      });
    });

    describe('Response Format', () => {
      it('should include correct meta information', async () => {
        const mockScreenshot = createMockScreenshot();
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id');

        const response = await app.inject({
          method: 'POST',
          url: '/v1/screenshots',
          payload: { ...validScreenshotRequest, async: true },
        });

        const body = JSON.parse(response.body);
        expect(body.meta).toBeDefined();
        expect(body.meta.requestId).toBeDefined();
        expect(body.meta.version).toBe('v1');
        expect(body.meta.timestamp).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // GET /v1/screenshots/:id - Get Screenshot
  // ==========================================================================
  describe('GET /v1/screenshots/:id', () => {
    it('should return screenshot by ID with status 200', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        downloadUrl: 'https://example.com/download',
        fileSize: 12345,
        completedAt: new Date(),
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots/screenshot-123',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('screenshot-123');
      expect(body.data.status).toBe('completed');
    });

    it('should return 404 when screenshot not found', async () => {
      mockScreenshotRepository.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots/non-existent-id',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('SCREENSHOT_NOT_FOUND');
    });

    it('should include all screenshot fields in response', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        format: 'WEBP',
        fileSize: 54321,
        downloadUrl: 'https://example.com/download',
        metadata: { custom: 'data' },
        completedAt: new Date('2024-01-02T00:00:00Z'),
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots/screenshot-123',
      });

      const body = JSON.parse(response.body);
      expect(body.data.format).toBe('webp');
      expect(body.data.fileSize).toBe(54321);
      expect(body.data.downloadUrl).toBe('https://example.com/download');
    });

    it('should handle screenshot with error field', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'FAILED',
        error: 'Navigation timeout exceeded',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots/screenshot-123',
      });

      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('failed');
      expect(body.data.error).toBe('Navigation timeout exceeded');
    });
  });

  // ==========================================================================
  // GET /v1/screenshots - List Screenshots
  // ==========================================================================
  describe('GET /v1/screenshots', () => {
    it('should list screenshots with pagination', async () => {
      const mockScreenshots = [
        createMockScreenshot({ id: 'screenshot-1' }),
        createMockScreenshot({ id: 'screenshot-2' }),
      ];
      mockScreenshotRepository.findByAccountId.mockResolvedValue({
        data: mockScreenshots,
        total: 2,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots?page=1&limit=20',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.meta.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should filter by status', async () => {
      const mockScreenshots = [
        createMockScreenshot({ id: 'screenshot-1', status: 'COMPLETED' }),
      ];
      mockScreenshotRepository.findByAccountId.mockResolvedValue({
        data: mockScreenshots,
        total: 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots?status=completed',
      });

      expect(response.statusCode).toBe(200);
      expect(mockScreenshotRepository.findByAccountId).toHaveBeenCalledWith(
        'account-123',
        expect.objectContaining({
          status: 'COMPLETED',
        })
      );
    });

    it('should calculate pagination correctly', async () => {
      const mockScreenshots = Array(20)
        .fill(null)
        .map((_, i) => createMockScreenshot({ id: `screenshot-${i}` }));
      mockScreenshotRepository.findByAccountId.mockResolvedValue({
        data: mockScreenshots,
        total: 55,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots?page=2&limit=20',
      });

      const body = JSON.parse(response.body);
      expect(body.meta.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 55,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should pass sort options correctly', async () => {
      mockScreenshotRepository.findByAccountId.mockResolvedValue({
        data: [],
        total: 0,
      });

      await app.inject({
        method: 'GET',
        url: '/v1/screenshots?sortBy=completedAt&sortOrder=asc',
      });

      expect(mockScreenshotRepository.findByAccountId).toHaveBeenCalledWith(
        'account-123',
        expect.objectContaining({
          sortBy: 'completedAt',
          sortOrder: 'asc',
        })
      );
    });
  });

  // ==========================================================================
  // GET /v1/screenshots/:id/download - Download Screenshot
  // ==========================================================================
  describe('GET /v1/screenshots/:id/download', () => {
    it('should download completed screenshot', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        format: 'PNG',
        storageKey: 'screenshots/test/test.png',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.download.mockResolvedValue(Buffer.from('image-data'));

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots/screenshot-123/download',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['content-disposition']).toContain('screenshot-screenshot-123.png');
    });

    it('should return 404 when screenshot not found', async () => {
      mockScreenshotRepository.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots/non-existent-id/download',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('SCREENSHOT_NOT_FOUND');
    });

    it('should return 400 when screenshot is not completed', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'PROCESSING',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots/screenshot-123/download',
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('PROCESSING_FAILED');
      expect(body.error.message).toContain('not ready yet');
    });

    it('should set correct content type for JPEG', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        format: 'JPEG',
        storageKey: 'screenshots/test/test.jpg',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.download.mockResolvedValue(Buffer.from('image-data'));

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots/screenshot-123/download',
      });

      expect(response.headers['content-type']).toBe('image/jpeg');
    });

    it('should set correct content type for WEBP', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        format: 'WEBP',
        storageKey: 'screenshots/test/test.webp',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.download.mockResolvedValue(Buffer.from('image-data'));

      const response = await app.inject({
        method: 'GET',
        url: '/v1/screenshots/screenshot-123/download',
      });

      expect(response.headers['content-type']).toBe('image/webp');
    });
  });

  // ==========================================================================
  // DELETE /v1/screenshots/:id - Delete Screenshot
  // ==========================================================================
  describe('DELETE /v1/screenshots/:id', () => {
    it('should delete screenshot and return 204', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        storageKey: 'screenshots/test/test.png',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.delete.mockResolvedValue(undefined);
      mockScreenshotRepository.delete.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/screenshots/screenshot-123',
      });

      expect(response.statusCode).toBe(204);
      expect(mockStorageService.delete).toHaveBeenCalledWith('screenshots/test/test.png');
      expect(mockScreenshotRepository.delete).toHaveBeenCalledWith('screenshot-123');
    });

    it('should return 404 when screenshot not found', async () => {
      mockScreenshotRepository.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/screenshots/non-existent-id',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('SCREENSHOT_NOT_FOUND');
    });

    it('should delete pending screenshot without storage operation', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'PENDING',
        storageKey: null,
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockScreenshotRepository.delete.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/screenshots/screenshot-123',
      });

      expect(response.statusCode).toBe(204);
      expect(mockStorageService.delete).not.toHaveBeenCalled();
      expect(mockScreenshotRepository.delete).toHaveBeenCalled();
    });

    it('should continue with database deletion even if storage deletion fails', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        storageKey: 'screenshots/test/test.png',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.delete.mockRejectedValue(new Error('Storage unavailable'));
      mockScreenshotRepository.delete.mockResolvedValue(undefined);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/screenshots/screenshot-123',
      });

      expect(response.statusCode).toBe(204);
      expect(mockScreenshotRepository.delete).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Route Registration Tests
  // ==========================================================================
  describe('Route Registration', () => {
    it('should register all screenshot routes', async () => {
      const routes = app.printRoutes();

      expect(routes).toContain('/v1/screenshots');
      expect(routes).toContain('/v1/screenshots/:id');
      expect(routes).toContain('/v1/screenshots/:id/download');
    });

    it('should have correct content type header', async () => {
      mockScreenshotRepository.create.mockResolvedValue(createMockScreenshot());
      mockQueueService.addScreenshotJob.mockResolvedValue('job-id');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/screenshots',
        payload: { ...validScreenshotRequest, async: true },
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});
