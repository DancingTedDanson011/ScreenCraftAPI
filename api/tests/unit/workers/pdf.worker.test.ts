import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Job } from 'bullmq';
import type { Page, BrowserContext, Route, Request } from 'playwright-core';

// Mock types for job data
interface MockPdfJobData {
  url: string;
  options: {
    format?: string;
    landscape?: boolean;
    printBackground?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    preferCSSPageSize?: boolean;
    viewport?: { width: number; height: number };
    userAgent?: string;
    headers?: Record<string, string>;
    cookies?: Array<{ name: string; value: string; domain: string }>;
    blockResources?: string[];
    waitOptions?: {
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
      timeout?: number;
      delay?: number;
      selector?: string;
    };
  };
  jobId: string;
  userId?: string;
}

interface MockJobResult {
  success: boolean;
  downloadUrl?: string;
  error?: string;
  fileSize?: number;
  metadata?: Record<string, any>;
}

// Use vi.hoisted() to ensure mock functions are available when vi.mock runs
const mocks = vi.hoisted(() => {
  let _capturedProcessor: any = null;
  const mockWorkerOn = vi.fn();
  const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
  const mockStorageInitialize = vi.fn().mockResolvedValue(undefined);
  const mockStorageUpload = vi.fn().mockResolvedValue(undefined);
  const mockStorageGetSignedUrl = vi.fn().mockResolvedValue('https://storage.example.com/signed-pdf-url');
  const mockStorageGeneratePdfKey = vi.fn().mockReturnValue('pdfs/system/test-job.pdf');
  const mockBrowserPoolAcquirePage = vi.fn();
  const mockBrowserPoolReleaseContext = vi.fn().mockResolvedValue(undefined);

  return {
    mockWorkerOn,
    mockWorkerClose,
    mockStorageInitialize,
    mockStorageUpload,
    mockStorageGetSignedUrl,
    mockStorageGeneratePdfKey,
    mockBrowserPoolAcquirePage,
    mockBrowserPoolReleaseContext,
    getCapturedProcessor: () => _capturedProcessor,
    setCapturedProcessor: (p: any) => { _capturedProcessor = p; },
  };
});

// Destructure for convenience
const {
  mockWorkerOn,
  mockWorkerClose,
  mockStorageInitialize,
  mockStorageUpload,
  mockStorageGetSignedUrl,
  mockStorageGeneratePdfKey,
  mockBrowserPoolAcquirePage,
  mockBrowserPoolReleaseContext,
  getCapturedProcessor,
  setCapturedProcessor,
} = mocks;

// For backwards compatibility in tests
let capturedProcessor: ((job: Job<MockPdfJobData, MockJobResult>) => Promise<MockJobResult>) | null = null;

// Mock BullMQ with a proper class constructor
vi.mock('bullmq', () => {
  // Create a class that can be instantiated with 'new'
  const MockWorker = function(this: any, queueName: string, processor: any, options: any) {
    mocks.setCapturedProcessor(processor);
    this.on = mocks.mockWorkerOn;
    this.close = mocks.mockWorkerClose;
  } as any;

  // Make it behave like a class
  MockWorker.prototype = {
    on: mocks.mockWorkerOn,
    close: mocks.mockWorkerClose,
  };

  return {
    Worker: MockWorker,
    Job: vi.fn(),
  };
});

// Mock queue config
vi.mock('../../../../src/services/queue/queue.config.js', () => ({
  QUEUE_NAMES: {
    SCREENSHOT: 'screenshot',
    PDF: 'pdf',
  },
  workerOptions: {
    concurrency: 3,
  },
}));

// Mock browser pool
vi.mock('../../../../src/services/browser-pool/browser-pool.service.js', () => ({
  getBrowserPool: vi.fn(() => ({
    acquirePage: mocks.mockBrowserPoolAcquirePage,
    releaseContext: mocks.mockBrowserPoolReleaseContext,
  })),
}));

// Mock storage service
vi.mock('../../../../src/services/storage/storage.service.js', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    initialize: mocks.mockStorageInitialize,
    upload: mocks.mockStorageUpload,
    getSignedUrl: mocks.mockStorageGetSignedUrl,
    generatePdfKey: mocks.mockStorageGeneratePdfKey,
  })),
}));

