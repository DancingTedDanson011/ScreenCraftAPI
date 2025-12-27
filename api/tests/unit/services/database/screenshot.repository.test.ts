import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Screenshot, ScreenshotStatus } from '@prisma/client';

// Create comprehensive Prisma mock
const mockPrisma = {
  screenshot: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
};

// Mock the prisma import
vi.mock('../../../../src/lib/db', () => ({
  prisma: mockPrisma,
}));

// Import repository after mocking
const { ScreenshotRepository, screenshotRepository } = await import(
  '../../../../src/services/database/screenshot.repository.js'
);

// Type definitions for imported module
type CreateScreenshotData = {
  accountId: string;
  url: string;
  format: 'PNG' | 'JPEG' | 'WEBP';
  fullPage?: boolean;
  quality?: number;
  viewport?: unknown;
  clip?: unknown;
  waitOptions?: unknown;
  headers?: unknown;
  cookies?: unknown;
  userAgent?: string;
  blockResources?: unknown;
  omitBackground?: boolean;
  encoding?: string;
  metadata?: unknown;
  webhookUrl?: string;
};

type UpdateScreenshotStatusData = {
  status: ScreenshotStatus;
  downloadUrl?: string;
  storageKey?: string;
  fileSize?: number;
  error?: string;
  completedAt?: Date;
};

type PaginationOptions = {
  page: number;
  limit: number;
  status?: ScreenshotStatus;
  sortBy?: 'createdAt' | 'completedAt';
  sortOrder?: 'asc' | 'desc';
};

// Test fixtures
const createMockScreenshot = (overrides: Partial<Screenshot> = {}): Screenshot => ({
  id: 'screenshot-123',
  accountId: 'account-456',
  url: 'https://example.com',
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
  status: 'PENDING' as ScreenshotStatus,
  downloadUrl: null,
  storageKey: null,
  fileSize: null,
  error: null,
  createdAt: new Date('2025-01-01T10:00:00Z'),
  completedAt: null,
  ...overrides,
});

const createScreenshotInput: CreateScreenshotData = {
  accountId: 'account-456',
  url: 'https://example.com',
  format: 'PNG',
};

