import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Job } from 'bullmq';
import type { Page, BrowserContext, Route, Request } from 'playwright-core';

// Mock types for job data
interface MockScreenshotJobData {
  url: string;
  options: {
    format?: string;
    fullPage?: boolean;
    quality?: number;
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
    clip?: { x: number; y: number; width: number; height: number };
    omitBackground?: boolean;
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
  const mockStorageGetSignedUrl = vi.fn().mockResolvedValue('https://storage.example.com/signed-url');
  const mockStorageGenerateScreenshotKey = vi.fn().mockReturnValue('screenshots/system/test-job.png');
  const mockBrowserPoolAcquirePage = vi.fn();
  const mockBrowserPoolReleaseContext = vi.fn().mockResolvedValue(undefined);

  return {
    mockWorkerOn,
    mockWorkerClose,
    mockStorageInitialize,
    mockStorageUpload,
    mockStorageGetSignedUrl,
    mockStorageGenerateScreenshotKey,
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
  mockStorageGenerateScreenshotKey,
  mockBrowserPoolAcquirePage,
  mockBrowserPoolReleaseContext,
  getCapturedProcessor,
  setCapturedProcessor,
} = mocks;

// For backwards compatibility in tests
let capturedProcessor: ((job: Job<MockScreenshotJobData, MockJobResult>) => Promise<MockJobResult>) | null = null;

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
    concurrency: 4,
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
    generateScreenshotKey: mocks.mockStorageGenerateScreenshotKey,
  })),
}));

// Mock queues types
vi.mock('../../../../src/services/queue/queues.js', () => ({
  screenshotQueue: { name: 'screenshot' },
}));

// Import after mocks
import { ScreenshotWorker, createScreenshotWorker } from '../../../../src/services/queue/screenshot.worker.js';