// Mock queues types
vi.mock('../../../../src/services/queue/queues.js', () => ({
  pdfQueue: { name: 'pdf' },
}));

// Import after mocks
import { PdfWorker, createPdfWorker } from '../../../../src/services/queue/pdf.worker.js';

describe('PdfWorker', () => {
  let worker: PdfWorker;
  let mockPage: Partial<Page>;
  let mockContext: Partial<BrowserContext>;
  let mockRoute: Partial<Route>;
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    vi.clearAllMocks();
    setCapturedProcessor(null);

    // Setup mock request for route
    mockRequest = {
      resourceType: vi.fn().mockReturnValue('document'),
    };

    // Setup mock route
    mockRoute = {
      request: vi.fn().mockReturnValue(mockRequest),
      abort: vi.fn().mockResolvedValue(undefined),
      continue: vi.fn().mockResolvedValue(undefined),
    };

    // Setup mock context
    mockContext = {
      addCookies: vi.fn().mockResolvedValue(undefined),
    };

    // Setup mock page
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-data')),
      setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
      context: vi.fn().mockReturnValue(mockContext),
      route: vi.fn().mockImplementation(async (pattern, handler) => {
        (mockPage as any)._routeHandler = handler;
      }),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
    };

    // Setup browser pool mock
    mockBrowserPoolAcquirePage.mockResolvedValue({
      page: mockPage,
      contextId: 'test-context-id',
    });

    // Create worker instance
    worker = new PdfWorker();

    // Sync capturedProcessor for backwards compatibility
    capturedProcessor = getCapturedProcessor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create a Worker with correct queue name', () => {
      const { Worker } = require('bullmq');
      expect(Worker).toHaveBeenCalledWith(
        'pdf',
        expect.any(Function),
        expect.objectContaining({
          concurrency: 3,
        })
      );
    });

    it('should setup event handlers', () => {
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('stalled', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('active', expect.any(Function));
    });

    it('should initialize storage', () => {
      expect(mockStorageInitialize).toHaveBeenCalled();
    });
  });

  describe('processJob', () => {
    const createMockJob = (data: Partial<MockPdfJobData> = {}): Job<MockPdfJobData, MockJobResult> => ({
      id: 'test-pdf-job-id',
      data: {
        url: 'https://example.com/document',
        options: {
          format: 'A4',
          landscape: false,
        },
        jobId: 'test-pdf-job-id',
        ...data,
      } as MockPdfJobData,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<MockPdfJobData, MockJobResult>);

    it('should successfully process a basic PDF job', async () => {
      const mockJob = createMockJob();
      expect(capturedProcessor).not.toBeNull();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toBe('https://storage.example.com/signed-pdf-url');
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.url).toBe('https://example.com/document');
    });

    it('should update progress throughout the job', async () => {
      const mockJob = createMockJob();

      await capturedProcessor!(mockJob);

      expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(30);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(60);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(80);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(90);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should acquire and release browser context', async () => {
      const mockJob = createMockJob({
        options: {
          viewport: { width: 1920, height: 1080 },
          userAgent: 'PDF Generator Bot',
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockBrowserPoolAcquirePage).toHaveBeenCalledWith({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'PDF Generator Bot',
      });
      expect(mockBrowserPoolReleaseContext).toHaveBeenCalledWith('test-context-id');
    });

    it('should set custom headers when provided', async () => {
      const mockJob = createMockJob({
        options: {
          headers: { 'X-PDF-Header': 'test-value', 'Accept-Language': 'en-US' },
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'X-PDF-Header': 'test-value',
        'Accept-Language': 'en-US',
      });
    });

    it('should set cookies when provided', async () => {
      const cookies = [
        { name: 'auth_token', value: 'secret123', domain: 'example.com' },
      ];
      const mockJob = createMockJob({
        options: { cookies },
      });

      await capturedProcessor!(mockJob);

      expect(mockContext.addCookies).toHaveBeenCalledWith(cookies);
    });

    it('should setup resource blocking when blockResources is provided', async () => {
      const mockJob = createMockJob({
        options: {
          blockResources: ['image', 'media'],
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.route).toHaveBeenCalledWith('**/*', expect.any(Function));
    });

    it('should navigate with custom wait options', async () => {
      const mockJob = createMockJob({
        options: {
          waitOptions: {
            waitUntil: 'networkidle',
            timeout: 45000,
          },
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/document', {
        waitUntil: 'networkidle',
        timeout: 45000,
      });
    });

    it('should wait for delay when specified', async () => {
      const mockJob = createMockJob({
        options: {
          waitOptions: {
            delay: 3000,
          },
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(3000);
    });

    it('should wait for selector when specified', async () => {
      const mockJob = createMockJob({
        options: {
          waitOptions: {
            selector: '.document-ready',
            timeout: 15000,
          },
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.document-ready', {
        timeout: 15000,
      });
    });

    it('should generate PDF with A4 format', async () => {
      const mockJob = createMockJob({
        options: {
          format: 'A4',
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'A4',
        })
      );
    });

    it('should generate PDF with Letter format', async () => {
      const mockJob = createMockJob({
        options: {
          format: 'Letter',
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'Letter',
        })
      );
    });

    it('should generate PDF in landscape mode', async () => {
      const mockJob = createMockJob({
        options: {
          landscape: true,
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          landscape: true,
        })
      );
    });

    it('should generate PDF with custom margins', async () => {
      const margin = {
        top: '2cm',
        right: '2cm',
        bottom: '2cm',
        left: '2cm',
      };
      const mockJob = createMockJob({
        options: { margin },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          margin,
        })
      );
    });

    it('should generate PDF with printBackground enabled', async () => {
      const mockJob = createMockJob({
        options: {
          printBackground: true,
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          printBackground: true,
        })
      );
    });

    it('should generate PDF with printBackground disabled', async () => {
      const mockJob = createMockJob({
        options: {
          printBackground: false,
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          printBackground: false,
        })
      );
    });

    it('should generate PDF with header and footer', async () => {
      const mockJob = createMockJob({
        options: {
          displayHeaderFooter: true,
          headerTemplate: '<div>Header</div>',
          footerTemplate: '<div>Page <span class="pageNumber"></span></div>',
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          displayHeaderFooter: true,
          headerTemplate: '<div>Header</div>',
          footerTemplate: '<div>Page <span class="pageNumber"></span></div>',
        })
      );
    });

    it('should generate PDF with preferCSSPageSize', async () => {
      const mockJob = createMockJob({
        options: {
          preferCSSPageSize: true,
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          preferCSSPageSize: true,
        })
      );
    });

    it('should upload PDF to storage', async () => {
      const mockJob = createMockJob({
        jobId: 'upload-test-pdf-job',
      });

      await capturedProcessor!(mockJob);

      expect(mockStorageGeneratePdfKey).toHaveBeenCalledWith(
        'system',
        'upload-test-pdf-job.pdf'
      );
      expect(mockStorageUpload).toHaveBeenCalledWith(
        'pdfs/system/test-job.pdf',
        expect.any(Buffer),
        'application/pdf',
        expect.objectContaining({
          jobId: 'upload-test-pdf-job',
        })
      );
    });

    it('should generate signed URL for download', async () => {
      const mockJob = createMockJob();

      await capturedProcessor!(mockJob);

      expect(mockStorageGetSignedUrl).toHaveBeenCalledWith(
        'pdfs/system/test-job.pdf',
        60 * 60 * 24 * 7 // 7 days
      );
    });

    it('should return metadata with format and landscape', async () => {
      const mockJob = createMockJob({
        url: 'https://test.example.com/report',
        options: {
          format: 'Legal',
          landscape: true,
        },
      });

      const result = await capturedProcessor!(mockJob);

      expect(result.metadata).toMatchObject({
        url: 'https://test.example.com/report',
        format: 'Legal',
        landscape: true,
      });
      expect(result.metadata?.timestamp).toBeDefined();
    });
  });

  describe('Default Options', () => {
    const createMockJob = (options: Partial<MockPdfJobData['options']> = {}): Job<MockPdfJobData, MockJobResult> => ({
      id: 'default-test',
      data: {
        url: 'https://example.com',
        options,
        jobId: 'default-test',
      } as MockPdfJobData,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<MockPdfJobData, MockJobResult>);

    it('should use default format A4 when not specified', async () => {
      const mockJob = createMockJob({});

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'A4',
        })
      );
    });

    it('should use default printBackground true when not specified', async () => {
      const mockJob = createMockJob({});

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          printBackground: true,
        })
      );
    });

    it('should use default margin of 1cm when not specified', async () => {
      const mockJob = createMockJob({});

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          margin: {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm',
          },
        })
      );
    });

    it('should use displayHeaderFooter false by default', async () => {
      const mockJob = createMockJob({});

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          displayHeaderFooter: false,
        })
      );
    });

    it('should use empty headerTemplate by default', async () => {
      const mockJob = createMockJob({});

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          headerTemplate: '',
        })
      );
    });

    it('should use empty footerTemplate by default', async () => {
      const mockJob = createMockJob({});

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          footerTemplate: '',
        })
      );
    });

    it('should use landscape false by default', async () => {
      const mockJob = createMockJob({});

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          landscape: false,
        })
      );
    });

    it('should use preferCSSPageSize false by default', async () => {
      const mockJob = createMockJob({});

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          preferCSSPageSize: false,
        })
      );
    });

    it('should use waitUntil "load" by default', async () => {
      const mockJob = createMockJob({});

      await capturedProcessor!(mockJob);

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'load',
        timeout: 30000,
      });
    });

    it('should use timeout 30000ms by default', async () => {
      const mockJob = createMockJob({
        waitOptions: {
          waitUntil: 'domcontentloaded',
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    });
  });

  describe('Error Handling', () => {
    const createMockJob = (data: Partial<MockPdfJobData> = {}): Job<MockPdfJobData, MockJobResult> => ({
      id: 'error-test-job',
      data: {
        url: 'https://example.com',
        options: { format: 'A4' },
        jobId: 'error-test-job',
        ...data,
      } as MockPdfJobData,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<MockPdfJobData, MockJobResult>);

    it('should return error result when navigation fails', async () => {
      mockPage.goto = vi.fn().mockRejectedValue(new Error('Page not found'));
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Page not found');
      expect(result.metadata?.url).toBe('https://example.com');
      expect(result.metadata?.timestamp).toBeDefined();
    });

    it('should return error result when PDF generation fails', async () => {
      mockPage.pdf = vi.fn().mockRejectedValue(new Error('PDF generation error'));
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('PDF generation error');
    });

    it('should release context even on error', async () => {
      mockPage.goto = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const mockJob = createMockJob();

      await capturedProcessor!(mockJob);

      expect(mockBrowserPoolReleaseContext).toHaveBeenCalledWith('test-context-id');
    });

    it('should handle browser pool acquisition failure', async () => {
      mockBrowserPoolAcquirePage.mockRejectedValue(new Error('All browsers busy'));
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('All browsers busy');
    });

    it('should handle storage upload failure', async () => {
      mockStorageUpload.mockRejectedValue(new Error('Disk full'));
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to upload PDF');
    });

    it('should handle signed URL generation failure', async () => {
      mockStorageGetSignedUrl.mockRejectedValue(new Error('Signing failed'));
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to upload PDF');
    });

    it('should handle non-Error thrown objects', async () => {
      mockPage.goto = vi.fn().mockRejectedValue({ status: 500 });
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should handle waitForSelector timeout', async () => {
      mockPage.waitForSelector = vi.fn().mockRejectedValue(new Error('Selector timeout'));
      const mockJob = createMockJob({
        options: {
          waitOptions: { selector: '#document-loaded' },
        },
      });

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Selector timeout');
    });

    it('should handle header setting failure', async () => {
      mockPage.setExtraHTTPHeaders = vi.fn().mockRejectedValue(new Error('Header error'));
      const mockJob = createMockJob({
        options: {
          headers: { 'Bad-Header': 'value' },
        },
      });

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Header error');
    });

    it('should handle cookie setting failure', async () => {
      mockContext.addCookies = vi.fn().mockRejectedValue(new Error('Cookie error'));
      const mockJob = createMockJob({
        options: {
          cookies: [{ name: 'invalid', value: '', domain: '' }],
        },
      });

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cookie error');
    });
  });

  describe('Resource Blocking', () => {
    it('should block specified resource types', async () => {
      const blockResources = ['image', 'font', 'media'];
      const mockJob = {
        id: 'block-test',
        data: {
          url: 'https://example.com',
          options: { blockResources },
          jobId: 'block-test',
        },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job<MockPdfJobData, MockJobResult>;

      let routeHandler: ((route: Route) => void) | null = null;
      mockPage.route = vi.fn().mockImplementation(async (pattern, handler) => {
        routeHandler = handler;
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.route).toHaveBeenCalledWith('**/*', expect.any(Function));

      // Test that images get blocked
      const imageRequest = { resourceType: () => 'image' };
      const imageRoute = {
        request: () => imageRequest,
        abort: vi.fn(),
        continue: vi.fn(),
      };
      routeHandler!(imageRoute as unknown as Route);
      expect(imageRoute.abort).toHaveBeenCalled();

      // Test that fonts get blocked
      const fontRequest = { resourceType: () => 'font' };
      const fontRoute = {
        request: () => fontRequest,
        abort: vi.fn(),
        continue: vi.fn(),
      };
      routeHandler!(fontRoute as unknown as Route);
      expect(fontRoute.abort).toHaveBeenCalled();

      // Test that documents pass through
      const docRequest = { resourceType: () => 'document' };
      const docRoute = {
        request: () => docRequest,
        abort: vi.fn(),
        continue: vi.fn(),
      };
      routeHandler!(docRoute as unknown as Route);
      expect(docRoute.continue).toHaveBeenCalled();
    });

    it('should not setup blocking if blockResources is empty', async () => {
      const mockJob = {
        id: 'no-block-test',
        data: {
          url: 'https://example.com',
          options: { blockResources: [] },
          jobId: 'no-block-test',
        },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job<MockPdfJobData, MockJobResult>;

      await capturedProcessor!(mockJob);

      expect(mockPage.route).not.toHaveBeenCalled();
    });

    it('should not setup blocking if blockResources is undefined', async () => {
      const mockJob = {
        id: 'undefined-block-test',
        data: {
          url: 'https://example.com',
          options: {},
          jobId: 'undefined-block-test',
        },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job<MockPdfJobData, MockJobResult>;

      await capturedProcessor!(mockJob);

      expect(mockPage.route).not.toHaveBeenCalled();
    });
  });

  describe('Worker Methods', () => {
    it('should return worker instance via getWorker()', () => {
      const workerInstance = worker.getWorker();
      expect(workerInstance).toBeDefined();
      expect(workerInstance.on).toBeDefined();
      expect(workerInstance.close).toBeDefined();
    });

    it('should close worker', async () => {
      await worker.close();
      expect(mockWorkerClose).toHaveBeenCalled();
    });
  });

  describe('Event Handlers', () => {
    it('should log on completed event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const completedCall = mockWorkerOn.mock.calls.find(call => call[0] === 'completed');
      expect(completedCall).toBeDefined();

      const handler = completedCall[1];
      handler({ id: 'completed-pdf-1' });

      expect(consoleSpy).toHaveBeenCalledWith('PDF job completed-pdf-1 completed successfully');
    });

    it('should log on failed event', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const failedCall = mockWorkerOn.mock.calls.find(call => call[0] === 'failed');
      expect(failedCall).toBeDefined();

      const handler = failedCall[1];
      handler({ id: 'failed-pdf-1' }, new Error('PDF generation failed'));

      expect(consoleSpy).toHaveBeenCalledWith('PDF job failed-pdf-1 failed:', 'PDF generation failed');
    });

    it('should handle failed event with null job', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const failedCall = mockWorkerOn.mock.calls.find(call => call[0] === 'failed');
      const handler = failedCall[1];
      handler(null, new Error('Unknown failure'));

      expect(consoleSpy).toHaveBeenCalledWith('PDF job undefined failed:', 'Unknown failure');
    });

    it('should log on error event', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorCall = mockWorkerOn.mock.calls.find(call => call[0] === 'error');
      expect(errorCall).toBeDefined();

      const handler = errorCall[1];
      handler(new Error('Worker crashed'));

      expect(consoleSpy).toHaveBeenCalledWith('PDF worker error:', expect.any(Error));
    });

    it('should warn on stalled event', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const stalledCall = mockWorkerOn.mock.calls.find(call => call[0] === 'stalled');
      expect(stalledCall).toBeDefined();

      const handler = stalledCall[1];
      handler('stalled-pdf-123');

      expect(consoleSpy).toHaveBeenCalledWith('PDF job stalled-pdf-123 stalled');
    });

    it('should log on active event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const activeCall = mockWorkerOn.mock.calls.find(call => call[0] === 'active');
      expect(activeCall).toBeDefined();

      const handler = activeCall[1];
      handler({ id: 'active-pdf-1' });

      expect(consoleSpy).toHaveBeenCalledWith('PDF job active-pdf-1 started processing');
    });
  });

  describe('Storage Initialization', () => {
    it('should handle storage initialization failure gracefully', async () => {
      vi.clearAllMocks();
      mockStorageInitialize.mockRejectedValueOnce(new Error('S3 connection failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      new PdfWorker();

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize storage:', expect.any(Error));
    });

    it('should log success when storage initializes', async () => {
      vi.clearAllMocks();
      mockStorageInitialize.mockResolvedValueOnce(undefined);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      new PdfWorker();

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith('PDF worker storage initialized');
    });
  });

  describe('createPdfWorker Factory', () => {
    it('should create and return a PdfWorker instance', () => {
      const newWorker = createPdfWorker();
      expect(newWorker).toBeInstanceOf(PdfWorker);
    });
  });

  describe('PDF Format Variations', () => {
    const createMockJob = (format: string): Job<MockPdfJobData, MockJobResult> => ({
      id: 'format-test',
      data: {
        url: 'https://example.com',
        options: { format },
        jobId: 'format-test',
      } as MockPdfJobData,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<MockPdfJobData, MockJobResult>);

    it('should handle A3 format', async () => {
      const mockJob = createMockJob('A3');

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'A3',
        })
      );
    });

    it('should handle A5 format', async () => {
      const mockJob = createMockJob('A5');

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'A5',
        })
      );
    });

    it('should handle Legal format', async () => {
      const mockJob = createMockJob('Legal');

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'Legal',
        })
      );
    });

    it('should handle Tabloid format', async () => {
      const mockJob = createMockJob('Tabloid');

      await capturedProcessor!(mockJob);

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'Tabloid',
        })
      );
    });
  });

  describe('Complex Job Scenarios', () => {
    it('should handle job with all options specified', async () => {
      const mockJob = {
        id: 'full-options-test',
        data: {
          url: 'https://complex.example.com/document',
          options: {
            format: 'Letter',
            landscape: true,
            printBackground: true,
            margin: {
              top: '0.5in',
              right: '0.5in',
              bottom: '0.5in',
              left: '0.5in',
            },
            displayHeaderFooter: true,
            headerTemplate: '<div style="font-size: 10px;">Company Name</div>',
            footerTemplate: '<div style="font-size: 10px;"><span class="pageNumber"></span>/<span class="totalPages"></span></div>',
            preferCSSPageSize: false,
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 Custom',
            headers: { Authorization: 'Bearer token123' },
            cookies: [{ name: 'session', value: 'xyz', domain: 'complex.example.com' }],
            waitOptions: {
              waitUntil: 'networkidle',
              timeout: 60000,
              delay: 1000,
              selector: '#document-ready',
            },
          },
          jobId: 'full-options-test',
          userId: 'user-123',
        } as MockPdfJobData,
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job<MockPdfJobData, MockJobResult>;

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(true);
      expect(mockBrowserPoolAcquirePage).toHaveBeenCalledWith({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 Custom',
      });
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalled();
      expect(mockContext.addCookies).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith('https://complex.example.com/document', {
        waitUntil: 'networkidle',
        timeout: 60000,
      });
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
      expect(mockPage.waitForSelector).toHaveBeenCalled();
      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'Letter',
          landscape: true,
          printBackground: true,
          displayHeaderFooter: true,
        })
      );
    });

    it('should handle concurrent PDF jobs', async () => {
      const jobs = Array.from({ length: 3 }, (_, i) => ({
        id: `concurrent-${i}`,
        data: {
          url: `https://example.com/doc${i}`,
          options: { format: 'A4' },
          jobId: `concurrent-${i}`,
        } as MockPdfJobData,
        updateProgress: vi.fn().mockResolvedValue(undefined),
      })) as unknown as Job<MockPdfJobData, MockJobResult>[];

      const results = await Promise.all(
        jobs.map(job => capturedProcessor!(job))
      );

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      expect(mockBrowserPoolAcquirePage).toHaveBeenCalledTimes(3);
      expect(mockBrowserPoolReleaseContext).toHaveBeenCalledTimes(3);
    });
  });
});
