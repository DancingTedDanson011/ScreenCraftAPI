import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyReply } from 'fastify';
import type { Pdf } from '@prisma/client';

// Mock data
const mockPdf: Pdf = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  accountId: 'account-123',
  status: 'PENDING',
  type: 'URL',
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
  downloadUrl: null,
  storageKey: null,
  fileSize: null,
  pages: null,
  error: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  completedAt: null,
};

const mockCompletedPdf: Pdf = {
  ...mockPdf,
  status: 'COMPLETED',
  downloadUrl: 'https://example.com/download/123',
  storageKey: 'pdfs/account-123/123.pdf',
  fileSize: 12345,
  pages: 3,
  completedAt: new Date('2024-01-01T00:01:00.000Z'),
};

const mockProcessingPdf: Pdf = {
  ...mockPdf,
  status: 'PROCESSING',
};

// Mock repository functions
const mockPdfRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByAccountId: vi.fn(),
  markAsProcessing: vi.fn(),
  markAsCompleted: vi.fn(),
  markAsFailed: vi.fn(),
  delete: vi.fn(),
};

// Mock PDF service
const mockPdfService = {
  generatePdf: vi.fn(),
};

// Mock queue service
const mockQueueService = {
  addPdfJob: vi.fn(),
};

// Mock storage service instance
const mockStorageServiceInstance = {
  generatePdfKey: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
};

// Mock the modules before importing the controller
vi.mock('../../../src/services/database/pdf.repository', () => ({
  pdfRepository: mockPdfRepository,
}));

vi.mock('../../../src/services/pdf/index.js', () => ({
  getPdfService: vi.fn(() => mockPdfService),
}));

vi.mock('../../../src/services/queue/queue.service.js', () => ({
  getQueueService: vi.fn(() => mockQueueService),
}));

// Mock StorageService as a class constructor
vi.mock('../../../src/services/storage/storage.service.js', () => ({
  StorageService: class MockStorageService {
    generatePdfKey = mockStorageServiceInstance.generatePdfKey;
    upload = mockStorageServiceInstance.upload;
    download = mockStorageServiceInstance.download;
    delete = mockStorageServiceInstance.delete;
  },
}));

// Import after mocking
const { createPdf, getPdf, listPdfs, downloadPdf, deletePdf } = await import(
  '../../../src/controllers/pdf.controller.js'
);

