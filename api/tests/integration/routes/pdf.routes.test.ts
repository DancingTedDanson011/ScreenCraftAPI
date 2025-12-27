/**
 * PDF Routes Integration Tests
 *
 * Tests for PDF API endpoints:
 * - POST /v1/pdfs - Create PDF
 * - GET /v1/pdfs/:id - Get PDF status
 * - GET /v1/pdfs - List PDFs
 * - GET /v1/pdfs/:id/download - Download PDF
 * - DELETE /v1/pdfs/:id - Delete PDF
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pdf } from '@prisma/client';

// ============================================================================
// MOCK SETUP - Must be done before imports
// ============================================================================

// Mock PDF Repository
const mockPdfRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByAccountId: vi.fn(),
  markAsProcessing: vi.fn(),
  markAsCompleted: vi.fn(),
  markAsFailed: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../../src/services/database/pdf.repository', () => ({
  pdfRepository: mockPdfRepository,
}));

// Mock PDF Service
const mockPdfService = {
  validateRequest: vi.fn(),
  generatePdf: vi.fn(),
  checkHealth: vi.fn(),
};

vi.mock('../../../src/services/pdf/index.js', () => ({
  getPdfService: vi.fn(() => mockPdfService),
  PdfError: class PdfError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PdfError';
    }
  },
}));

// Mock Storage Service
const mockStorageService = {
  generatePdfKey: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  getSignedUrl: vi.fn(),
};

vi.mock('../../../src/services/storage/storage.service.js', () => ({
  StorageService: class MockStorageService {
    generatePdfKey = mockStorageService.generatePdfKey;
    upload = mockStorageService.upload;
    download = mockStorageService.download;
    delete = mockStorageService.delete;
    getSignedUrl = mockStorageService.getSignedUrl;
  },
}));

// Mock Queue Service
const mockQueueService = {
  addPdfJob: vi.fn(),
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
import pdfRoutes from '../../../src/routes/pdf.routes.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockPdf = (overrides: Partial<Pdf> = {}): Pdf => ({
  id: 'pdf-123',
  accountId: 'account-123',
  type: 'URL',
  url: 'https://example.com',
  html: null,
  status: 'PENDING',
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
  scale: 1,
  waitOptions: null,
  headers: null,
  cookies: null,
  userAgent: null,
  metadata: null,
  webhookUrl: null,
  downloadUrl: null,
  storageKey: null,
  fileSize: null,
  pages: null,
  error: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  completedAt: null,
  ...overrides,
});

const validPdfFromUrlRequest = {
  type: 'url',
  url: 'https://example.com',
  format: 'A4',
  landscape: false,
  printBackground: true,
};

const validPdfFromHtmlRequest = {
  type: 'html',
  html: '<html><body><h1>Test PDF</h1></body></html>',
  format: 'A4',
  landscape: false,
  printBackground: true,
};

// ============================================================================
// TEST SETUP
// ============================================================================

describe('PDF Routes Integration', () => {
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

    // Register PDF routes with prefix
    await app.register(pdfRoutes, { prefix: '/v1' });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock implementations
    mockStorageService.generatePdfKey.mockReturnValue('pdfs/account-123/123456-test.pdf');
  });

  // ==========================================================================
  // POST /v1/pdfs - Create PDF
  // ==========================================================================
  describe('POST /v1/pdfs', () => {
    describe('PDF from URL - Synchronous Processing', () => {
      it('should create PDF from URL synchronously and return 201', async () => {
        const mockPdf = createMockPdf();
        const completedPdf = createMockPdf({
          status: 'COMPLETED',
          downloadUrl: 'https://api.example.com/v1/pdfs/pdf-123/download',
          storageKey: 'pdfs/account-123/123456-test.pdf',
          fileSize: 54321,
          pages: 3,
          completedAt: new Date(),
        });

        mockPdfRepository.create.mockResolvedValue(mockPdf);
        mockPdfRepository.markAsProcessing.mockResolvedValue({
          ...mockPdf,
          status: 'PROCESSING',
        });
        mockPdfRepository.markAsCompleted.mockResolvedValue(completedPdf);
        mockPdfService.generatePdf.mockResolvedValue({
          buffer: Buffer.from('pdf-content'),
          pages: 3,
          fileSize: 54321,
        });
        mockStorageService.upload.mockResolvedValue('pdfs/account-123/123456-test.pdf');

        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: { ...validPdfFromUrlRequest, async: false },
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('completed');
        expect(body.data.id).toBe('pdf-123');
      });

      it('should mark PDF as failed when generation fails', async () => {
        const mockPdf = createMockPdf();
        const failedPdf = createMockPdf({
          status: 'FAILED',
          error: 'PDF generation timeout',
        });

        mockPdfRepository.create.mockResolvedValue(mockPdf);
        mockPdfRepository.markAsProcessing.mockResolvedValue({
          ...mockPdf,
          status: 'PROCESSING',
        });
        mockPdfRepository.markAsFailed.mockResolvedValue(failedPdf);
        mockPdfService.generatePdf.mockRejectedValue(
          new Error('PDF generation timeout')
        );

        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: { ...validPdfFromUrlRequest, async: false },
        });

        expect(response.statusCode).toBe(500);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('PROCESSING_FAILED');
      });
    });

    describe('PDF from HTML - Synchronous Processing', () => {
      it('should create PDF from HTML synchronously and return 201', async () => {
        const mockPdf = createMockPdf({ type: 'HTML', html: '<h1>Test</h1>' });
        const completedPdf = createMockPdf({
          type: 'HTML',
          html: '<h1>Test</h1>',
          status: 'COMPLETED',
          downloadUrl: 'https://api.example.com/v1/pdfs/pdf-123/download',
          storageKey: 'pdfs/account-123/123456-test.pdf',
          fileSize: 12345,
          pages: 1,
          completedAt: new Date(),
        });

        mockPdfRepository.create.mockResolvedValue(mockPdf);
        mockPdfRepository.markAsProcessing.mockResolvedValue({
          ...mockPdf,
          status: 'PROCESSING',
        });
        mockPdfRepository.markAsCompleted.mockResolvedValue(completedPdf);
        mockPdfService.generatePdf.mockResolvedValue({
          buffer: Buffer.from('pdf-content'),
          pages: 1,
          fileSize: 12345,
        });
        mockStorageService.upload.mockResolvedValue('pdfs/account-123/123456-test.pdf');

        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: { ...validPdfFromHtmlRequest, async: false },
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('completed');
      });
    });

    describe('Asynchronous Processing', () => {
      it('should queue PDF job and return 202 for async URL request', async () => {
        const mockPdf = createMockPdf();
        mockPdfRepository.create.mockResolvedValue(mockPdf);
        mockQueueService.addPdfJob.mockResolvedValue('job-id-123');

        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: { ...validPdfFromUrlRequest, async: true },
        });

        expect(response.statusCode).toBe(202);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('pending');
        expect(mockQueueService.addPdfJob).toHaveBeenCalled();
      });

      it('should queue PDF job and return 202 for async HTML request', async () => {
        const mockPdf = createMockPdf({ type: 'HTML' });
        mockPdfRepository.create.mockResolvedValue(mockPdf);
        mockQueueService.addPdfJob.mockResolvedValue('job-id-123');

        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: { ...validPdfFromHtmlRequest, async: true },
        });

        expect(response.statusCode).toBe(202);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('pending');
      });
    });

    describe('Validation', () => {
      it('should return 400 for missing type', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: { url: 'https://example.com', format: 'A4' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for URL type without URL', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: { type: 'url', format: 'A4' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for HTML type without HTML content', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: { type: 'html', format: 'A4' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for invalid URL format', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: { type: 'url', url: 'not-a-valid-url', format: 'A4' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 400 for invalid paper format', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: { type: 'url', url: 'https://example.com', format: 'B5' },
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid paper formats', async () => {
        mockPdfRepository.create.mockResolvedValue(createMockPdf());
        mockQueueService.addPdfJob.mockResolvedValue('job-id');

        const validFormats = ['Letter', 'Legal', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'];

        for (const format of validFormats) {
          const response = await app.inject({
            method: 'POST',
            url: '/v1/pdfs',
            payload: { type: 'url', url: 'https://example.com', format, async: true },
          });

          expect(response.statusCode).toBe(202);
        }
      });
    });

    describe('Request Options', () => {
      it('should accept all valid PDF options for URL type', async () => {
        const mockPdf = createMockPdf();
        mockPdfRepository.create.mockResolvedValue(mockPdf);
        mockQueueService.addPdfJob.mockResolvedValue('job-id');

        const fullRequest = {
          type: 'url',
          url: 'https://example.com',
          format: 'A4',
          landscape: true,
          printBackground: true,
          margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
          displayHeaderFooter: true,
          headerTemplate: '<div>Header</div>',
          footerTemplate: '<div>Footer</div>',
          pageRanges: '1-3',
          preferCSSPageSize: true,
          scale: 0.8,
          waitOptions: { waitUntil: 'networkidle0', timeout: 45000 },
          headers: { 'Accept-Language': 'en-US' },
          cookies: [{ name: 'session', value: 'test' }],
          userAgent: 'Custom User Agent',
          metadata: { custom: 'data' },
          webhookUrl: 'https://webhook.example.com/callback',
          async: true,
        };

        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: fullRequest,
        });

        expect(response.statusCode).toBe(202);
        expect(mockPdfRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'URL',
            url: 'https://example.com',
            format: 'A4',
            landscape: true,
          })
        );
      });

      it('should accept all valid PDF options for HTML type', async () => {
        const mockPdf = createMockPdf({ type: 'HTML' });
        mockPdfRepository.create.mockResolvedValue(mockPdf);
        mockQueueService.addPdfJob.mockResolvedValue('job-id');

        const fullRequest = {
          type: 'html',
          html: '<html><body><h1>Test</h1></body></html>',
          format: 'Letter',
          landscape: false,
          printBackground: true,
          margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
          displayHeaderFooter: false,
          scale: 1.2,
          metadata: { document: 'test' },
          async: true,
        };

        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: fullRequest,
        });

        expect(response.statusCode).toBe(202);
        expect(mockPdfRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'HTML',
            html: '<html><body><h1>Test</h1></body></html>',
            format: 'Letter',
          })
        );
      });
    });

    describe('Response Format', () => {
      it('should include correct meta information', async () => {
        const mockPdf = createMockPdf();
        mockPdfRepository.create.mockResolvedValue(mockPdf);
        mockQueueService.addPdfJob.mockResolvedValue('job-id');

        const response = await app.inject({
          method: 'POST',
          url: '/v1/pdfs',
          payload: { ...validPdfFromUrlRequest, async: true },
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
  // GET /v1/pdfs/:id - Get PDF
  // ==========================================================================
  describe('GET /v1/pdfs/:id', () => {
    it('should return PDF by ID with status 200', async () => {
      const mockPdf = createMockPdf({
        status: 'COMPLETED',
        downloadUrl: 'https://example.com/download',
        fileSize: 54321,
        pages: 5,
        completedAt: new Date(),
      });
      mockPdfRepository.findById.mockResolvedValue(mockPdf);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs/pdf-123',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('pdf-123');
      expect(body.data.status).toBe('completed');
      expect(body.data.pages).toBe(5);
    });

    it('should return 404 when PDF not found', async () => {
      mockPdfRepository.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs/non-existent-id',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('PDF_NOT_FOUND');
    });

    it('should include all PDF fields in response', async () => {
      const mockPdf = createMockPdf({
        status: 'COMPLETED',
        format: 'Letter',
        fileSize: 98765,
        pages: 10,
        downloadUrl: 'https://example.com/download',
        metadata: { document: 'test' },
        completedAt: new Date('2024-01-02T00:00:00Z'),
      });
      mockPdfRepository.findById.mockResolvedValue(mockPdf);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs/pdf-123',
      });

      const body = JSON.parse(response.body);
      expect(body.data.format).toBe('Letter');
      expect(body.data.fileSize).toBe(98765);
      expect(body.data.pages).toBe(10);
      expect(body.data.downloadUrl).toBe('https://example.com/download');
    });

    it('should handle PDF with error field', async () => {
      const mockPdf = createMockPdf({
        status: 'FAILED',
        error: 'PDF generation timeout exceeded',
      });
      mockPdfRepository.findById.mockResolvedValue(mockPdf);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs/pdf-123',
      });

      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('failed');
      expect(body.data.error).toBe('PDF generation timeout exceeded');
    });
  });

  // ==========================================================================
  // GET /v1/pdfs - List PDFs
  // ==========================================================================
  describe('GET /v1/pdfs', () => {
    it('should list PDFs with pagination', async () => {
      const mockPdfs = [
        createMockPdf({ id: 'pdf-1' }),
        createMockPdf({ id: 'pdf-2' }),
      ];
      mockPdfRepository.findByAccountId.mockResolvedValue({
        data: mockPdfs,
        total: 2,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs?page=1&limit=20',
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
      const mockPdfs = [createMockPdf({ id: 'pdf-1', status: 'COMPLETED' })];
      mockPdfRepository.findByAccountId.mockResolvedValue({
        data: mockPdfs,
        total: 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs?status=completed',
      });

      expect(response.statusCode).toBe(200);
      expect(mockPdfRepository.findByAccountId).toHaveBeenCalledWith(
        'account-123',
        expect.objectContaining({
          status: 'COMPLETED',
        })
      );
    });

    it('should filter by type', async () => {
      const mockPdfs = [createMockPdf({ id: 'pdf-1', type: 'HTML' })];
      mockPdfRepository.findByAccountId.mockResolvedValue({
        data: mockPdfs,
        total: 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs?type=html',
      });

      expect(response.statusCode).toBe(200);
      expect(mockPdfRepository.findByAccountId).toHaveBeenCalledWith(
        'account-123',
        expect.objectContaining({
          type: 'HTML',
        })
      );
    });

    it('should calculate pagination correctly', async () => {
      const mockPdfs = Array(20)
        .fill(null)
        .map((_, i) => createMockPdf({ id: `pdf-${i}` }));
      mockPdfRepository.findByAccountId.mockResolvedValue({
        data: mockPdfs,
        total: 75,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs?page=3&limit=20',
      });

      const body = JSON.parse(response.body);
      expect(body.meta.pagination).toEqual({
        page: 3,
        limit: 20,
        total: 75,
        totalPages: 4,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should pass sort options correctly', async () => {
      mockPdfRepository.findByAccountId.mockResolvedValue({
        data: [],
        total: 0,
      });

      await app.inject({
        method: 'GET',
        url: '/v1/pdfs?sortBy=completedAt&sortOrder=asc',
      });

      expect(mockPdfRepository.findByAccountId).toHaveBeenCalledWith(
        'account-123',
        expect.objectContaining({
          sortBy: 'completedAt',
          sortOrder: 'asc',
        })
      );
    });
  });

  // ==========================================================================
  // GET /v1/pdfs/:id/download - Download PDF
  // ==========================================================================
  describe('GET /v1/pdfs/:id/download', () => {
    it('should download completed PDF', async () => {
      const mockPdf = createMockPdf({
        status: 'COMPLETED',
        storageKey: 'pdfs/test/test.pdf',
      });
      mockPdfRepository.findById.mockResolvedValue(mockPdf);
      mockStorageService.download.mockResolvedValue(Buffer.from('pdf-data'));

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs/pdf-123/download',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('pdf-pdf-123.pdf');
    });

    it('should return 404 when PDF not found', async () => {
      mockPdfRepository.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs/non-existent-id/download',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('PDF_NOT_FOUND');
    });

    it('should return 400 when PDF is not completed', async () => {
      const mockPdf = createMockPdf({
        status: 'PROCESSING',
      });
      mockPdfRepository.findById.mockResolvedValue(mockPdf);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs/pdf-123/download',
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('PROCESSING_FAILED');
      expect(body.error.message).toContain('not ready yet');
    });

    it('should return 400 for pending PDF', async () => {
      const mockPdf = createMockPdf({
        status: 'PENDING',
      });
      mockPdfRepository.findById.mockResolvedValue(mockPdf);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs/pdf-123/download',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('pending');
    });

    it('should return 400 for failed PDF', async () => {
      const mockPdf = createMockPdf({
        status: 'FAILED',
      });
      mockPdfRepository.findById.mockResolvedValue(mockPdf);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pdfs/pdf-123/download',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('failed');
    });
  });

  // ==========================================================================
  // DELETE /v1/pdfs/:id - Delete PDF
  // ==========================================================================
  describe('DELETE /v1/pdfs/:id', () => {
    it('should delete PDF and return 204', async () => {
      const mockPdf = createMockPdf({
        status: 'COMPLETED',
        storageKey: 'pdfs/test/test.pdf',
      });
      mockPdfRepository.findById.mockResolvedValue(mockPdf);
      mockStorageService.delete.mockResolvedValue(undefined);
      mockPdfRepository.delete.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/pdfs/pdf-123',
      });

      expect(response.statusCode).toBe(204);
      expect(mockStorageService.delete).toHaveBeenCalledWith('pdfs/test/test.pdf');
      expect(mockPdfRepository.delete).toHaveBeenCalledWith('pdf-123');
    });

    it('should return 404 when PDF not found', async () => {
      mockPdfRepository.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/pdfs/non-existent-id',
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('PDF_NOT_FOUND');
    });

    it('should delete pending PDF without storage operation', async () => {
      const mockPdf = createMockPdf({
        status: 'PENDING',
        storageKey: null,
      });
      mockPdfRepository.findById.mockResolvedValue(mockPdf);
      mockPdfRepository.delete.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/pdfs/pdf-123',
      });

      expect(response.statusCode).toBe(204);
      expect(mockStorageService.delete).not.toHaveBeenCalled();
      expect(mockPdfRepository.delete).toHaveBeenCalled();
    });

    it('should continue with database deletion even if storage deletion fails', async () => {
      const mockPdf = createMockPdf({
        status: 'COMPLETED',
        storageKey: 'pdfs/test/test.pdf',
      });
      mockPdfRepository.findById.mockResolvedValue(mockPdf);
      mockStorageService.delete.mockRejectedValue(new Error('Storage unavailable'));
      mockPdfRepository.delete.mockResolvedValue(undefined);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/pdfs/pdf-123',
      });

      expect(response.statusCode).toBe(204);
      expect(mockPdfRepository.delete).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Route Registration Tests
  // ==========================================================================
  describe('Route Registration', () => {
    it('should register all PDF routes', async () => {
      const routes = app.printRoutes();

      expect(routes).toContain('/v1/pdfs');
      expect(routes).toContain('/v1/pdfs/:id');
      expect(routes).toContain('/v1/pdfs/:id/download');
    });

    it('should have correct content type header for JSON responses', async () => {
      mockPdfRepository.create.mockResolvedValue(createMockPdf());
      mockQueueService.addPdfJob.mockResolvedValue('job-id');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pdfs',
        payload: { ...validPdfFromUrlRequest, async: true },
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});