describe('ScreenshotRepository', () => {
  let repository: InstanceType<typeof ScreenshotRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ScreenshotRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================
  // create
  // ===========================================
  describe('create', () => {
    it('should create a screenshot with minimal required fields', async () => {
      const mockScreenshot = createMockScreenshot();
      mockPrisma.screenshot.create.mockResolvedValue(mockScreenshot);

      const result = await repository.create(createScreenshotInput);

      expect(result).toEqual(mockScreenshot);
      expect(mockPrisma.screenshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'account-456',
          url: 'https://example.com',
          format: 'PNG',
          status: 'PENDING',
        }),
      });
    });

    it('should create a screenshot with all optional fields', async () => {
      const fullInput: CreateScreenshotData = {
        accountId: 'account-456',
        url: 'https://example.com',
        format: 'JPEG',
        fullPage: true,
        quality: 85,
        viewport: { width: 1920, height: 1080 },
        clip: { x: 0, y: 0, width: 800, height: 600 },
        waitOptions: { waitUntil: 'networkidle', timeout: 30000 },
        headers: { 'Authorization': 'Bearer token123' },
        cookies: [{ name: 'session', value: 'abc123', domain: 'example.com' }],
        userAgent: 'Custom User Agent String',
        blockResources: ['image', 'stylesheet'],
        omitBackground: true,
        encoding: 'base64',
        metadata: { requestId: 'req-789', source: 'api' },
        webhookUrl: 'https://webhook.example.com/callback',
      };

      const mockScreenshot = createMockScreenshot({
        format: 'JPEG',
        fullPage: true,
        quality: 85,
        omitBackground: true,
        encoding: 'base64',
      });
      mockPrisma.screenshot.create.mockResolvedValue(mockScreenshot);

      const result = await repository.create(fullInput);

      expect(result).toEqual(mockScreenshot);
      expect(mockPrisma.screenshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'account-456',
          url: 'https://example.com',
          format: 'JPEG',
          fullPage: true,
          quality: 85,
          omitBackground: true,
          encoding: 'base64',
          webhookUrl: 'https://webhook.example.com/callback',
          status: 'PENDING',
        }),
      });
    });

    it('should apply default values for optional boolean fields', async () => {
      const minimalInput: CreateScreenshotData = {
        accountId: 'account-456',
        url: 'https://example.com',
        format: 'PNG',
      };

      const mockScreenshot = createMockScreenshot();
      mockPrisma.screenshot.create.mockResolvedValue(mockScreenshot);

      await repository.create(minimalInput);

      expect(mockPrisma.screenshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullPage: false,
          omitBackground: false,
          encoding: 'binary',
        }),
      });
    });

    it('should create WEBP format screenshot', async () => {
      const webpInput: CreateScreenshotData = {
        accountId: 'account-456',
        url: 'https://example.com',
        format: 'WEBP',
        quality: 90,
      };

      const mockScreenshot = createMockScreenshot({ format: 'WEBP', quality: 90 });
      mockPrisma.screenshot.create.mockResolvedValue(mockScreenshot);

      const result = await repository.create(webpInput);

      expect(result.format).toBe('WEBP');
      expect(result.quality).toBe(90);
    });

    it('should throw error on database failure', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.screenshot.create.mockRejectedValue(dbError);

      await expect(repository.create(createScreenshotInput)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle unique constraint violation', async () => {
      const constraintError = new Error('Unique constraint violation');
      mockPrisma.screenshot.create.mockRejectedValue(constraintError);

      await expect(repository.create(createScreenshotInput)).rejects.toThrow(
        'Unique constraint violation'
      );
    });
  });

  // ===========================================
  // findById
  // ===========================================
  describe('findById', () => {
    it('should find a screenshot by ID', async () => {
      const mockScreenshot = createMockScreenshot();
      mockPrisma.screenshot.findUnique.mockResolvedValue(mockScreenshot);

      const result = await repository.findById('screenshot-123');

      expect(result).toEqual(mockScreenshot);
      expect(mockPrisma.screenshot.findUnique).toHaveBeenCalledWith({
        where: { id: 'screenshot-123' },
      });
    });

    it('should return null when screenshot not found', async () => {
      mockPrisma.screenshot.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
      expect(mockPrisma.screenshot.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
    });

    it('should throw error on database failure', async () => {
      mockPrisma.screenshot.findUnique.mockRejectedValue(new Error('Query failed'));

      await expect(repository.findById('screenshot-123')).rejects.toThrow('Query failed');
    });
  });

  // ===========================================
  // findByAccountId
  // ===========================================
  describe('findByAccountId', () => {
    const defaultOptions: PaginationOptions = {
      page: 1,
      limit: 10,
    };

    it('should find screenshots by account ID with default pagination', async () => {
      const mockScreenshots = [
        createMockScreenshot({ id: 'screenshot-1' }),
        createMockScreenshot({ id: 'screenshot-2' }),
      ];
      mockPrisma.$transaction.mockResolvedValue([mockScreenshots, 2]);

      const result = await repository.findByAccountId('account-456', defaultOptions);

      expect(result).toEqual({ data: mockScreenshots, total: 2 });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should apply pagination correctly for page 1', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', { page: 1, limit: 10 });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        })
      );
    });

    it('should apply pagination correctly for page 2', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', { page: 2, limit: 10 });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should apply pagination correctly for page 3 with limit 5', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', { page: 3, limit: 5 });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (3 - 1) * 5
          take: 5,
        })
      );
    });

    it('should filter by PENDING status', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', {
        page: 1,
        limit: 10,
        status: 'PENDING' as ScreenshotStatus,
      });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: 'account-456',
            status: 'PENDING',
          }),
        })
      );
    });

    it('should filter by COMPLETED status', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', {
        page: 1,
        limit: 10,
        status: 'COMPLETED' as ScreenshotStatus,
      });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: 'account-456',
            status: 'COMPLETED',
          }),
        })
      );
    });

    it('should filter by PROCESSING status', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', {
        page: 1,
        limit: 10,
        status: 'PROCESSING' as ScreenshotStatus,
      });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PROCESSING',
          }),
        })
      );
    });

    it('should filter by FAILED status', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', {
        page: 1,
        limit: 10,
        status: 'FAILED' as ScreenshotStatus,
      });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'FAILED',
          }),
        })
      );
    });

    it('should sort by createdAt ascending', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });

    it('should sort by createdAt descending', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should sort by completedAt ascending', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', {
        page: 1,
        limit: 10,
        sortBy: 'completedAt',
        sortOrder: 'asc',
      });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { completedAt: 'asc' },
        })
      );
    });

    it('should sort by completedAt descending', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', {
        page: 1,
        limit: 10,
        sortBy: 'completedAt',
        sortOrder: 'desc',
      });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { completedAt: 'desc' },
        })
      );
    });

    it('should use default sort (createdAt desc) when not specified', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', defaultOptions);

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should return empty result when no screenshots found', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await repository.findByAccountId('account-456', defaultOptions);

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should throw error on transaction failure', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(
        repository.findByAccountId('account-456', defaultOptions)
      ).rejects.toThrow('Transaction failed');
    });
  });

  // ===========================================
  // updateStatus
  // ===========================================
  describe('updateStatus', () => {
    it('should update screenshot status to PROCESSING', async () => {
      const mockScreenshot = createMockScreenshot({ status: 'PROCESSING' as ScreenshotStatus });
      mockPrisma.screenshot.update.mockResolvedValue(mockScreenshot);

      const updateData: UpdateScreenshotStatusData = {
        status: 'PROCESSING' as ScreenshotStatus,
      };

      const result = await repository.updateStatus('screenshot-123', updateData);

      expect(result.status).toBe('PROCESSING');
      expect(mockPrisma.screenshot.update).toHaveBeenCalledWith({
        where: { id: 'screenshot-123' },
        data: expect.objectContaining({
          status: 'PROCESSING',
        }),
      });
    });

    it('should update screenshot status to COMPLETED with all fields', async () => {
      const completedAt = new Date('2025-01-01T12:00:00Z');
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED' as ScreenshotStatus,
        downloadUrl: 'https://storage.example.com/screenshot-123.png',
        storageKey: 'screenshots/screenshot-123.png',
        fileSize: 51200,
        completedAt,
      });
      mockPrisma.screenshot.update.mockResolvedValue(mockScreenshot);

      const updateData: UpdateScreenshotStatusData = {
        status: 'COMPLETED' as ScreenshotStatus,
        downloadUrl: 'https://storage.example.com/screenshot-123.png',
        storageKey: 'screenshots/screenshot-123.png',
        fileSize: 51200,
        completedAt,
      };

      const result = await repository.updateStatus('screenshot-123', updateData);

      expect(result.status).toBe('COMPLETED');
      expect(result.downloadUrl).toBe('https://storage.example.com/screenshot-123.png');
      expect(result.storageKey).toBe('screenshots/screenshot-123.png');
      expect(result.fileSize).toBe(51200);
    });

    it('should update screenshot status to FAILED with error message', async () => {
      const completedAt = new Date('2025-01-01T12:00:00Z');
      const mockScreenshot = createMockScreenshot({
        status: 'FAILED' as ScreenshotStatus,
        error: 'Navigation timeout exceeded',
        completedAt,
      });
      mockPrisma.screenshot.update.mockResolvedValue(mockScreenshot);

      const updateData: UpdateScreenshotStatusData = {
        status: 'FAILED' as ScreenshotStatus,
        error: 'Navigation timeout exceeded',
        completedAt,
      };

      const result = await repository.updateStatus('screenshot-123', updateData);

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Navigation timeout exceeded');
    });

    it('should throw error when screenshot not found', async () => {
      const notFoundError = new Error('Record not found');
      mockPrisma.screenshot.update.mockRejectedValue(notFoundError);

      await expect(
        repository.updateStatus('non-existent-id', { status: 'PROCESSING' as ScreenshotStatus })
      ).rejects.toThrow('Record not found');
    });
  });

  // ===========================================
  // markAsProcessing
  // ===========================================
  describe('markAsProcessing', () => {
    it('should mark screenshot as processing', async () => {
      const mockScreenshot = createMockScreenshot({ status: 'PROCESSING' as ScreenshotStatus });
      mockPrisma.screenshot.update.mockResolvedValue(mockScreenshot);

      const result = await repository.markAsProcessing('screenshot-123');

      expect(result.status).toBe('PROCESSING');
      expect(mockPrisma.screenshot.update).toHaveBeenCalledWith({
        where: { id: 'screenshot-123' },
        data: expect.objectContaining({
          status: 'PROCESSING',
        }),
      });
    });
  });

  // ===========================================
  // markAsCompleted
  // ===========================================
  describe('markAsCompleted', () => {
    it('should mark screenshot as completed with all required fields', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED' as ScreenshotStatus,
        downloadUrl: 'https://storage.example.com/screenshot-123.png',
        storageKey: 'screenshots/screenshot-123.png',
        fileSize: 51200,
        completedAt: new Date(),
      });
      mockPrisma.screenshot.update.mockResolvedValue(mockScreenshot);

      const result = await repository.markAsCompleted(
        'screenshot-123',
        'https://storage.example.com/screenshot-123.png',
        'screenshots/screenshot-123.png',
        51200
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.downloadUrl).toBe('https://storage.example.com/screenshot-123.png');
      expect(result.storageKey).toBe('screenshots/screenshot-123.png');
      expect(result.fileSize).toBe(51200);
      expect(mockPrisma.screenshot.update).toHaveBeenCalledWith({
        where: { id: 'screenshot-123' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          downloadUrl: 'https://storage.example.com/screenshot-123.png',
          storageKey: 'screenshots/screenshot-123.png',
          fileSize: 51200,
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should set completedAt to current date', async () => {
      const now = new Date('2025-01-15T14:30:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const mockScreenshot = createMockScreenshot({
        status: 'COMPLETED' as ScreenshotStatus,
        completedAt: now,
      });
      mockPrisma.screenshot.update.mockResolvedValue(mockScreenshot);

      await repository.markAsCompleted(
        'screenshot-123',
        'https://storage.example.com/screenshot.png',
        'screenshots/screenshot.png',
        1024
      );

      expect(mockPrisma.screenshot.update).toHaveBeenCalledWith({
        where: { id: 'screenshot-123' },
        data: expect.objectContaining({
          completedAt: now,
        }),
      });

      vi.useRealTimers();
    });
  });

  // ===========================================
  // markAsFailed
  // ===========================================
  describe('markAsFailed', () => {
    it('should mark screenshot as failed with error message', async () => {
      const mockScreenshot = createMockScreenshot({
        status: 'FAILED' as ScreenshotStatus,
        error: 'Page not found',
        completedAt: new Date(),
      });
      mockPrisma.screenshot.update.mockResolvedValue(mockScreenshot);

      const result = await repository.markAsFailed('screenshot-123', 'Page not found');

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Page not found');
      expect(mockPrisma.screenshot.update).toHaveBeenCalledWith({
        where: { id: 'screenshot-123' },
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'Page not found',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should handle network error messages', async () => {
      const networkError = 'net::ERR_NAME_NOT_RESOLVED';
      const mockScreenshot = createMockScreenshot({
        status: 'FAILED' as ScreenshotStatus,
        error: networkError,
      });
      mockPrisma.screenshot.update.mockResolvedValue(mockScreenshot);

      const result = await repository.markAsFailed('screenshot-123', networkError);

      expect(result.error).toBe(networkError);
    });

    it('should handle timeout error messages', async () => {
      const timeoutError = 'Timeout 30000ms exceeded while waiting for page to load';
      const mockScreenshot = createMockScreenshot({
        status: 'FAILED' as ScreenshotStatus,
        error: timeoutError,
      });
      mockPrisma.screenshot.update.mockResolvedValue(mockScreenshot);

      const result = await repository.markAsFailed('screenshot-123', timeoutError);

      expect(result.error).toBe(timeoutError);
    });

    it('should handle very long error messages', async () => {
      const longError = 'E'.repeat(2000);
      const mockScreenshot = createMockScreenshot({
        status: 'FAILED' as ScreenshotStatus,
        error: longError,
      });
      mockPrisma.screenshot.update.mockResolvedValue(mockScreenshot);

      const result = await repository.markAsFailed('screenshot-123', longError);

      expect(result.error).toBe(longError);
    });
  });

  // ===========================================
  // delete
  // ===========================================
  describe('delete', () => {
    it('should delete a screenshot by ID', async () => {
      mockPrisma.screenshot.delete.mockResolvedValue(createMockScreenshot());

      await repository.delete('screenshot-123');

      expect(mockPrisma.screenshot.delete).toHaveBeenCalledWith({
        where: { id: 'screenshot-123' },
      });
    });

    it('should throw error when screenshot not found', async () => {
      mockPrisma.screenshot.delete.mockRejectedValue(new Error('Record not found'));

      await expect(repository.delete('non-existent-id')).rejects.toThrow('Record not found');
    });

    it('should not return the deleted screenshot', async () => {
      mockPrisma.screenshot.delete.mockResolvedValue(createMockScreenshot());

      const result = await repository.delete('screenshot-123');

      expect(result).toBeUndefined();
    });
  });

  // ===========================================
  // countByStatus
  // ===========================================
  describe('countByStatus', () => {
    it('should count PENDING screenshots for an account', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(5);

      const result = await repository.countByStatus('account-456', 'PENDING' as ScreenshotStatus);

      expect(result).toBe(5);
      expect(mockPrisma.screenshot.count).toHaveBeenCalledWith({
        where: {
          accountId: 'account-456',
          status: 'PENDING',
        },
      });
    });

    it('should count PROCESSING screenshots for an account', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(3);

      const result = await repository.countByStatus(
        'account-456',
        'PROCESSING' as ScreenshotStatus
      );

      expect(result).toBe(3);
    });

    it('should count COMPLETED screenshots for an account', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(100);

      const result = await repository.countByStatus(
        'account-456',
        'COMPLETED' as ScreenshotStatus
      );

      expect(result).toBe(100);
    });

    it('should count FAILED screenshots for an account', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(2);

      const result = await repository.countByStatus('account-456', 'FAILED' as ScreenshotStatus);

      expect(result).toBe(2);
    });

    it('should return 0 when no screenshots match', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(0);

      const result = await repository.countByStatus('account-456', 'FAILED' as ScreenshotStatus);

      expect(result).toBe(0);
    });
  });

  // ===========================================
  // findPending
  // ===========================================
  describe('findPending', () => {
    it('should find pending screenshots with default limit', async () => {
      const mockScreenshots = [
        createMockScreenshot({ id: 'screenshot-1' }),
        createMockScreenshot({ id: 'screenshot-2' }),
      ];
      mockPrisma.screenshot.findMany.mockResolvedValue(mockScreenshots);

      const result = await repository.findPending();

      expect(result).toEqual(mockScreenshots);
      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should find pending screenshots with custom limit', async () => {
      const mockScreenshots = [createMockScreenshot({ id: 'screenshot-1' })];
      mockPrisma.screenshot.findMany.mockResolvedValue(mockScreenshots);

      const result = await repository.findPending(5);

      expect(result).toEqual(mockScreenshots);
      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        take: 5,
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should find pending screenshots with limit of 1', async () => {
      mockPrisma.screenshot.findMany.mockResolvedValue([createMockScreenshot()]);

      await repository.findPending(1);

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        take: 1,
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should find pending screenshots with large limit', async () => {
      mockPrisma.screenshot.findMany.mockResolvedValue([]);

      await repository.findPending(1000);

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        take: 1000,
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no pending screenshots', async () => {
      mockPrisma.screenshot.findMany.mockResolvedValue([]);

      const result = await repository.findPending();

      expect(result).toEqual([]);
    });

    it('should order by createdAt ascending (FIFO)', async () => {
      const olderScreenshot = createMockScreenshot({
        id: 'screenshot-1',
        createdAt: new Date('2025-01-01T09:00:00Z'),
      });
      const newerScreenshot = createMockScreenshot({
        id: 'screenshot-2',
        createdAt: new Date('2025-01-01T10:00:00Z'),
      });
      mockPrisma.screenshot.findMany.mockResolvedValue([olderScreenshot, newerScreenshot]);

      const result = await repository.findPending();

      expect(result[0].id).toBe('screenshot-1');
      expect(result[1].id).toBe('screenshot-2');
    });
  });

  // ===========================================
  // cleanupOld
  // ===========================================
  describe('cleanupOld', () => {
    it('should cleanup old completed and failed screenshots', async () => {
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 25 });

      const result = await repository.cleanupOld(30);

      expect(result).toBe(25);
      expect(mockPrisma.screenshot.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          createdAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should calculate cutoff date correctly for 7 days', async () => {
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 0 });

      const now = new Date('2025-01-15T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      await repository.cleanupOld(7);

      const expectedCutoff = new Date('2025-01-08T12:00:00Z');

      expect(mockPrisma.screenshot.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          createdAt: { lt: expectedCutoff },
        },
      });

      vi.useRealTimers();
    });

    it('should calculate cutoff date correctly for 30 days', async () => {
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 0 });

      const now = new Date('2025-02-15T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      await repository.cleanupOld(30);

      const expectedCutoff = new Date('2025-01-16T12:00:00Z');

      expect(mockPrisma.screenshot.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          createdAt: { lt: expectedCutoff },
        },
      });

      vi.useRealTimers();
    });

    it('should return 0 when no old screenshots to cleanup', async () => {
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repository.cleanupOld(30);

      expect(result).toBe(0);
    });

    it('should not delete PENDING screenshots', async () => {
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 10 });

      await repository.cleanupOld(1);

      expect(mockPrisma.screenshot.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          createdAt: expect.any(Object),
        },
      });
    });

    it('should not delete PROCESSING screenshots', async () => {
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 10 });

      await repository.cleanupOld(1);

      const callArgs = mockPrisma.screenshot.deleteMany.mock.calls[0][0];
      expect(callArgs.where.status.in).not.toContain('PROCESSING');
    });

    it('should handle cleanup with 0 days (delete all completed/failed)', async () => {
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 500 });

      const result = await repository.cleanupOld(0);

      expect(result).toBe(500);
    });

    it('should handle cleanup with 365 days', async () => {
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 1000 });

      const result = await repository.cleanupOld(365);

      expect(result).toBe(1000);
    });
  });

  // ===========================================
  // singleton instance
  // ===========================================
  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(screenshotRepository).toBeInstanceOf(ScreenshotRepository);
    });

    it('should be the same instance on multiple imports', async () => {
      const { screenshotRepository: anotherImport } = await import(
        '../../../../src/services/database/screenshot.repository.js'
      );
      expect(screenshotRepository).toBe(anotherImport);
    });
  });

  // ===========================================
  // error handling
  // ===========================================
  describe('error handling', () => {
    it('should propagate Prisma P2002 unique constraint errors', async () => {
      const prismaError = new Error('P2002: Unique constraint failed on the fields: (`id`)');
      mockPrisma.screenshot.create.mockRejectedValue(prismaError);

      await expect(repository.create(createScreenshotInput)).rejects.toThrow('P2002');
    });

    it('should propagate Prisma P2025 record not found errors', async () => {
      const prismaError = new Error('P2025: An operation failed because it depends on records that were not found.');
      mockPrisma.screenshot.update.mockRejectedValue(prismaError);

      await expect(
        repository.updateStatus('invalid-id', { status: 'PROCESSING' as ScreenshotStatus })
      ).rejects.toThrow('P2025');
    });

    it('should handle connection timeout errors', async () => {
      const timeoutError = new Error('Connection timed out');
      mockPrisma.screenshot.findUnique.mockRejectedValue(timeoutError);

      await expect(repository.findById('screenshot-123')).rejects.toThrow('Connection timed out');
    });

    it('should handle connection pool exhaustion', async () => {
      const poolError = new Error('Connection pool exhausted');
      mockPrisma.screenshot.create.mockRejectedValue(poolError);

      await expect(repository.create(createScreenshotInput)).rejects.toThrow(
        'Connection pool exhausted'
      );
    });

    it('should handle transaction rollback', async () => {
      const rollbackError = new Error('Transaction rolled back due to conflict');
      mockPrisma.$transaction.mockRejectedValue(rollbackError);

      await expect(
        repository.findByAccountId('account-456', { page: 1, limit: 10 })
      ).rejects.toThrow('Transaction rolled back');
    });
  });

  // ===========================================
  // edge cases
  // ===========================================
  describe('edge cases', () => {
    it('should handle very large page numbers', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', { page: 999999, limit: 10 });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 9999980,
          take: 10,
        })
      );
    });

    it('should handle limit of 1', async () => {
      mockPrisma.$transaction.mockResolvedValue([[createMockScreenshot()], 1000]);

      const result = await repository.findByAccountId('account-456', { page: 1, limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1000);
    });

    it('should handle empty accountId', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('', { page: 1, limit: 10 });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: '',
          }),
        })
      );
    });

    it('should handle URL with special characters', async () => {
      const specialInput: CreateScreenshotData = {
        ...createScreenshotInput,
        url: 'https://example.com/path?query=value&special=%20chars#fragment',
      };
      mockPrisma.screenshot.create.mockResolvedValue(
        createMockScreenshot({ url: specialInput.url })
      );

      const result = await repository.create(specialInput);

      expect(result.url).toBe('https://example.com/path?query=value&special=%20chars#fragment');
    });

    it('should handle URL with unicode characters', async () => {
      const unicodeInput: CreateScreenshotData = {
        ...createScreenshotInput,
        url: 'https://example.com/path/file',
      };
      mockPrisma.screenshot.create.mockResolvedValue(
        createMockScreenshot({ url: unicodeInput.url })
      );

      const result = await repository.create(unicodeInput);

      expect(result.url).toBe('https://example.com/path/file');
    });

    it('should handle very long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000);
      const longUrlInput: CreateScreenshotData = {
        ...createScreenshotInput,
        url: longUrl,
      };
      mockPrisma.screenshot.create.mockResolvedValue(
        createMockScreenshot({ url: longUrl })
      );

      const result = await repository.create(longUrlInput);

      expect(result.url).toBe(longUrl);
    });

    it('should handle complex viewport configuration', async () => {
      const complexViewport = {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 2,
        isMobile: false,
        hasTouch: false,
        isLandscape: true,
      };
      const complexInput: CreateScreenshotData = {
        ...createScreenshotInput,
        viewport: complexViewport,
      };
      mockPrisma.screenshot.create.mockResolvedValue(
        createMockScreenshot({ viewport: complexViewport as unknown })
      );

      const result = await repository.create(complexInput);

      expect(result.viewport).toEqual(complexViewport);
    });

    it('should handle complex clip configuration', async () => {
      const clipConfig = { x: 100, y: 200, width: 800, height: 600 };
      const clipInput: CreateScreenshotData = {
        ...createScreenshotInput,
        clip: clipConfig,
      };
      mockPrisma.screenshot.create.mockResolvedValue(
        createMockScreenshot({ clip: clipConfig as unknown })
      );

      const result = await repository.create(clipInput);

      expect(result.clip).toEqual(clipConfig);
    });

    it('should handle multiple cookies', async () => {
      const cookies = [
        { name: 'session', value: 'abc123', domain: 'example.com' },
        { name: 'auth', value: 'token456', domain: 'example.com', httpOnly: true },
        { name: 'prefs', value: 'dark_mode', domain: '.example.com', secure: true },
      ];
      const cookieInput: CreateScreenshotData = {
        ...createScreenshotInput,
        cookies: cookies,
      };
      mockPrisma.screenshot.create.mockResolvedValue(
        createMockScreenshot({ cookies: cookies as unknown })
      );

      const result = await repository.create(cookieInput);

      expect(result.cookies).toEqual(cookies);
    });

    it('should handle block resources array', async () => {
      const blockResources = ['image', 'stylesheet', 'font', 'media', 'script'];
      const blockInput: CreateScreenshotData = {
        ...createScreenshotInput,
        blockResources: blockResources,
      };
      mockPrisma.screenshot.create.mockResolvedValue(
        createMockScreenshot({ blockResources: blockResources as unknown })
      );

      const result = await repository.create(blockInput);

      expect(result.blockResources).toEqual(blockResources);
    });
  });
});