describe('PdfController', () => {
  let mockReply: FastifyReply;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock reply object
    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
    } as unknown as FastifyReply;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // createPdf Tests
  // ============================================================================
  describe('createPdf', () => {
    describe('Synchronous PDF Generation', () => {
      it('should create PDF synchronously with URL type', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'url',
            url: 'https://example.com',
            format: 'A4',
            async: false,
          },
        };

        const createdPdf = { ...mockPdf };
        const processingPdf = { ...mockPdf, status: 'PROCESSING' };
        const completedPdf = { ...mockCompletedPdf };

        mockPdfRepository.create.mockResolvedValue(createdPdf);
        mockPdfRepository.markAsProcessing.mockResolvedValue(processingPdf);
        mockPdfRepository.markAsCompleted.mockResolvedValue(completedPdf);
        mockPdfService.generatePdf.mockResolvedValue({
          buffer: Buffer.from('pdf-content'),
          fileSize: 12345,
          pages: 3,
          duration: 500,
        });
        mockStorageServiceInstance.generatePdfKey.mockReturnValue('pdfs/account-123/123.pdf');
        mockStorageServiceInstance.upload.mockResolvedValue(undefined);

        await createPdf(mockRequest as any, mockReply);

        expect(mockReply.code).toHaveBeenCalledWith(201);
        expect(mockReply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              id: mockPdf.id,
              status: 'completed',
              type: 'url',
            }),
          })
        );
        expect(mockPdfRepository.create).toHaveBeenCalled();
        expect(mockPdfService.generatePdf).toHaveBeenCalled();
        expect(mockStorageServiceInstance.upload).toHaveBeenCalled();
      });

      it('should create PDF synchronously with HTML type', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'html',
            html: '<html><body>Test</body></html>',
            format: 'A4',
            async: false,
          },
        };

        const createdPdf = { ...mockPdf, type: 'HTML', html: '<html><body>Test</body></html>', url: null };
        const processingPdf = { ...createdPdf, status: 'PROCESSING' };
        const completedPdf = { ...createdPdf, ...mockCompletedPdf };

        mockPdfRepository.create.mockResolvedValue(createdPdf);
        mockPdfRepository.markAsProcessing.mockResolvedValue(processingPdf);
        mockPdfRepository.markAsCompleted.mockResolvedValue(completedPdf);
        mockPdfService.generatePdf.mockResolvedValue({
          buffer: Buffer.from('pdf-content'),
          fileSize: 12345,
          pages: 1,
          duration: 300,
        });
        mockStorageServiceInstance.generatePdfKey.mockReturnValue('pdfs/account-123/123.pdf');
        mockStorageServiceInstance.upload.mockResolvedValue(undefined);

        await createPdf(mockRequest as any, mockReply);

        expect(mockReply.code).toHaveBeenCalledWith(201);
        expect(mockPdfRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'HTML',
            html: '<html><body>Test</body></html>',
          })
        );
      });

      it('should mark PDF as failed on generation error', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'url',
            url: 'https://example.com',
            format: 'A4',
            async: false,
          },
        };

        mockPdfRepository.create.mockResolvedValue({ ...mockPdf });
        mockPdfRepository.markAsProcessing.mockResolvedValue({ ...mockProcessingPdf });
        mockPdfRepository.markAsFailed.mockResolvedValue({ ...mockPdf, status: 'FAILED', error: 'Generation error' });
        mockPdfService.generatePdf.mockRejectedValue(new Error('Generation error'));

        await createPdf(mockRequest as any, mockReply);

        expect(mockPdfRepository.markAsFailed).toHaveBeenCalledWith(mockPdf.id, 'Generation error');
        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: 'PROCESSING_FAILED',
              message: 'Generation error',
            }),
          })
        );
      });
    });

    describe('Asynchronous PDF Generation', () => {
      it('should queue PDF job for async processing', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'url',
            url: 'https://example.com',
            format: 'A4',
            async: true,
          },
        };

        mockPdfRepository.create.mockResolvedValue({ ...mockPdf });
        mockQueueService.addPdfJob.mockResolvedValue('job-123');

        await createPdf(mockRequest as any, mockReply);

        expect(mockReply.code).toHaveBeenCalledWith(202);
        expect(mockReply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              id: mockPdf.id,
              status: 'pending',
            }),
          })
        );
        expect(mockQueueService.addPdfJob).toHaveBeenCalled();
        expect(mockPdfService.generatePdf).not.toHaveBeenCalled();
      });

      it('should mark PDF as failed if queue job fails', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'url',
            url: 'https://example.com',
            format: 'A4',
            async: true,
          },
        };

        mockPdfRepository.create.mockResolvedValue({ ...mockPdf });
        mockQueueService.addPdfJob.mockRejectedValue(new Error('Queue unavailable'));
        mockPdfRepository.markAsFailed.mockResolvedValue({ ...mockPdf, status: 'FAILED' });

        await createPdf(mockRequest as any, mockReply);

        expect(mockPdfRepository.markAsFailed).toHaveBeenCalledWith(mockPdf.id, 'Queue unavailable');
        // Should still return 202 as the record was created
        expect(mockReply.code).toHaveBeenCalledWith(202);
      });
    });

    describe('Validation', () => {
      it('should return 400 for invalid request data (ZodError)', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            // Missing required 'type' field
            url: 'https://example.com',
          },
        };

        await createPdf(mockRequest as any, mockReply);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
            }),
          })
        );
      });

      it('should return 400 for invalid URL format', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'url',
            url: 'not-a-valid-url',
            format: 'A4',
          },
        };

        await createPdf(mockRequest as any, mockReply);

        expect(mockReply.code).toHaveBeenCalledWith(400);
        expect(mockReply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: 'VALIDATION_ERROR',
            }),
          })
        );
      });

      it('should return 400 for empty HTML content', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'html',
            html: '',
            format: 'A4',
          },
        };

        await createPdf(mockRequest as any, mockReply);

        expect(mockReply.code).toHaveBeenCalledWith(400);
      });
    });

    describe('Authentication - AccountId Fallback Vulnerability', () => {
      /**
       * SECURITY TEST: The controller currently has a vulnerable fallback:
       * `const accountId = request.auth?.accountId || 'default';`
       *
       * This test documents the current behavior. In production, requests
       * without proper authentication should be rejected, not given a
       * default account ID.
       */
      it('should use default accountId when auth is missing (SECURITY VULNERABILITY)', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          // No auth property - simulating unauthenticated request
          body: {
            type: 'url',
            url: 'https://example.com',
            format: 'A4',
            async: true,
          },
        };

        mockPdfRepository.create.mockResolvedValue({ ...mockPdf, accountId: 'default' });
        mockQueueService.addPdfJob.mockResolvedValue('job-123');

        await createPdf(mockRequest as any, mockReply);

        // VULNERABILITY: The controller accepts requests without auth
        // and assigns them to 'default' account
        expect(mockPdfRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'default',
          })
        );
        expect(mockReply.code).toHaveBeenCalledWith(202);
      });

      it('should use default accountId when auth.accountId is undefined (SECURITY VULNERABILITY)', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: {}, // auth object exists but no accountId
          body: {
            type: 'url',
            url: 'https://example.com',
            format: 'A4',
            async: true,
          },
        };

        mockPdfRepository.create.mockResolvedValue({ ...mockPdf, accountId: 'default' });
        mockQueueService.addPdfJob.mockResolvedValue('job-123');

        await createPdf(mockRequest as any, mockReply);

        expect(mockPdfRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'default',
          })
        );
      });

      it('should use provided accountId when authenticated', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'real-account-123' },
          body: {
            type: 'url',
            url: 'https://example.com',
            format: 'A4',
            async: true,
          },
        };

        mockPdfRepository.create.mockResolvedValue({ ...mockPdf, accountId: 'real-account-123' });
        mockQueueService.addPdfJob.mockResolvedValue('job-123');

        await createPdf(mockRequest as any, mockReply);

        expect(mockPdfRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'real-account-123',
          })
        );
      });
    });

    describe('PDF Options', () => {
      it('should pass all PDF options to repository', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'url',
            url: 'https://example.com',
            format: 'Letter',
            landscape: true,
            printBackground: false,
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
            displayHeaderFooter: true,
            headerTemplate: '<div>Header</div>',
            footerTemplate: '<div>Footer</div>',
            pageRanges: '1-3',
            preferCSSPageSize: true,
            width: '210mm',
            height: '297mm',
            scale: 0.8,
            async: true,
            webhookUrl: 'https://webhook.example.com',
            metadata: { key: 'value' },
          },
        };

        mockPdfRepository.create.mockResolvedValue({ ...mockPdf });
        mockQueueService.addPdfJob.mockResolvedValue('job-123');

        await createPdf(mockRequest as any, mockReply);

        expect(mockPdfRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'LETTER',
            landscape: true,
            printBackground: false,
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
            displayHeaderFooter: true,
            headerTemplate: '<div>Header</div>',
            footerTemplate: '<div>Footer</div>',
            pageRanges: '1-3',
            preferCSSPageSize: true,
            width: '210mm',
            height: '297mm',
            scale: 0.8,
            webhookUrl: 'https://webhook.example.com',
            metadata: { key: 'value' },
          })
        );
      });

      it('should pass URL-specific options for URL type', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'url',
            url: 'https://example.com',
            format: 'A4',
            waitOptions: { waitUntil: 'networkidle0', timeout: 30000 },
            headers: { 'X-Custom': 'Header' },
            cookies: [{ name: 'session', value: 'abc123' }],
            userAgent: 'Custom User Agent',
            async: true,
          },
        };

        mockPdfRepository.create.mockResolvedValue({ ...mockPdf });
        mockQueueService.addPdfJob.mockResolvedValue('job-123');

        await createPdf(mockRequest as any, mockReply);

        expect(mockPdfRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            waitOptions: { waitUntil: 'networkidle0', timeout: 30000 },
            headers: { 'X-Custom': 'Header' },
            cookies: [{ name: 'session', value: 'abc123' }],
            userAgent: 'Custom User Agent',
          })
        );
      });

      it('should NOT pass URL-specific options for HTML type async', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'html',
            html: '<html><body>Test</body></html>',
            format: 'A4',
            async: true,
          },
        };

        mockPdfRepository.create.mockResolvedValue({ ...mockPdf, type: 'HTML' });
        mockQueueService.addPdfJob.mockResolvedValue('job-123');

        await createPdf(mockRequest as any, mockReply);

        expect(mockPdfRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'HTML',
            html: '<html><body>Test</body></html>',
            url: undefined,
            waitOptions: undefined,
            headers: undefined,
            cookies: undefined,
            userAgent: undefined,
          })
        );
      });

      it('should NOT pass URL-specific options for HTML type sync', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'html',
            html: '<html><body>Test Content</body></html>',
            format: 'A4',
            async: false,
          },
        };

        const createdPdf = { ...mockPdf, type: 'HTML', html: '<html><body>Test Content</body></html>', url: null };
        const processingPdf = { ...createdPdf, status: 'PROCESSING' };
        const completedPdf = { ...createdPdf, ...mockCompletedPdf };

        mockPdfRepository.create.mockResolvedValue(createdPdf);
        mockPdfRepository.markAsProcessing.mockResolvedValue(processingPdf);
        mockPdfRepository.markAsCompleted.mockResolvedValue(completedPdf);
        mockPdfService.generatePdf.mockResolvedValue({
          buffer: Buffer.from('pdf-content'),
          fileSize: 12345,
          pages: 1,
          duration: 300,
        });
        mockStorageServiceInstance.generatePdfKey.mockReturnValue('pdfs/account-123/123.pdf');
        mockStorageServiceInstance.upload.mockResolvedValue(undefined);

        await createPdf(mockRequest as any, mockReply);

        expect(mockPdfRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'HTML',
            html: '<html><body>Test Content</body></html>',
            url: undefined,
            waitOptions: undefined,
            headers: undefined,
            cookies: undefined,
            userAgent: undefined,
          })
        );
      });
    });

    describe('Error Handling Edge Cases', () => {
      it('should handle non-Error thrown from queue service', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'url',
            url: 'https://example.com',
            format: 'A4',
            async: true,
          },
        };

        mockPdfRepository.create.mockResolvedValue({ ...mockPdf });
        mockQueueService.addPdfJob.mockRejectedValue('String error instead of Error object');
        mockPdfRepository.markAsFailed.mockResolvedValue({ ...mockPdf, status: 'FAILED' });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await createPdf(mockRequest as any, mockReply);

        // Should use default error message when thrown value is not an Error
        expect(mockPdfRepository.markAsFailed).toHaveBeenCalledWith(mockPdf.id, 'Failed to queue job');

        consoleErrorSpy.mockRestore();
      });

      it('should handle non-Error thrown from PDF generation', async () => {
        const mockRequest = {
          id: 'req-123',
          protocol: 'https',
          hostname: 'api.example.com',
          auth: { accountId: 'account-123' },
          body: {
            type: 'url',
            url: 'https://example.com',
            format: 'A4',
            async: false,
          },
        };

        mockPdfRepository.create.mockResolvedValue({ ...mockPdf });
        mockPdfRepository.markAsProcessing.mockResolvedValue({ ...mockProcessingPdf });
        mockPdfRepository.markAsFailed.mockResolvedValue({ ...mockPdf, status: 'FAILED' });
        mockPdfService.generatePdf.mockRejectedValue('Non-error rejection');

        await createPdf(mockRequest as any, mockReply);

        expect(mockPdfRepository.markAsFailed).toHaveBeenCalledWith(mockPdf.id, 'Unknown error');
        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: 'PROCESSING_FAILED',
              message: 'Failed to create PDF',
            }),
          })
        );
      });
    });
  });

  // ============================================================================
  // getPdf Tests
  // ============================================================================
  describe('getPdf', () => {
    it('should return PDF when found', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({ ...mockCompletedPdf });

      await getPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: mockPdf.id,
            status: 'completed',
            type: 'url',
            format: 'A4',
            fileSize: 12345,
            pages: 3,
          }),
        })
      );
    });

    it('should return 404 when PDF not found', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: 'non-existent-id' },
      };

      mockPdfRepository.findById.mockResolvedValue(null);

      await getPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'PDF_NOT_FOUND',
            message: 'PDF with ID non-existent-id not found',
          }),
        })
      );
    });

    it('should return 500 on database error', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockPdf.id },
      };

      mockPdfRepository.findById.mockRejectedValue(new Error('Database connection error'));

      await getPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection error',
          }),
        })
      );
    });

    it('should convert response fields correctly', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockPdf.id },
      };

      const pdfWithMetadata: Pdf = {
        ...mockCompletedPdf,
        metadata: { customKey: 'customValue' },
        error: 'Some error message',
      };

      mockPdfRepository.findById.mockResolvedValue(pdfWithMetadata);

      await getPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            metadata: { customKey: 'customValue' },
            error: 'Some error message',
          }),
        })
      );
    });
  });

  // ============================================================================
  // listPdfs Tests
  // ============================================================================
  describe('listPdfs', () => {
    it('should return paginated list of PDFs', async () => {
      const mockRequest = {
        id: 'req-123',
        auth: { accountId: 'account-123' },
        query: {
          page: 1,
          limit: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      };

      const pdfList = [mockPdf, { ...mockPdf, id: 'pdf-2' }];
      mockPdfRepository.findByAccountId.mockResolvedValue({
        data: pdfList,
        total: 2,
      });

      await listPdfs(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ id: mockPdf.id }),
          ]),
          meta: expect.objectContaining({
            pagination: expect.objectContaining({
              page: 1,
              limit: 20,
              total: 2,
              totalPages: 1,
              hasNext: false,
              hasPrev: false,
            }),
          }),
        })
      );
    });

    it('should filter by status', async () => {
      const mockRequest = {
        id: 'req-123',
        auth: { accountId: 'account-123' },
        query: {
          page: 1,
          limit: 20,
          status: 'completed',
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      };

      mockPdfRepository.findByAccountId.mockResolvedValue({
        data: [mockCompletedPdf],
        total: 1,
      });

      await listPdfs(mockRequest as any, mockReply);

      expect(mockPdfRepository.findByAccountId).toHaveBeenCalledWith(
        'account-123',
        expect.objectContaining({
          status: 'COMPLETED',
        })
      );
    });

    it('should filter by type', async () => {
      const mockRequest = {
        id: 'req-123',
        auth: { accountId: 'account-123' },
        query: {
          page: 1,
          limit: 20,
          type: 'html',
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      };

      mockPdfRepository.findByAccountId.mockResolvedValue({
        data: [],
        total: 0,
      });

      await listPdfs(mockRequest as any, mockReply);

      expect(mockPdfRepository.findByAccountId).toHaveBeenCalledWith(
        'account-123',
        expect.objectContaining({
          type: 'HTML',
        })
      );
    });

    it('should calculate pagination correctly for multiple pages', async () => {
      const mockRequest = {
        id: 'req-123',
        auth: { accountId: 'account-123' },
        query: {
          page: 2,
          limit: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      };

      mockPdfRepository.findByAccountId.mockResolvedValue({
        data: Array(10).fill(mockPdf),
        total: 45, // Total of 45 items, page 2 of 5
      });

      await listPdfs(mockRequest as any, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            pagination: expect.objectContaining({
              page: 2,
              limit: 10,
              total: 45,
              totalPages: 5,
              hasNext: true,
              hasPrev: true,
            }),
          }),
        })
      );
    });

    it('should use default accountId when auth is missing (SECURITY VULNERABILITY)', async () => {
      const mockRequest = {
        id: 'req-123',
        // No auth
        query: {
          page: 1,
          limit: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      };

      mockPdfRepository.findByAccountId.mockResolvedValue({
        data: [],
        total: 0,
      });

      await listPdfs(mockRequest as any, mockReply);

      // VULNERABILITY: Uses 'default' accountId for unauthenticated requests
      expect(mockPdfRepository.findByAccountId).toHaveBeenCalledWith(
        'default',
        expect.any(Object)
      );
    });

    it('should return 500 on database error', async () => {
      const mockRequest = {
        id: 'req-123',
        auth: { accountId: 'account-123' },
        query: {
          page: 1,
          limit: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      };

      mockPdfRepository.findByAccountId.mockRejectedValue(new Error('Database timeout'));

      await listPdfs(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database timeout',
          }),
        })
      );
    });

    it('should handle non-Error thrown objects in listPdfs', async () => {
      const mockRequest = {
        id: 'req-123',
        auth: { accountId: 'account-123' },
        query: {
          page: 1,
          limit: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      };

      mockPdfRepository.findByAccountId.mockRejectedValue('Non-Error thrown object');

      await listPdfs(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
          }),
        })
      );
    });
  });

  // ============================================================================
  // downloadPdf Tests
  // ============================================================================
  describe('downloadPdf', () => {
    it('should download completed PDF successfully', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockCompletedPdf.id },
      };

      const pdfBuffer = Buffer.from('pdf-content');
      mockPdfRepository.findById.mockResolvedValue({ ...mockCompletedPdf });
      mockStorageServiceInstance.download.mockResolvedValue(pdfBuffer);

      await downloadPdf(mockRequest as any, mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="document-${mockCompletedPdf.id}.pdf"`
      );
      expect(mockReply.header).toHaveBeenCalledWith('Content-Length', pdfBuffer.length.toString());
      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(pdfBuffer);
    });

    it('should return 404 when PDF not found', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: 'non-existent-id' },
      };

      mockPdfRepository.findById.mockResolvedValue(null);

      await downloadPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'PDF_NOT_FOUND',
          }),
        })
      );
    });

    it('should return 400 when PDF is not completed (pending)', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({ ...mockPdf, status: 'PENDING' });

      await downloadPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'PROCESSING_FAILED',
            message: 'PDF is not ready yet. Current status: pending',
          }),
        })
      );
    });

    it('should return 400 when PDF is processing', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({ ...mockProcessingPdf });

      await downloadPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'PDF is not ready yet. Current status: processing',
          }),
        })
      );
    });

    it('should return 400 when PDF failed', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({ ...mockPdf, status: 'FAILED' });

      await downloadPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'PDF is not ready yet. Current status: failed',
          }),
        })
      );
    });

    it('should return 500 when storageKey is missing', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({
        ...mockCompletedPdf,
        storageKey: null,
      });

      await downloadPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'PDF file not found in storage',
          }),
        })
      );
    });

    it('should return 500 on storage download error', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockCompletedPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({ ...mockCompletedPdf });
      mockStorageServiceInstance.download.mockRejectedValue(new Error('Storage unavailable'));

      await downloadPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Storage unavailable',
          }),
        })
      );
    });

    it('should handle non-Error thrown objects in downloadPdf', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockCompletedPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({ ...mockCompletedPdf });
      mockStorageServiceInstance.download.mockRejectedValue('Non-Error thrown');

      await downloadPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
          }),
        })
      );
    });
  });

  // ============================================================================
  // deletePdf Tests
  // ============================================================================
  describe('deletePdf', () => {
    it('should delete completed PDF and storage file', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockCompletedPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({ ...mockCompletedPdf });
      mockStorageServiceInstance.delete.mockResolvedValue(undefined);
      mockPdfRepository.delete.mockResolvedValue(undefined);

      await deletePdf(mockRequest as any, mockReply);

      expect(mockStorageServiceInstance.delete).toHaveBeenCalledWith(mockCompletedPdf.storageKey);
      expect(mockPdfRepository.delete).toHaveBeenCalledWith(mockCompletedPdf.id);
      expect(mockReply.code).toHaveBeenCalledWith(204);
      expect(mockReply.send).toHaveBeenCalled();
    });

    it('should delete pending PDF without storage deletion', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({ ...mockPdf });
      mockPdfRepository.delete.mockResolvedValue(undefined);

      await deletePdf(mockRequest as any, mockReply);

      expect(mockStorageServiceInstance.delete).not.toHaveBeenCalled();
      expect(mockPdfRepository.delete).toHaveBeenCalledWith(mockPdf.id);
      expect(mockReply.code).toHaveBeenCalledWith(204);
    });

    it('should delete completed PDF without storageKey', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({
        ...mockCompletedPdf,
        storageKey: null,
      });
      mockPdfRepository.delete.mockResolvedValue(undefined);

      await deletePdf(mockRequest as any, mockReply);

      expect(mockStorageServiceInstance.delete).not.toHaveBeenCalled();
      expect(mockPdfRepository.delete).toHaveBeenCalledWith(mockCompletedPdf.id);
      expect(mockReply.code).toHaveBeenCalledWith(204);
    });

    it('should return 404 when PDF not found', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: 'non-existent-id' },
      };

      mockPdfRepository.findById.mockResolvedValue(null);

      await deletePdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'PDF_NOT_FOUND',
            message: 'PDF with ID non-existent-id not found',
          }),
        })
      );
      expect(mockPdfRepository.delete).not.toHaveBeenCalled();
    });

    it('should continue with database deletion even if storage deletion fails', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockCompletedPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({ ...mockCompletedPdf });
      mockStorageServiceInstance.delete.mockRejectedValue(new Error('Storage error'));
      mockPdfRepository.delete.mockResolvedValue(undefined);

      // Spy on console.error to verify error is logged
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await deletePdf(mockRequest as any, mockReply);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockPdfRepository.delete).toHaveBeenCalledWith(mockCompletedPdf.id);
      expect(mockReply.code).toHaveBeenCalledWith(204);

      consoleErrorSpy.mockRestore();
    });

    it('should return 500 on database deletion error', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockCompletedPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({ ...mockCompletedPdf });
      mockStorageServiceInstance.delete.mockResolvedValue(undefined);
      mockPdfRepository.delete.mockRejectedValue(new Error('Database constraint violation'));

      await deletePdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database constraint violation',
          }),
        })
      );
    });

    it('should handle non-Error thrown objects in deletePdf', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: mockCompletedPdf.id },
      };

      mockPdfRepository.findById.mockResolvedValue({ ...mockCompletedPdf });
      mockStorageServiceInstance.delete.mockResolvedValue(undefined);
      mockPdfRepository.delete.mockRejectedValue({ custom: 'error object' });

      await deletePdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
          }),
        })
      );
    });
  });

  // ============================================================================
  // Response Format Tests
  // ============================================================================
  describe('Response Format (toPdfResponse helper)', () => {
    it('should correctly convert all PDF status values to lowercase', async () => {
      const statuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;

      for (const status of statuses) {
        mockPdfRepository.findById.mockResolvedValue({ ...mockPdf, status });

        await getPdf({ id: 'req-123', params: { id: mockPdf.id } } as any, mockReply);

        expect(mockReply.send).toHaveBeenLastCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: status.toLowerCase(),
            }),
          })
        );
      }
    });

    it('should correctly convert PDF type values to lowercase', async () => {
      const types = ['URL', 'HTML'] as const;

      for (const type of types) {
        mockPdfRepository.findById.mockResolvedValue({ ...mockPdf, type });

        await getPdf({ id: 'req-123', params: { id: mockPdf.id } } as any, mockReply);

        expect(mockReply.send).toHaveBeenLastCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type: type.toLowerCase(),
            }),
          })
        );
      }
    });

    it('should omit undefined optional fields from response', async () => {
      mockPdfRepository.findById.mockResolvedValue({ ...mockPdf });

      await getPdf({ id: 'req-123', params: { id: mockPdf.id } } as any, mockReply);

      const sendCall = (mockReply.send as any).mock.calls[0][0];

      // These fields should be undefined (not present or undefined value)
      expect(sendCall.data.fileSize).toBeUndefined();
      expect(sendCall.data.pages).toBeUndefined();
      expect(sendCall.data.downloadUrl).toBeUndefined();
      expect(sendCall.data.error).toBeUndefined();
      expect(sendCall.data.completedAt).toBeUndefined();
    });

    it('should include all defined optional fields in response', async () => {
      const fullPdf: Pdf = {
        ...mockCompletedPdf,
        metadata: { key: 'value' },
        error: null,
      };

      mockPdfRepository.findById.mockResolvedValue(fullPdf);

      await getPdf({ id: 'req-123', params: { id: mockPdf.id } } as any, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: fullPdf.id,
            status: 'completed',
            type: 'url',
            format: 'A4',
            fileSize: 12345,
            pages: 3,
            downloadUrl: fullPdf.downloadUrl,
            metadata: { key: 'value' },
            createdAt: fullPdf.createdAt,
            completedAt: fullPdf.completedAt,
          }),
        })
      );
    });
  });

  // ============================================================================
  // Response Meta Tests
  // ============================================================================
  describe('Response Metadata', () => {
    it('should include correct meta in all responses', async () => {
      mockPdfRepository.findById.mockResolvedValue({ ...mockPdf });

      await getPdf({ id: 'req-123', params: { id: mockPdf.id } } as any, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            requestId: 'req-123',
            version: 'v1',
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it('should include pagination meta in list responses', async () => {
      const mockRequest = {
        id: 'req-123',
        auth: { accountId: 'account-123' },
        query: {
          page: 1,
          limit: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      };

      mockPdfRepository.findByAccountId.mockResolvedValue({
        data: [mockPdf],
        total: 1,
      });

      await listPdfs(mockRequest as any, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            pagination: expect.objectContaining({
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
              hasNext: false,
              hasPrev: false,
            }),
          }),
        })
      );
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle null metadata in PDF record', async () => {
      mockPdfRepository.findById.mockResolvedValue({ ...mockPdf, metadata: null });

      await getPdf({ id: 'req-123', params: { id: mockPdf.id } } as any, mockReply);

      const sendCall = (mockReply.send as any).mock.calls[0][0];
      expect(sendCall.data.metadata).toBeUndefined();
    });

    it('should handle empty object metadata in PDF record', async () => {
      mockPdfRepository.findById.mockResolvedValue({ ...mockPdf, metadata: {} });

      await getPdf({ id: 'req-123', params: { id: mockPdf.id } } as any, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {},
          }),
        })
      );
    });

    it('should handle non-Error thrown objects in catch blocks', async () => {
      mockPdfRepository.findById.mockRejectedValue('String error message');

      await getPdf({ id: 'req-123', params: { id: mockPdf.id } } as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Internal server error',
          }),
        })
      );
    });

    it('should handle request with empty params', async () => {
      const mockRequest = {
        id: 'req-123',
        params: { id: '' },
      };

      mockPdfRepository.findById.mockResolvedValue(null);

      await getPdf(mockRequest as any, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
    });

    it('should handle very large file size values', async () => {
      const largePdf: Pdf = {
        ...mockCompletedPdf,
        fileSize: Number.MAX_SAFE_INTEGER,
      };

      mockPdfRepository.findById.mockResolvedValue(largePdf);

      await getPdf({ id: 'req-123', params: { id: mockPdf.id } } as any, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fileSize: Number.MAX_SAFE_INTEGER,
          }),
        })
      );
    });
  });
});