describe('ScreenshotWorker', () => {
  let worker: ScreenshotWorker;
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
      screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot-data')),
      setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
      context: vi.fn().mockReturnValue(mockContext),
      route: vi.fn().mockImplementation(async (pattern, handler) => {
        // Store the handler for later verification
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
    worker = new ScreenshotWorker();

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
        'screenshot',
        expect.any(Function),
        expect.objectContaining({
          concurrency: 4,
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
    const createMockJob = (data: Partial<MockScreenshotJobData> = {}): Job<MockScreenshotJobData, MockJobResult> => ({
      id: 'test-job-id',
      data: {
        url: 'https://example.com',
        options: {
          format: 'png',
          fullPage: false,
        },
        jobId: 'test-job-id',
        ...data,
      } as MockScreenshotJobData,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<MockScreenshotJobData, MockJobResult>);

    it('should successfully process a basic screenshot job', async () => {
      const mockJob = createMockJob();
      expect(capturedProcessor).not.toBeNull();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toBe('https://storage.example.com/signed-url');
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.url).toBe('https://example.com');
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
          userAgent: 'Custom User Agent',
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockBrowserPoolAcquirePage).toHaveBeenCalledWith({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Custom User Agent',
      });
      expect(mockBrowserPoolReleaseContext).toHaveBeenCalledWith('test-context-id');
    });

    it('should set custom headers when provided', async () => {
      const mockJob = createMockJob({
        options: {
          headers: { 'X-Custom-Header': 'test-value', Authorization: 'Bearer token' },
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'X-Custom-Header': 'test-value',
        Authorization: 'Bearer token',
      });
    });

    it('should set cookies when provided', async () => {
      const cookies = [
        { name: 'session', value: 'abc123', domain: 'example.com' },
        { name: 'auth', value: 'xyz789', domain: 'example.com' },
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
          blockResources: ['image', 'stylesheet', 'font'],
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
            timeout: 60000,
          },
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle',
        timeout: 60000,
      });
    });

    it('should wait for delay when specified', async () => {
      const mockJob = createMockJob({
        options: {
          waitOptions: {
            delay: 2000,
          },
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
    });

    it('should wait for selector when specified', async () => {
      const mockJob = createMockJob({
        options: {
          waitOptions: {
            selector: '#content-loaded',
            timeout: 10000,
          },
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#content-loaded', {
        timeout: 10000,
      });
    });

    it('should take screenshot with full page option', async () => {
      const mockJob = createMockJob({
        options: {
          format: 'jpeg',
          fullPage: true,
          quality: 80,
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          fullPage: true,
          type: 'jpeg',
          quality: 80,
        })
      );
    });

    it('should take screenshot with clip option', async () => {
      const clip = { x: 100, y: 100, width: 500, height: 300 };
      const mockJob = createMockJob({
        options: {
          clip,
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          clip,
        })
      );
    });

    it('should take screenshot with omitBackground option', async () => {
      const mockJob = createMockJob({
        options: {
          format: 'png',
          omitBackground: true,
        },
      });

      await capturedProcessor!(mockJob);

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          omitBackground: true,
        })
      );
    });

    it('should upload screenshot to storage', async () => {
      const mockJob = createMockJob({
        jobId: 'upload-test-job',
        options: { format: 'png' },
      });

      await capturedProcessor!(mockJob);

      expect(mockStorageGenerateScreenshotKey).toHaveBeenCalledWith(
        'system',
        'upload-test-job.png'
      );
      expect(mockStorageUpload).toHaveBeenCalledWith(
        'screenshots/system/test-job.png',
        expect.any(Buffer),
        'image/png',
        expect.objectContaining({
          jobId: 'upload-test-job',
          format: 'png',
        })
      );
    });

    it('should generate signed URL for download', async () => {
      const mockJob = createMockJob();

      await capturedProcessor!(mockJob);

      expect(mockStorageGetSignedUrl).toHaveBeenCalledWith(
        'screenshots/system/test-job.png',
        60 * 60 * 24 * 7 // 7 days
      );
    });

    it('should return metadata with timestamp', async () => {
      const mockJob = createMockJob({
        url: 'https://test.example.com',
        options: {
          format: 'png',
          fullPage: true,
          viewport: { width: 1280, height: 720 },
        },
      });

      const result = await capturedProcessor!(mockJob);

      expect(result.metadata).toMatchObject({
        url: 'https://test.example.com',
        format: 'png',
        fullPage: true,
        viewport: { width: 1280, height: 720 },
      });
      expect(result.metadata?.timestamp).toBeDefined();
    });

    it('should handle JPEG format with correct MIME type', async () => {
      const mockJob = createMockJob({
        options: { format: 'jpeg' },
      });

      await capturedProcessor!(mockJob);

      expect(mockStorageUpload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'image/jpeg',
        expect.any(Object)
      );
    });

    it('should handle JPG format as JPEG', async () => {
      const mockJob = createMockJob({
        options: { format: 'jpg' },
      });

      await capturedProcessor!(mockJob);

      expect(mockStorageUpload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'image/jpeg',
        expect.any(Object)
      );
    });

    it('should handle WebP format', async () => {
      const mockJob = createMockJob({
        options: { format: 'webp' },
      });

      await capturedProcessor!(mockJob);

      expect(mockStorageUpload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'image/webp',
        expect.any(Object)
      );
    });

    it('should default to PNG MIME type for unknown formats', async () => {
      const mockJob = createMockJob({
        options: { format: 'unknown' },
      });

      await capturedProcessor!(mockJob);

      expect(mockStorageUpload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'image/png',
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    const createMockJob = (data: Partial<MockScreenshotJobData> = {}): Job<MockScreenshotJobData, MockJobResult> => ({
      id: 'error-test-job',
      data: {
        url: 'https://example.com',
        options: { format: 'png' },
        jobId: 'error-test-job',
        ...data,
      } as MockScreenshotJobData,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<MockScreenshotJobData, MockJobResult>);

    it('should return error result when navigation fails', async () => {
      mockPage.goto = vi.fn().mockRejectedValue(new Error('Navigation timeout'));
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation timeout');
      expect(result.metadata?.url).toBe('https://example.com');
      expect(result.metadata?.timestamp).toBeDefined();
    });

    it('should return error result when screenshot fails', async () => {
      mockPage.screenshot = vi.fn().mockRejectedValue(new Error('Screenshot failed'));
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Screenshot failed');
    });

    it('should release context even on error', async () => {
      mockPage.goto = vi.fn().mockRejectedValue(new Error('Some error'));
      const mockJob = createMockJob();

      await capturedProcessor!(mockJob);

      expect(mockBrowserPoolReleaseContext).toHaveBeenCalledWith('test-context-id');
    });

    it('should handle browser pool acquisition failure', async () => {
      mockBrowserPoolAcquirePage.mockRejectedValue(new Error('No available browsers'));
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No available browsers');
    });

    it('should handle storage upload failure', async () => {
      mockStorageUpload.mockRejectedValue(new Error('Storage unavailable'));
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to upload screenshot');
    });

    it('should handle signed URL generation failure', async () => {
      mockStorageGetSignedUrl.mockRejectedValue(new Error('URL generation failed'));
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to upload screenshot');
    });

    it('should handle non-Error thrown objects', async () => {
      mockPage.goto = vi.fn().mockRejectedValue('String error');
      const mockJob = createMockJob();

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should handle waitForSelector timeout', async () => {
      mockPage.waitForSelector = vi.fn().mockRejectedValue(new Error('Timeout waiting for selector'));
      const mockJob = createMockJob({
        options: {
          waitOptions: { selector: '#never-exists' },
        },
      });

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout waiting for selector');
    });

    it('should handle header setting failure', async () => {
      mockPage.setExtraHTTPHeaders = vi.fn().mockRejectedValue(new Error('Invalid headers'));
      const mockJob = createMockJob({
        options: {
          headers: { 'Invalid-Header': 'value' },
        },
      });

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid headers');
    });

    it('should handle cookie setting failure', async () => {
      mockContext.addCookies = vi.fn().mockRejectedValue(new Error('Invalid cookies'));
      const mockJob = createMockJob({
        options: {
          cookies: [{ name: 'bad', value: '', domain: '' }],
        },
      });

      const result = await capturedProcessor!(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid cookies');
    });
  });

  describe('Resource Blocking', () => {
    it('should block specified resource types', async () => {
      const blockResources = ['image', 'stylesheet'];
      const mockJob = {
        id: 'block-test',
        data: {
          url: 'https://example.com',
          options: { blockResources },
          jobId: 'block-test',
        },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job<MockScreenshotJobData, MockJobResult>;

      // Capture the route handler
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

      // Test that stylesheets get blocked
      const cssRequest = { resourceType: () => 'stylesheet' };
      const cssRoute = {
        request: () => cssRequest,
        abort: vi.fn(),
        continue: vi.fn(),
      };
      routeHandler!(cssRoute as unknown as Route);
      expect(cssRoute.abort).toHaveBeenCalled();

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
      } as unknown as Job<MockScreenshotJobData, MockJobResult>;

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
      } as unknown as Job<MockScreenshotJobData, MockJobResult>;

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

      // Find the completed handler
      const completedCall = mockWorkerOn.mock.calls.find(call => call[0] === 'completed');
      expect(completedCall).toBeDefined();

      const handler = completedCall[1];
      handler({ id: 'completed-job-1' });

      expect(consoleSpy).toHaveBeenCalledWith('Screenshot job completed-job-1 completed successfully');
    });

    it('should log on failed event', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const failedCall = mockWorkerOn.mock.calls.find(call => call[0] === 'failed');
      expect(failedCall).toBeDefined();

      const handler = failedCall[1];
      handler({ id: 'failed-job-1' }, new Error('Test failure'));

      expect(consoleSpy).toHaveBeenCalledWith('Screenshot job failed-job-1 failed:', 'Test failure');
    });

    it('should handle failed event with null job', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const failedCall = mockWorkerOn.mock.calls.find(call => call[0] === 'failed');
      const handler = failedCall[1];
      handler(null, new Error('Unknown job failure'));

      expect(consoleSpy).toHaveBeenCalledWith('Screenshot job undefined failed:', 'Unknown job failure');
    });

    it('should log on error event', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorCall = mockWorkerOn.mock.calls.find(call => call[0] === 'error');
      expect(errorCall).toBeDefined();

      const handler = errorCall[1];
      handler(new Error('Worker error'));

      expect(consoleSpy).toHaveBeenCalledWith('Screenshot worker error:', expect.any(Error));
    });

    it('should warn on stalled event', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const stalledCall = mockWorkerOn.mock.calls.find(call => call[0] === 'stalled');
      expect(stalledCall).toBeDefined();

      const handler = stalledCall[1];
      handler('stalled-job-123');

      expect(consoleSpy).toHaveBeenCalledWith('Screenshot job stalled-job-123 stalled');
    });

    it('should log on active event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const activeCall = mockWorkerOn.mock.calls.find(call => call[0] === 'active');
      expect(activeCall).toBeDefined();

      const handler = activeCall[1];
      handler({ id: 'active-job-1' });

      expect(consoleSpy).toHaveBeenCalledWith('Screenshot job active-job-1 started processing');
    });
  });

  describe('Storage Initialization', () => {
    it('should handle storage initialization failure gracefully', async () => {
      vi.clearAllMocks();
      mockStorageInitialize.mockRejectedValueOnce(new Error('Bucket creation failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create new worker which triggers initializeStorage
      new ScreenshotWorker();

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize storage:', expect.any(Error));
    });

    it('should log success when storage initializes', async () => {
      vi.clearAllMocks();
      mockStorageInitialize.mockResolvedValueOnce(undefined);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      new ScreenshotWorker();

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith('Screenshot worker storage initialized');
    });
  });

  describe('createScreenshotWorker Factory', () => {
    it('should create and return a ScreenshotWorker instance', () => {
      const newWorker = createScreenshotWorker();
      expect(newWorker).toBeInstanceOf(ScreenshotWorker);
    });
  });

  describe('Default Options', () => {
    it('should use default waitUntil "load" when not specified', async () => {
      const mockJob = {
        id: 'default-wait-test',
        data: {
          url: 'https://example.com',
          options: {},
          jobId: 'default-wait-test',
        },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job<MockScreenshotJobData, MockJobResult>;

      await capturedProcessor!(mockJob);

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'load',
        timeout: 30000,
      });
    });

    it('should use default timeout 30000ms when not specified', async () => {
      const mockJob = {
        id: 'default-timeout-test',
        data: {
          url: 'https://example.com',
          options: {
            waitOptions: {
              waitUntil: 'domcontentloaded',
            },
          },
          jobId: 'default-timeout-test',
        },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job<MockScreenshotJobData, MockJobResult>;

      await capturedProcessor!(mockJob);

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    });
  });
});
