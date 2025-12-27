import { Worker, Job } from 'bullmq';
import { workerOptions, QUEUE_NAMES } from './queue.config.js';
import { getBrowserPool } from '../browser-pool/browser-pool.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { ScreenshotJobData, JobResult } from './queues.js';
import type { Page } from 'playwright-core';

/**
 * Screenshot Worker
 * Processes screenshot generation jobs using Browser Pool
 */
export class ScreenshotWorker {
  private worker: Worker<ScreenshotJobData, JobResult>;
  private browserPool = getBrowserPool();
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();

    this.worker = new Worker<ScreenshotJobData, JobResult>(
      QUEUE_NAMES.SCREENSHOT,
      this.processJob.bind(this),
      {
        ...workerOptions,
        concurrency: 4, // Process 4 screenshots in parallel
      }
    );

    this.setupEventHandlers();
    this.initializeStorage();
  }

  /**
   * Initialize storage (ensure bucket exists)
   */
  private async initializeStorage(): Promise<void> {
    try {
      await this.storageService.initialize();
      console.log('Screenshot worker storage initialized');
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  /**
   * Process screenshot job
   */
  private async processJob(job: Job<ScreenshotJobData, JobResult>): Promise<JobResult> {
    const { url, options, jobId } = job.data;

    try {
      // Update progress: Acquiring browser context
      await job.updateProgress(10);

      // Acquire browser context and page
      const { page, contextId } = await this.browserPool.acquirePage({
        viewport: options.viewport,
        userAgent: options.userAgent,
      });

      try {
        // Update progress: Navigating to URL
        await job.updateProgress(30);

        // Set custom headers if provided
        if (options.headers) {
          await page.setExtraHTTPHeaders(options.headers);
        }

        // Set cookies if provided
        if (options.cookies) {
          await page.context().addCookies(options.cookies);
        }

        // Block resources if specified
        if (options.blockResources && options.blockResources.length > 0) {
          await this.setupResourceBlocking(page, options.blockResources);
        }

        // Navigate to URL
        const waitUntil = options.waitOptions?.waitUntil || 'load';
        const timeout = options.waitOptions?.timeout || 30000;

        await page.goto(url, {
          waitUntil,
          timeout,
        });

        // Update progress: Page loaded
        await job.updateProgress(60);

        // Additional wait if specified
        if (options.waitOptions?.delay) {
          await page.waitForTimeout(options.waitOptions.delay);
        }

        // Wait for selector if specified
        if (options.waitOptions?.selector) {
          await page.waitForSelector(options.waitOptions.selector, {
            timeout,
          });
        }

        // Update progress: Taking screenshot
        await job.updateProgress(80);

        // Take screenshot
        const screenshotBuffer = await page.screenshot({
          fullPage: options.fullPage,
          type: options.format as 'png' | 'jpeg',
          quality: options.quality,
          clip: options.clip,
          omitBackground: options.omitBackground,
        });

        // Update progress: Uploading
        await job.updateProgress(90);

        // TODO: Upload to storage (MinIO or local)
        const downloadUrl = await this.uploadScreenshot(
          screenshotBuffer,
          jobId,
          options.format
        );

        // Update progress: Complete
        await job.updateProgress(100);

        // Release context
        await this.browserPool.releaseContext(contextId);

        return {
          success: true,
          downloadUrl,
          fileSize: screenshotBuffer.length,
          metadata: {
            url,
            format: options.format,
            viewport: options.viewport,
            fullPage: options.fullPage,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        // Ensure context is released even on error
        await this.browserPool.releaseContext(contextId);
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
        metadata: {
          url,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Setup resource blocking
   */
  private async setupResourceBlocking(
    page: Page,
    blockResources: string[]
  ): Promise<void> {
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();

      if (blockResources.includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  /**
   * Upload screenshot to storage
   */
  private async uploadScreenshot(
    buffer: Buffer,
    jobId: string,
    format: string
  ): Promise<string> {
    try {
      // Generate unique storage key
      const userId = 'system'; // TODO: Get from job data if user auth is implemented
      const filename = `${jobId}.${format}`;
      const key = this.storageService.generateScreenshotKey(userId, filename);

      // Determine MIME type
      const mimeTypes: Record<string, string> = {
        png: 'image/png',
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        webp: 'image/webp',
      };

      const contentType = mimeTypes[format.toLowerCase()] || 'image/png';

      // Upload to storage
      await this.storageService.upload(key, buffer, contentType, {
        jobId,
        format,
        uploadedAt: new Date().toISOString(),
      });

      // Generate signed URL (valid for 7 days)
      const downloadUrl = await this.storageService.getSignedUrl(key, 60 * 60 * 24 * 7);

      return downloadUrl;
    } catch (error) {
      throw new Error(
        `Failed to upload screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Screenshot job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Screenshot job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('Screenshot worker error:', err);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`Screenshot job ${jobId} stalled`);
    });

    this.worker.on('active', (job) => {
      console.log(`Screenshot job ${job.id} started processing`);
    });
  }

  /**
   * Get worker instance
   */
  getWorker(): Worker<ScreenshotJobData, JobResult> {
    return this.worker;
  }

  /**
   * Close worker
   */
  async close(): Promise<void> {
    await this.worker.close();
  }
}

/**
 * Create and export screenshot worker
 */
export const createScreenshotWorker = (): ScreenshotWorker => {
  return new ScreenshotWorker();
};
