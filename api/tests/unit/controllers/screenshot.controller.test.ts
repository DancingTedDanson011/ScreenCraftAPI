import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import type { FastifyReply } from 'fastify';
import type { Screenshot } from '@prisma/client';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Define ErrorCode enum for tests (matches api.types.ts)
const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_URL: 'INVALID_URL',
  INVALID_FORMAT: 'INVALID_FORMAT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  EXPIRED_API_KEY: 'EXPIRED_API_KEY',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  NOT_FOUND: 'NOT_FOUND',
  SCREENSHOT_NOT_FOUND: 'SCREENSHOT_NOT_FOUND',
  PDF_NOT_FOUND: 'PDF_NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  BROWSER_ERROR: 'BROWSER_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  TIMEOUT: 'TIMEOUT',
  NAVIGATION_TIMEOUT: 'NAVIGATION_TIMEOUT',
} as const;

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

// Create a proper class mock for StorageService
class MockStorageService {
  generateScreenshotKey = mockStorageService.generateScreenshotKey;
  upload = mockStorageService.upload;
  download = mockStorageService.download;
  delete = mockStorageService.delete;
  getSignedUrl = mockStorageService.getSignedUrl;
}

vi.mock('../../../src/services/storage/storage.service.js', () => ({
  StorageService: MockStorageService,
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

// Import controller after all mocks are set up
const {
  createScreenshot,
  getScreenshot,
  listScreenshots,
  downloadScreenshot,
  deleteScreenshot,
} = await import('../../../src/controllers/screenshot.controller');

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a mock Fastify request
 */
function createMockRequest(overrides: Record<string, any> = {}) {
  return {
    id: 'test-request-id',
    body: {},
    params: {},
    query: {},
    auth: undefined,
    protocol: 'https',
    hostname: 'api.example.com',
    ...overrides,
  };
}

/**
 * Create a mock Fastify reply
 */
function createMockReply(): FastifyReply & {
  _statusCode: number;
  _body: any;
  _headers: Record<string, string>;
} {
  const reply = {
    _statusCode: 200,
    _body: null,
    _headers: {} as Record<string, string>,
    code: vi.fn(function(this: any, code: number) {
      this._statusCode = code;
      return this;
    }),
    send: vi.fn(function(this: any, body: any) {
      this._body = body;
      return this;
    }),
    header: vi.fn(function(this: any, key: string, value: string) {
      this._headers[key] = value;
      return this;
    }),
  };
  return reply as any;
}

/**
 * Create a mock Screenshot entity
 */
function createMockScreenshot(overrides: Partial<Screenshot> = {}): Screenshot {
  return {
    id: 'test-screenshot-id',
    accountId: 'test-account-id',
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
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ScreenshotController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Reset default mock implementations
    mockScreenshotService.getContentType.mockReturnValue('image/png');
    mockScreenshotService.validateRequest.mockImplementation(() => {}); // Reset to no-op
    mockStorageService.generateScreenshotKey.mockReturnValue('screenshots/test-account-id/123456-test.png');
    mockStorageService.upload.mockResolvedValue('screenshots/test-account-id/123456-test.png');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // createScreenshot Tests
  // ==========================================================================
  describe('createScreenshot', () => {
    describe('Synchronous Processing', () => {
      it('should create a screenshot synchronously and return 201', async () => {
        const mockScreenshot = createMockScreenshot();
        const completedScreenshot = createMockScreenshot({
          status: 'COMPLETED',
          downloadUrl: 'https://api.example.com/v1/screenshots/test-screenshot-id/download',
          storageKey: 'screenshots/test-account-id/123456-test.png',
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
        mockStorageService.upload.mockResolvedValue('screenshots/test-account-id/123456-test.png');

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'png',
            async: false,
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(reply._statusCode).toBe(201);
        expect(reply._body.success).toBe(true);
        expect(reply._body.data.status).toBe('completed');
        expect(mockScreenshotRepository.create).toHaveBeenCalled();
        expect(mockScreenshotRepository.markAsProcessing).toHaveBeenCalled();
        expect(mockScreenshotService.captureScreenshot).toHaveBeenCalled();
        expect(mockStorageService.upload).toHaveBeenCalled();
        expect(mockScreenshotRepository.markAsCompleted).toHaveBeenCalled();
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

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'png',
            async: false,
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(reply._statusCode).toBe(500);
        expect(reply._body.success).toBe(false);
        expect(reply._body.error.code).toBe(ErrorCode.PROCESSING_FAILED);
        expect(mockScreenshotRepository.markAsFailed).toHaveBeenCalledWith(
          mockScreenshot.id,
          'Navigation timeout'
        );
      });
    });

    describe('Asynchronous Processing', () => {
      it('should queue screenshot job and return 202 for async request', async () => {
        const mockScreenshot = createMockScreenshot();
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id-123');

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'png',
            async: true,
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(reply._statusCode).toBe(202);
        expect(reply._body.success).toBe(true);
        expect(reply._body.data.status).toBe('pending');
        expect(mockQueueService.addScreenshotJob).toHaveBeenCalled();
      });

      it('should mark screenshot as failed when queue job fails', async () => {
        const mockScreenshot = createMockScreenshot();
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockRejectedValue(
          new Error('Queue connection failed')
        );
        mockScreenshotRepository.markAsFailed.mockResolvedValue({
          ...mockScreenshot,
          status: 'FAILED',
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'png',
            async: true,
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(mockScreenshotRepository.markAsFailed).toHaveBeenCalledWith(
          mockScreenshot.id,
          'Queue connection failed'
        );
        // Still returns 202 since the record was created
        expect(reply._statusCode).toBe(202);

        consoleSpy.mockRestore();
      });

      it('should handle non-Error exception when queue job fails', async () => {
        const mockScreenshot = createMockScreenshot();
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockRejectedValue('not an Error object');
        mockScreenshotRepository.markAsFailed.mockResolvedValue({
          ...mockScreenshot,
          status: 'FAILED',
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'png',
            async: true,
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(mockScreenshotRepository.markAsFailed).toHaveBeenCalledWith(
          mockScreenshot.id,
          'Failed to queue job'
        );
        expect(reply._statusCode).toBe(202);

        consoleSpy.mockRestore();
      });
    });

    describe('Validation', () => {
      it('should return 400 for missing URL', async () => {
        const request = createMockRequest({
          body: {
            format: 'png',
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(reply._statusCode).toBe(400);
        expect(reply._body.success).toBe(false);
        expect(reply._body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      });

      it('should return 400 for invalid URL format', async () => {
        const request = createMockRequest({
          body: {
            url: 'not-a-valid-url',
            format: 'png',
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(reply._statusCode).toBe(400);
        expect(reply._body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      });

      it('should return 400 for invalid format', async () => {
        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'gif', // Invalid format
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(reply._statusCode).toBe(400);
        expect(reply._body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      });
    });

    describe('Authentication - SECURITY VULNERABILITY', () => {
      /**
       * CRITICAL SECURITY TEST:
       * The controller has a fallback to 'default' when auth is not present.
       * This is a vulnerability that should be fixed.
       *
       * TODO: Remove the fallback and require authentication
       */
      it('should use default accountId when auth is missing - VULNERABILITY', async () => {
        const mockScreenshot = createMockScreenshot({ accountId: 'default' });
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id');

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'png',
            async: true,
          },
          // NOTE: No auth context - this should fail in production!
          auth: undefined,
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        // This test documents the vulnerability:
        // Without auth, the request still succeeds with 'default' accountId
        expect(reply._statusCode).toBe(202);
        expect(mockScreenshotRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'default', // VULNERABILITY: Should reject unauthenticated requests
          })
        );
      });

      it('should use authenticated accountId when auth is present', async () => {
        const mockScreenshot = createMockScreenshot({ accountId: 'real-account-123' });
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id');

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'png',
            async: true,
          },
          auth: { accountId: 'real-account-123' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(mockScreenshotRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'real-account-123',
          })
        );
      });
    });

    describe('Request Options', () => {
      it('should pass all options to repository when creating screenshot', async () => {
        const mockScreenshot = createMockScreenshot();
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id');

        const request = createMockRequest({
          body: {
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
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(mockScreenshotRepository.create).toHaveBeenCalledWith({
          accountId: 'test-account-id',
          url: 'https://example.com',
          format: 'JPEG',
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
        });
      });

      it('should use default format (png) when not specified', async () => {
        const mockScreenshot = createMockScreenshot();
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id');

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            async: true,
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(mockScreenshotRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'PNG',
          })
        );
      });
    });

    describe('Response Format', () => {
      it('should include correct meta information in response', async () => {
        const mockScreenshot = createMockScreenshot();
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id');

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            async: true,
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(reply._body.meta).toBeDefined();
        expect(reply._body.meta.requestId).toBe('test-request-id');
        expect(reply._body.meta.version).toBe('v1');
        expect(reply._body.meta.timestamp).toBeDefined();
      });

      it('should convert status to lowercase in response', async () => {
        const mockScreenshot = createMockScreenshot({ status: 'PENDING' });
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id');

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            async: true,
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(reply._body.data.status).toBe('pending');
      });

      it('should convert format to lowercase in response', async () => {
        const mockScreenshot = createMockScreenshot({ format: 'JPEG' });
        mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
        mockQueueService.addScreenshotJob.mockResolvedValue('job-id');

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'jpeg',
            async: true,
          },
          auth: { accountId: 'test-account-id' },
        });
        const reply = createMockReply();

        await createScreenshot(request as any, reply);

        expect(reply._body.data.format).toBe('jpeg');
      });
    });
  });

  // ==========================================================================
  // getScreenshot Tests
  // ==========================================================================
  describe('getScreenshot', () => {
    it('should return screenshot by ID with status 200', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        downloadUrl: 'https://example.com/download',
        fileSize: 12345,
        completedAt: new Date(),
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await getScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(200);
      expect(reply._body.success).toBe(true);
      expect(reply._body.data.id).toBe('test-screenshot-id');
      expect(reply._body.data.status).toBe('completed');
    });

    it('should return 404 when screenshot not found', async () => {
      mockScreenshotRepository.findById.mockResolvedValue(null);

      const request = createMockRequest({
        params: { id: 'non-existent-id' },
      });
      const reply = createMockReply();

      await getScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(404);
      expect(reply._body.success).toBe(false);
      expect(reply._body.error.code).toBe(ErrorCode.SCREENSHOT_NOT_FOUND);
      expect(reply._body.error.message).toContain('non-existent-id');
    });

    it('should return 500 on database error', async () => {
      mockScreenshotRepository.findById.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await getScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(500);
      expect(reply._body.success).toBe(false);
      expect(reply._body.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
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

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await getScreenshot(request as any, reply);

      expect(reply._body.data).toEqual(
        expect.objectContaining({
          id: 'test-screenshot-id',
          status: 'completed',
          url: 'https://example.com',
          format: 'webp',
          fileSize: 54321,
          downloadUrl: 'https://example.com/download',
          metadata: { custom: 'data' },
        })
      );
    });

    it('should handle screenshot with error field', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'FAILED',
        error: 'Navigation timeout exceeded',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await getScreenshot(request as any, reply);

      expect(reply._body.data.status).toBe('failed');
      expect(reply._body.data.error).toBe('Navigation timeout exceeded');
    });
  });

  // ==========================================================================
  // listScreenshots Tests
  // ==========================================================================
  describe('listScreenshots', () => {
    it('should list screenshots with pagination', async () => {
      const mockScreenshots = [
        createMockScreenshot({ id: 'screenshot-1' }),
        createMockScreenshot({ id: 'screenshot-2' }),
      ];
      mockScreenshotRepository.findByAccountId.mockResolvedValue({
        data: mockScreenshots,
        total: 2,
      });

      const request = createMockRequest({
        query: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        auth: { accountId: 'test-account-id' },
      });
      const reply = createMockReply();

      await listScreenshots(request as any, reply);

      expect(reply._statusCode).toBe(200);
      expect(reply._body.success).toBe(true);
      expect(reply._body.data).toHaveLength(2);
      expect(reply._body.meta.pagination).toEqual({
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

      const request = createMockRequest({
        query: { page: 1, limit: 20, status: 'completed', sortBy: 'createdAt', sortOrder: 'desc' },
        auth: { accountId: 'test-account-id' },
      });
      const reply = createMockReply();

      await listScreenshots(request as any, reply);

      expect(mockScreenshotRepository.findByAccountId).toHaveBeenCalledWith(
        'test-account-id',
        expect.objectContaining({
          status: 'COMPLETED',
        })
      );
    });

    it('should calculate pagination correctly', async () => {
      const mockScreenshots = Array(20).fill(null).map((_, i) =>
        createMockScreenshot({ id: `screenshot-${i}` })
      );
      mockScreenshotRepository.findByAccountId.mockResolvedValue({
        data: mockScreenshots,
        total: 55,
      });

      const request = createMockRequest({
        query: { page: 2, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        auth: { accountId: 'test-account-id' },
      });
      const reply = createMockReply();

      await listScreenshots(request as any, reply);

      expect(reply._body.meta.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 55,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should use default accountId when auth is missing - VULNERABILITY', async () => {
      mockScreenshotRepository.findByAccountId.mockResolvedValue({
        data: [],
        total: 0,
      });

      const request = createMockRequest({
        query: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        // NOTE: No auth context - this should fail in production!
        auth: undefined,
      });
      const reply = createMockReply();

      await listScreenshots(request as any, reply);

      // This test documents the vulnerability:
      // Without auth, the request still succeeds with 'default' accountId
      expect(mockScreenshotRepository.findByAccountId).toHaveBeenCalledWith(
        'default', // VULNERABILITY: Should reject unauthenticated requests
        expect.any(Object)
      );
    });

    it('should return 500 on database error', async () => {
      mockScreenshotRepository.findByAccountId.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createMockRequest({
        query: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        auth: { accountId: 'test-account-id' },
      });
      const reply = createMockReply();

      await listScreenshots(request as any, reply);

      expect(reply._statusCode).toBe(500);
      expect(reply._body.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    });

    it('should pass sort options correctly', async () => {
      mockScreenshotRepository.findByAccountId.mockResolvedValue({
        data: [],
        total: 0,
      });

      const request = createMockRequest({
        query: { page: 1, limit: 50, sortBy: 'completedAt', sortOrder: 'asc' },
        auth: { accountId: 'test-account-id' },
      });
      const reply = createMockReply();

      await listScreenshots(request as any, reply);

      expect(mockScreenshotRepository.findByAccountId).toHaveBeenCalledWith(
        'test-account-id',
        {
          page: 1,
          limit: 50,
          status: undefined,
          sortBy: 'completedAt',
          sortOrder: 'asc',
        }
      );
    });
  });

  // ==========================================================================
  // downloadScreenshot Tests
  // ==========================================================================
  describe('downloadScreenshot', () => {
    it('should download completed screenshot', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        format: 'PNG',
        storageKey: 'screenshots/test/test.png',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.download.mockResolvedValue(Buffer.from('image-data'));

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await downloadScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(200);
      expect(reply._headers['Content-Type']).toBe('image/png');
      expect(reply._headers['Content-Disposition']).toContain('screenshot-test-screenshot-id.png');
      expect(reply._body).toBeInstanceOf(Buffer);
    });

    it('should return 404 when screenshot not found', async () => {
      mockScreenshotRepository.findById.mockResolvedValue(null);

      const request = createMockRequest({
        params: { id: 'non-existent-id' },
      });
      const reply = createMockReply();

      await downloadScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(404);
      expect(reply._body.error.code).toBe(ErrorCode.SCREENSHOT_NOT_FOUND);
    });

    it('should return 400 when screenshot is not completed', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'PROCESSING',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await downloadScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(400);
      expect(reply._body.error.code).toBe(ErrorCode.PROCESSING_FAILED);
      expect(reply._body.error.message).toContain('not ready yet');
      expect(reply._body.error.message).toContain('processing');
    });

    it('should return 400 for pending screenshot', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'PENDING',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await downloadScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(400);
      expect(reply._body.error.message).toContain('pending');
    });

    it('should return 400 for failed screenshot', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'FAILED',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await downloadScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(400);
      expect(reply._body.error.message).toContain('failed');
    });

    it('should return 500 when storageKey is missing', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        storageKey: null,
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await downloadScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(500);
      expect(reply._body.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(reply._body.error.message).toContain('not found in storage');
    });

    it('should set correct content type for JPEG', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        format: 'JPEG',
        storageKey: 'screenshots/test/test.jpg',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.download.mockResolvedValue(Buffer.from('image-data'));

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await downloadScreenshot(request as any, reply);

      expect(reply._headers['Content-Type']).toBe('image/jpeg');
    });

    it('should set correct content type for WEBP', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        format: 'WEBP',
        storageKey: 'screenshots/test/test.webp',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.download.mockResolvedValue(Buffer.from('image-data'));

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await downloadScreenshot(request as any, reply);

      expect(reply._headers['Content-Type']).toBe('image/webp');
    });

    it('should return 500 on storage download error', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        storageKey: 'screenshots/test/test.png',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.download.mockRejectedValue(new Error('Storage unavailable'));

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await downloadScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(500);
      expect(reply._body.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    });

    it('should set Content-Length header', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        storageKey: 'screenshots/test/test.png',
      });
      const imageBuffer = Buffer.from('test-image-data-12345');
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.download.mockResolvedValue(imageBuffer);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await downloadScreenshot(request as any, reply);

      expect(reply._headers['Content-Length']).toBe(imageBuffer.length.toString());
    });
  });

  // ==========================================================================
  // deleteScreenshot Tests
  // ==========================================================================
  describe('deleteScreenshot', () => {
    it('should delete screenshot and return 204', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        storageKey: 'screenshots/test/test.png',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.delete.mockResolvedValue(undefined);
      mockScreenshotRepository.delete.mockResolvedValue(undefined);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await deleteScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(204);
      expect(mockStorageService.delete).toHaveBeenCalledWith('screenshots/test/test.png');
      expect(mockScreenshotRepository.delete).toHaveBeenCalledWith('test-screenshot-id');
    });

    it('should return 404 when screenshot not found', async () => {
      mockScreenshotRepository.findById.mockResolvedValue(null);

      const request = createMockRequest({
        params: { id: 'non-existent-id' },
      });
      const reply = createMockReply();

      await deleteScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(404);
      expect(reply._body.error.code).toBe(ErrorCode.SCREENSHOT_NOT_FOUND);
    });

    it('should not delete from storage if screenshot is not completed', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'PENDING',
        storageKey: null,
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockScreenshotRepository.delete.mockResolvedValue(undefined);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await deleteScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(204);
      expect(mockStorageService.delete).not.toHaveBeenCalled();
      expect(mockScreenshotRepository.delete).toHaveBeenCalled();
    });

    it('should not delete from storage if storageKey is missing', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        storageKey: null,
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockScreenshotRepository.delete.mockResolvedValue(undefined);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await deleteScreenshot(request as any, reply);

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

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await deleteScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(204);
      expect(mockScreenshotRepository.delete).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should return 500 on database deletion error', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'PENDING',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockScreenshotRepository.delete.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await deleteScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(500);
      expect(reply._body.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    });

    it('should delete failed screenshot without storage operation', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'FAILED',
        storageKey: null,
        error: 'Navigation failed',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockScreenshotRepository.delete.mockResolvedValue(undefined);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await deleteScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(204);
      expect(mockStorageService.delete).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle non-Error exceptions in getScreenshot', async () => {
      mockScreenshotRepository.findById.mockRejectedValue('string error');

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await getScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(500);
      expect(reply._body.error.message).toBe('Internal server error');
    });

    it('should handle non-Error exceptions in listScreenshots', async () => {
      mockScreenshotRepository.findByAccountId.mockRejectedValue(42);

      const request = createMockRequest({
        query: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        auth: { accountId: 'test-account-id' },
      });
      const reply = createMockReply();

      await listScreenshots(request as any, reply);

      expect(reply._statusCode).toBe(500);
      expect(reply._body.error.message).toBe('Internal server error');
    });

    it('should handle non-Error exceptions in downloadScreenshot', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        storageKey: 'screenshots/test/test.png',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockStorageService.download.mockRejectedValue({ custom: 'error object' });

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await downloadScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(500);
      expect(reply._body.error.message).toBe('Internal server error');
    });

    it('should handle non-Error exceptions in deleteScreenshot', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'PENDING',
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);
      mockScreenshotRepository.delete.mockRejectedValue(null);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await deleteScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(500);
      expect(reply._body.error.message).toBe('Internal server error');
    });

    it('should handle non-Error exceptions in createScreenshot (sync mode)', async () => {
      const mockScreenshot = createMockScreenshot();
      mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
      mockScreenshotRepository.markAsProcessing.mockResolvedValue({
        ...mockScreenshot,
        status: 'PROCESSING',
      });
      mockScreenshotRepository.markAsFailed.mockResolvedValue({
        ...mockScreenshot,
        status: 'FAILED',
      });
      mockScreenshotService.captureScreenshot.mockRejectedValue('not an Error');

      const request = createMockRequest({
        body: {
          url: 'https://example.com',
          format: 'png',
          async: false,
        },
        auth: { accountId: 'test-account-id' },
      });
      const reply = createMockReply();

      await createScreenshot(request as any, reply);

      expect(reply._statusCode).toBe(500);
      expect(reply._body.error.message).toBe('Failed to create screenshot');
    });

    it('should handle null metadata in response transformation', async () => {
      const mockScreenshot = createMockScreenshot({
        metadata: null,
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await getScreenshot(request as any, reply);

      expect(reply._body.data.metadata).toBeUndefined();
    });

    it('should handle null fileSize in response transformation', async () => {
      const mockScreenshot = createMockScreenshot({
        fileSize: null,
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await getScreenshot(request as any, reply);

      expect(reply._body.data.fileSize).toBeUndefined();
    });

    it('should handle null downloadUrl in response transformation', async () => {
      const mockScreenshot = createMockScreenshot({
        downloadUrl: null,
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await getScreenshot(request as any, reply);

      expect(reply._body.data.downloadUrl).toBeUndefined();
    });

    it('should handle null completedAt in response transformation', async () => {
      const mockScreenshot = createMockScreenshot({
        completedAt: null,
      });
      mockScreenshotRepository.findById.mockResolvedValue(mockScreenshot);

      const request = createMockRequest({
        params: { id: 'test-screenshot-id' },
      });
      const reply = createMockReply();

      await getScreenshot(request as any, reply);

      expect(reply._body.data.completedAt).toBeUndefined();
    });

    it('should handle empty query params for listScreenshots', async () => {
      mockScreenshotRepository.findByAccountId.mockResolvedValue({
        data: [],
        total: 0,
      });

      const request = createMockRequest({
        query: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        auth: { accountId: 'test-account-id' },
      });
      const reply = createMockReply();

      await listScreenshots(request as any, reply);

      expect(reply._statusCode).toBe(200);
      expect(reply._body.data).toEqual([]);
      expect(reply._body.meta.pagination.total).toBe(0);
    });
  });

  // ==========================================================================
  // Service Interaction Tests
  // ==========================================================================
  describe('Service Interactions', () => {
    it('should validate request before capture in synchronous mode', async () => {
      const mockScreenshot = createMockScreenshot();
      mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
      mockScreenshotRepository.markAsProcessing.mockResolvedValue({
        ...mockScreenshot,
        status: 'PROCESSING',
      });
      mockScreenshotService.validateRequest.mockImplementation(() => {
        throw new Error('Invalid viewport dimensions');
      });
      mockScreenshotRepository.markAsFailed.mockResolvedValue({
        ...mockScreenshot,
        status: 'FAILED',
      });

      const request = createMockRequest({
        body: {
          url: 'https://example.com',
          format: 'png',
          async: false,
        },
        auth: { accountId: 'test-account-id' },
      });
      const reply = createMockReply();

      await createScreenshot(request as any, reply);

      expect(mockScreenshotService.validateRequest).toHaveBeenCalled();
      expect(mockScreenshotService.captureScreenshot).not.toHaveBeenCalled();
      expect(reply._statusCode).toBe(500);
    });

    it('should generate correct download URL in synchronous mode', async () => {
      const mockScreenshot = createMockScreenshot();
      const completedScreenshot = createMockScreenshot({
        status: 'COMPLETED',
        downloadUrl: 'https://api.example.com/v1/screenshots/test-screenshot-id/download',
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

      const request = createMockRequest({
        body: {
          url: 'https://example.com',
          format: 'png',
          async: false,
        },
        auth: { accountId: 'test-account-id' },
        protocol: 'https',
        hostname: 'api.example.com',
      });
      const reply = createMockReply();

      await createScreenshot(request as any, reply);

      expect(mockScreenshotRepository.markAsCompleted).toHaveBeenCalledWith(
        mockScreenshot.id,
        'https://api.example.com/v1/screenshots/test-screenshot-id/download',
        expect.any(String),
        12345
      );
    });

    it('should pass metadata to storage upload', async () => {
      const mockScreenshot = createMockScreenshot();
      mockScreenshotRepository.create.mockResolvedValue(mockScreenshot);
      mockScreenshotRepository.markAsProcessing.mockResolvedValue({
        ...mockScreenshot,
        status: 'PROCESSING',
      });
      mockScreenshotRepository.markAsCompleted.mockResolvedValue({
        ...mockScreenshot,
        status: 'COMPLETED',
      });
      mockScreenshotService.captureScreenshot.mockResolvedValue({
        buffer: Buffer.from('test-image'),
        format: 'png',
        width: 1920,
        height: 1080,
        fileSize: 12345,
      });

      const request = createMockRequest({
        body: {
          url: 'https://example.com',
          format: 'png',
          async: false,
        },
        auth: { accountId: 'test-account-id' },
      });
      const reply = createMockReply();

      await createScreenshot(request as any, reply);

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'image/png',
        {
          screenshotId: mockScreenshot.id,
          url: 'https://example.com',
          width: '1920',
          height: '1080',
        }
      );
    });
  });
});
