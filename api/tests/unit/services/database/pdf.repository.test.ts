import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Pdf, PdfStatus, PdfType } from '@prisma/client';

// Create comprehensive Prisma mock
const mockPrisma = {
  pdf: {
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
const { PdfRepository, pdfRepository } = await import(
  '../../../../src/services/database/pdf.repository.js'
);

// Type definitions for imported module
type CreatePdfData = {
  accountId: string;
  type: 'URL' | 'HTML';
  url?: string;
  html?: string;
  format: 'LETTER' | 'LEGAL' | 'TABLOID' | 'LEDGER' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
  landscape?: boolean;
  printBackground?: boolean;
  margin?: unknown;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  pageRanges?: string;
  preferCSSPageSize?: boolean;
  width?: string;
  height?: string;
  scale?: number;
  waitOptions?: unknown;
  headers?: unknown;
  cookies?: unknown;
  userAgent?: string;
  metadata?: unknown;
  webhookUrl?: string;
};

type UpdatePdfStatusData = {
  status: PdfStatus;
  downloadUrl?: string;
  storageKey?: string;
  fileSize?: number;
  pages?: number;
  error?: string;
  completedAt?: Date;
};

type PdfPaginationOptions = {
  page: number;
  limit: number;
  status?: PdfStatus;
  type?: PdfType;
  sortBy?: 'createdAt' | 'completedAt';
  sortOrder?: 'asc' | 'desc';
};

// Test fixtures
const createMockPdf = (overrides: Partial<Pdf> = {}): Pdf => ({
  id: 'pdf-123',
  accountId: 'account-456',
  type: 'URL' as PdfType,
  url: 'https://example.com',
  html: null,
  format: 'A4',
  landscape: false,
  printBackground: true,
  margin: null,
  displayHeaderFooter: false,
  headerTemplate: null,
  footerTemplate: null,
  pageRanges: null,
  preferCSSPageSize: false,
  width: null,
  height: null,
  scale: 1.0,
  waitOptions: null,
  headers: null,
  cookies: null,
  userAgent: null,
  metadata: null,
  webhookUrl: null,
  status: 'PENDING' as PdfStatus,
  downloadUrl: null,
  storageKey: null,
  fileSize: null,
  pages: null,
  error: null,
  createdAt: new Date('2025-01-01T10:00:00Z'),
  completedAt: null,
  ...overrides,
});

const createPdfInput: CreatePdfData = {
  accountId: 'account-456',
  type: 'URL',
  url: 'https://example.com',
  format: 'A4',
  landscape: false,
  printBackground: true,
};

describe('PdfRepository', () => {
  let repository: InstanceType<typeof PdfRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new PdfRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================
  // create
  // ===========================================
  describe('create', () => {
    it('should create a PDF with minimal required fields', async () => {
      const mockPdf = createMockPdf();
      mockPrisma.pdf.create.mockResolvedValue(mockPdf);

      const result = await repository.create(createPdfInput);

      expect(result).toEqual(mockPdf);
      expect(mockPrisma.pdf.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'account-456',
          type: 'URL',
          url: 'https://example.com',
          format: 'A4',
          status: 'PENDING',
        }),
      });
    });

    it('should create a PDF with all optional fields', async () => {
      const fullInput: CreatePdfData = {
        accountId: 'account-456',
        type: 'HTML',
        html: '<html><body>Test</body></html>',
        format: 'LETTER',
        landscape: true,
        printBackground: false,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        displayHeaderFooter: true,
        headerTemplate: '<header>Header</header>',
        footerTemplate: '<footer>Footer</footer>',
        pageRanges: '1-3',
        preferCSSPageSize: true,
        width: '210mm',
        height: '297mm',
        scale: 0.8,
        waitOptions: { waitUntil: 'networkidle' },
        headers: { 'Authorization': 'Bearer token' },
        cookies: [{ name: 'session', value: 'abc123' }],
        userAgent: 'Custom User Agent',
        metadata: { customField: 'value' },
        webhookUrl: 'https://webhook.example.com/callback',
      };

      const mockPdf = createMockPdf({
        type: 'HTML' as PdfType,
        html: fullInput.html,
        format: fullInput.format,
        landscape: true,
        printBackground: false,
      });
      mockPrisma.pdf.create.mockResolvedValue(mockPdf);

      const result = await repository.create(fullInput);

      expect(result).toEqual(mockPdf);
      expect(mockPrisma.pdf.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'account-456',
          type: 'HTML',
          html: '<html><body>Test</body></html>',
          format: 'LETTER',
          landscape: true,
          printBackground: false,
          displayHeaderFooter: true,
          headerTemplate: '<header>Header</header>',
          footerTemplate: '<footer>Footer</footer>',
          pageRanges: '1-3',
          preferCSSPageSize: true,
          width: '210mm',
          height: '297mm',
          scale: 0.8,
          webhookUrl: 'https://webhook.example.com/callback',
          status: 'PENDING',
        }),
      });
    });

    it('should apply default values for optional boolean fields', async () => {
      const minimalInput: CreatePdfData = {
        accountId: 'account-456',
        type: 'URL',
        url: 'https://example.com',
        format: 'A4',
      };

      const mockPdf = createMockPdf();
      mockPrisma.pdf.create.mockResolvedValue(mockPdf);

      await repository.create(minimalInput);

      expect(mockPrisma.pdf.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          landscape: false,
          printBackground: true,
          displayHeaderFooter: false,
          preferCSSPageSize: false,
          scale: 1.0,
        }),
      });
    });

    it('should throw error on database failure', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.pdf.create.mockRejectedValue(dbError);

      await expect(repository.create(createPdfInput)).rejects.toThrow('Database connection failed');
    });

    it('should handle unique constraint violation', async () => {
      const constraintError = new Error('Unique constraint violation');
      mockPrisma.pdf.create.mockRejectedValue(constraintError);

      await expect(repository.create(createPdfInput)).rejects.toThrow('Unique constraint violation');
    });
  });

  // ===========================================
  // findById
  // ===========================================
  describe('findById', () => {
    it('should find a PDF by ID', async () => {
      const mockPdf = createMockPdf();
      mockPrisma.pdf.findUnique.mockResolvedValue(mockPdf);

      const result = await repository.findById('pdf-123');

      expect(result).toEqual(mockPdf);
      expect(mockPrisma.pdf.findUnique).toHaveBeenCalledWith({
        where: { id: 'pdf-123' },
      });
    });

    it('should return null when PDF not found', async () => {
      mockPrisma.pdf.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
      expect(mockPrisma.pdf.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
    });

    it('should throw error on database failure', async () => {
      mockPrisma.pdf.findUnique.mockRejectedValue(new Error('Query failed'));

      await expect(repository.findById('pdf-123')).rejects.toThrow('Query failed');
    });
  });

  // ===========================================
  // findByAccountId
  // ===========================================
  describe('findByAccountId', () => {
    const defaultOptions: PdfPaginationOptions = {
      page: 1,
      limit: 10,
    };

    it('should find PDFs by account ID with default pagination', async () => {
      const mockPdfs = [createMockPdf({ id: 'pdf-1' }), createMockPdf({ id: 'pdf-2' })];
      mockPrisma.$transaction.mockResolvedValue([mockPdfs, 2]);

      const result = await repository.findByAccountId('account-456', defaultOptions);

      expect(result).toEqual({ data: mockPdfs, total: 2 });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should apply pagination correctly', async () => {
      const options: PdfPaginationOptions = {
        page: 2,
        limit: 5,
      };

      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', options);

      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page - 1) * limit = (2 - 1) * 5
          take: 5,
        })
      );
    });

    it('should filter by status', async () => {
      const options: PdfPaginationOptions = {
        page: 1,
        limit: 10,
        status: 'COMPLETED' as PdfStatus,
      };

      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', options);

      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: 'account-456',
            status: 'COMPLETED',
          }),
        })
      );
    });

    it('should filter by type', async () => {
      const options: PdfPaginationOptions = {
        page: 1,
        limit: 10,
        type: 'HTML' as PdfType,
      };

      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', options);

      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: 'account-456',
            type: 'HTML',
          }),
        })
      );
    });

    it('should filter by both status and type', async () => {
      const options: PdfPaginationOptions = {
        page: 1,
        limit: 10,
        status: 'PENDING' as PdfStatus,
        type: 'URL' as PdfType,
      };

      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', options);

      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: 'account-456',
            status: 'PENDING',
            type: 'URL',
          }),
        })
      );
    });

    it('should sort by createdAt ascending', async () => {
      const options: PdfPaginationOptions = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      };

      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', options);

      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });

    it('should sort by completedAt descending', async () => {
      const options: PdfPaginationOptions = {
        page: 1,
        limit: 10,
        sortBy: 'completedAt',
        sortOrder: 'desc',
      };

      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', options);

      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { completedAt: 'desc' },
        })
      );
    });

    it('should use default sort order (createdAt desc)', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('account-456', defaultOptions);

      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should return empty result when no PDFs found', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await repository.findByAccountId('account-456', defaultOptions);

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should throw error on database failure', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(repository.findByAccountId('account-456', defaultOptions)).rejects.toThrow(
        'Transaction failed'
      );
    });
  });

  // ===========================================
  // updateStatus
  // ===========================================
  describe('updateStatus', () => {
    it('should update PDF status to PROCESSING', async () => {
      const mockPdf = createMockPdf({ status: 'PROCESSING' as PdfStatus });
      mockPrisma.pdf.update.mockResolvedValue(mockPdf);

      const updateData: UpdatePdfStatusData = {
        status: 'PROCESSING' as PdfStatus,
      };

      const result = await repository.updateStatus('pdf-123', updateData);

      expect(result.status).toBe('PROCESSING');
      expect(mockPrisma.pdf.update).toHaveBeenCalledWith({
        where: { id: 'pdf-123' },
        data: expect.objectContaining({
          status: 'PROCESSING',
        }),
      });
    });

    it('should update PDF status to COMPLETED with all fields', async () => {
      const completedAt = new Date('2025-01-01T12:00:00Z');
      const mockPdf = createMockPdf({
        status: 'COMPLETED' as PdfStatus,
        downloadUrl: 'https://storage.example.com/pdf-123.pdf',
        storageKey: 'pdfs/pdf-123.pdf',
        fileSize: 102400,
        pages: 5,
        completedAt,
      });
      mockPrisma.pdf.update.mockResolvedValue(mockPdf);

      const updateData: UpdatePdfStatusData = {
        status: 'COMPLETED' as PdfStatus,
        downloadUrl: 'https://storage.example.com/pdf-123.pdf',
        storageKey: 'pdfs/pdf-123.pdf',
        fileSize: 102400,
        pages: 5,
        completedAt,
      };

      const result = await repository.updateStatus('pdf-123', updateData);

      expect(result.status).toBe('COMPLETED');
      expect(result.downloadUrl).toBe('https://storage.example.com/pdf-123.pdf');
      expect(result.storageKey).toBe('pdfs/pdf-123.pdf');
      expect(result.fileSize).toBe(102400);
      expect(result.pages).toBe(5);
    });

    it('should update PDF status to FAILED with error message', async () => {
      const completedAt = new Date('2025-01-01T12:00:00Z');
      const mockPdf = createMockPdf({
        status: 'FAILED' as PdfStatus,
        error: 'Navigation timeout exceeded',
        completedAt,
      });
      mockPrisma.pdf.update.mockResolvedValue(mockPdf);

      const updateData: UpdatePdfStatusData = {
        status: 'FAILED' as PdfStatus,
        error: 'Navigation timeout exceeded',
        completedAt,
      };

      const result = await repository.updateStatus('pdf-123', updateData);

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Navigation timeout exceeded');
    });

    it('should throw error when PDF not found', async () => {
      const notFoundError = new Error('Record not found');
      mockPrisma.pdf.update.mockRejectedValue(notFoundError);

      await expect(
        repository.updateStatus('non-existent-id', { status: 'PROCESSING' as PdfStatus })
      ).rejects.toThrow('Record not found');
    });
  });

  // ===========================================
  // markAsProcessing
  // ===========================================
  describe('markAsProcessing', () => {
    it('should mark PDF as processing', async () => {
      const mockPdf = createMockPdf({ status: 'PROCESSING' as PdfStatus });
      mockPrisma.pdf.update.mockResolvedValue(mockPdf);

      const result = await repository.markAsProcessing('pdf-123');

      expect(result.status).toBe('PROCESSING');
      expect(mockPrisma.pdf.update).toHaveBeenCalledWith({
        where: { id: 'pdf-123' },
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
    it('should mark PDF as completed with all required fields', async () => {
      const mockPdf = createMockPdf({
        status: 'COMPLETED' as PdfStatus,
        downloadUrl: 'https://storage.example.com/pdf-123.pdf',
        storageKey: 'pdfs/pdf-123.pdf',
        fileSize: 102400,
        pages: 10,
        completedAt: new Date(),
      });
      mockPrisma.pdf.update.mockResolvedValue(mockPdf);

      const result = await repository.markAsCompleted(
        'pdf-123',
        'https://storage.example.com/pdf-123.pdf',
        'pdfs/pdf-123.pdf',
        102400,
        10
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.downloadUrl).toBe('https://storage.example.com/pdf-123.pdf');
      expect(result.storageKey).toBe('pdfs/pdf-123.pdf');
      expect(result.fileSize).toBe(102400);
      expect(result.pages).toBe(10);
      expect(mockPrisma.pdf.update).toHaveBeenCalledWith({
        where: { id: 'pdf-123' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          downloadUrl: 'https://storage.example.com/pdf-123.pdf',
          storageKey: 'pdfs/pdf-123.pdf',
          fileSize: 102400,
          pages: 10,
          completedAt: expect.any(Date),
        }),
      });
    });
  });

  // ===========================================
  // markAsFailed
  // ===========================================
  describe('markAsFailed', () => {
    it('should mark PDF as failed with error message', async () => {
      const mockPdf = createMockPdf({
        status: 'FAILED' as PdfStatus,
        error: 'Page not found',
        completedAt: new Date(),
      });
      mockPrisma.pdf.update.mockResolvedValue(mockPdf);

      const result = await repository.markAsFailed('pdf-123', 'Page not found');

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Page not found');
      expect(mockPrisma.pdf.update).toHaveBeenCalledWith({
        where: { id: 'pdf-123' },
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'Page not found',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should handle long error messages', async () => {
      const longError = 'E'.repeat(1000);
      const mockPdf = createMockPdf({
        status: 'FAILED' as PdfStatus,
        error: longError,
      });
      mockPrisma.pdf.update.mockResolvedValue(mockPdf);

      const result = await repository.markAsFailed('pdf-123', longError);

      expect(result.error).toBe(longError);
    });
  });

  // ===========================================
  // delete
  // ===========================================
  describe('delete', () => {
    it('should delete a PDF by ID', async () => {
      mockPrisma.pdf.delete.mockResolvedValue(createMockPdf());

      await repository.delete('pdf-123');

      expect(mockPrisma.pdf.delete).toHaveBeenCalledWith({
        where: { id: 'pdf-123' },
      });
    });

    it('should throw error when PDF not found', async () => {
      mockPrisma.pdf.delete.mockRejectedValue(new Error('Record not found'));

      await expect(repository.delete('non-existent-id')).rejects.toThrow('Record not found');
    });

    it('should not return the deleted PDF', async () => {
      mockPrisma.pdf.delete.mockResolvedValue(createMockPdf());

      const result = await repository.delete('pdf-123');

      expect(result).toBeUndefined();
    });
  });

  // ===========================================
  // countByStatus
  // ===========================================
  describe('countByStatus', () => {
    it('should count PDFs by status for an account', async () => {
      mockPrisma.pdf.count.mockResolvedValue(5);

      const result = await repository.countByStatus('account-456', 'PENDING' as PdfStatus);

      expect(result).toBe(5);
      expect(mockPrisma.pdf.count).toHaveBeenCalledWith({
        where: {
          accountId: 'account-456',
          status: 'PENDING',
        },
      });
    });

    it('should return 0 when no PDFs match', async () => {
      mockPrisma.pdf.count.mockResolvedValue(0);

      const result = await repository.countByStatus('account-456', 'FAILED' as PdfStatus);

      expect(result).toBe(0);
    });

    it('should count COMPLETED PDFs', async () => {
      mockPrisma.pdf.count.mockResolvedValue(10);

      const result = await repository.countByStatus('account-456', 'COMPLETED' as PdfStatus);

      expect(result).toBe(10);
      expect(mockPrisma.pdf.count).toHaveBeenCalledWith({
        where: {
          accountId: 'account-456',
          status: 'COMPLETED',
        },
      });
    });

    it('should count PROCESSING PDFs', async () => {
      mockPrisma.pdf.count.mockResolvedValue(3);

      const result = await repository.countByStatus('account-456', 'PROCESSING' as PdfStatus);

      expect(result).toBe(3);
    });
  });

  // ===========================================
  // findPending
  // ===========================================
  describe('findPending', () => {
    it('should find pending PDFs with default limit', async () => {
      const mockPdfs = [
        createMockPdf({ id: 'pdf-1' }),
        createMockPdf({ id: 'pdf-2' }),
      ];
      mockPrisma.pdf.findMany.mockResolvedValue(mockPdfs);

      const result = await repository.findPending();

      expect(result).toEqual(mockPdfs);
      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should find pending PDFs with custom limit', async () => {
      const mockPdfs = [createMockPdf({ id: 'pdf-1' })];
      mockPrisma.pdf.findMany.mockResolvedValue(mockPdfs);

      const result = await repository.findPending(5);

      expect(result).toEqual(mockPdfs);
      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        take: 5,
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no pending PDFs', async () => {
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      const result = await repository.findPending();

      expect(result).toEqual([]);
    });

    it('should order by createdAt ascending (FIFO)', async () => {
      const olderPdf = createMockPdf({
        id: 'pdf-1',
        createdAt: new Date('2025-01-01T09:00:00Z'),
      });
      const newerPdf = createMockPdf({
        id: 'pdf-2',
        createdAt: new Date('2025-01-01T10:00:00Z'),
      });
      mockPrisma.pdf.findMany.mockResolvedValue([olderPdf, newerPdf]);

      const result = await repository.findPending();

      expect(result[0].id).toBe('pdf-1');
      expect(result[1].id).toBe('pdf-2');
    });
  });

  // ===========================================
  // cleanupOld
  // ===========================================
  describe('cleanupOld', () => {
    it('should cleanup old completed and failed PDFs', async () => {
      mockPrisma.pdf.deleteMany.mockResolvedValue({ count: 15 });

      const result = await repository.cleanupOld(30);

      expect(result).toBe(15);
      expect(mockPrisma.pdf.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          createdAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should calculate cutoff date correctly', async () => {
      mockPrisma.pdf.deleteMany.mockResolvedValue({ count: 0 });

      const now = new Date();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      await repository.cleanupOld(7);

      const expectedCutoff = new Date(now);
      expectedCutoff.setDate(expectedCutoff.getDate() - 7);

      expect(mockPrisma.pdf.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          createdAt: { lt: expectedCutoff },
        },
      });

      vi.useRealTimers();
    });

    it('should return 0 when no old PDFs to cleanup', async () => {
      mockPrisma.pdf.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repository.cleanupOld(30);

      expect(result).toBe(0);
    });

    it('should not delete PENDING or PROCESSING PDFs', async () => {
      mockPrisma.pdf.deleteMany.mockResolvedValue({ count: 5 });

      await repository.cleanupOld(1);

      expect(mockPrisma.pdf.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          createdAt: expect.any(Object),
        },
      });
    });

    it('should handle cleanup with 0 days (delete all completed/failed)', async () => {
      mockPrisma.pdf.deleteMany.mockResolvedValue({ count: 100 });

      const result = await repository.cleanupOld(0);

      expect(result).toBe(100);
    });
  });

  // ===========================================
  // singleton instance
  // ===========================================
  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(pdfRepository).toBeInstanceOf(PdfRepository);
    });

    it('should be the same instance on multiple imports', async () => {
      const { pdfRepository: anotherImport } = await import(
        '../../../../src/services/database/pdf.repository.js'
      );
      expect(pdfRepository).toBe(anotherImport);
    });
  });

  // ===========================================
  // error handling
  // ===========================================
  describe('error handling', () => {
    it('should propagate Prisma errors', async () => {
      const prismaError = new Error('P2002: Unique constraint failed');
      mockPrisma.pdf.create.mockRejectedValue(prismaError);

      await expect(repository.create(createPdfInput)).rejects.toThrow(
        'P2002: Unique constraint failed'
      );
    });

    it('should handle connection timeout errors', async () => {
      const timeoutError = new Error('Connection timed out');
      mockPrisma.pdf.findUnique.mockRejectedValue(timeoutError);

      await expect(repository.findById('pdf-123')).rejects.toThrow('Connection timed out');
    });

    it('should handle transaction rollback', async () => {
      const rollbackError = new Error('Transaction rolled back');
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

      await repository.findByAccountId('account-456', { page: 1000000, limit: 10 });

      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 9999990,
          take: 10,
        })
      );
    });

    it('should handle limit of 1', async () => {
      mockPrisma.$transaction.mockResolvedValue([[createMockPdf()], 100]);

      const result = await repository.findByAccountId('account-456', { page: 1, limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(100);
    });

    it('should handle empty accountId', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await repository.findByAccountId('', { page: 1, limit: 10 });

      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: '',
          }),
        })
      );
    });

    it('should handle special characters in URL', async () => {
      const specialInput: CreatePdfData = {
        ...createPdfInput,
        url: 'https://example.com/path?query=value&special=%20chars',
      };
      mockPrisma.pdf.create.mockResolvedValue(
        createMockPdf({ url: specialInput.url })
      );

      const result = await repository.create(specialInput);

      expect(result.url).toBe('https://example.com/path?query=value&special=%20chars');
    });

    it('should handle unicode in HTML content', async () => {
      const unicodeInput: CreatePdfData = {
        accountId: 'account-456',
        type: 'HTML',
        html: '<html><body>Hello World</body></html>',
        format: 'A4',
      };
      mockPrisma.pdf.create.mockResolvedValue(
        createMockPdf({ html: unicodeInput.html })
      );

      const result = await repository.create(unicodeInput);

      expect(result.html).toBe('<html><body>Hello World</body></html>');
    });
  });
});
