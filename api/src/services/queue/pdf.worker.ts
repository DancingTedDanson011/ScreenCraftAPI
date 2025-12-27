import { Worker, Job } from 'bullmq';
import { workerOptions, QUEUE_NAMES } from './queue.config.js';
import { getBrowserPool } from '../browser-pool/browser-pool.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { PdfJobData, JobResult } from './queues.js';
import type { Page } from 'playwright-core';

/**
 * PDF Worker
 * Processes PDF generation jobs using Browser Pool
 */
export class PdfWorker {
  private worker: Worker<PdfJobData, JobResult>;
  private browserPool = getBrowserPool();
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();

    this.worker = new Worker<PdfJobData, JobResult>(
      QUEUE_NAMES.PDF,
      this.processJob.bind(this),
      {
        ...workerOptions,
        concurrency: 3, // Process 3 PDFs in parallel (lower than screenshots due to resource usage)
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
      console.log('PDF worker storage initialized');
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  /**
   * Process PDF job
   */
  private async processJob(job: Job<PdfJobData, JobResult>): Promise<JobResult> {
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

        // Update progress: Generating PDF
        await job.updateProgress(80);

        // Generate PDF
        const pdfBuffer = await page.pdf({
          format: options.format || 'A4',
          printBackground: options.printBackground !== false,
          margin: options.margin || {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm',
          },
          displayHeaderFooter: options.displayHeaderFooter || false,
          headerTemplate: options.headerTemplate || '',
          footerTemplate: options.footerTemplate || '',
          landscape: options.landscape || false,
          preferCSSPageSize: options.preferCSSPageSize || false,
        });

        // Update progress: Uploading
        await job.updateProgress(90);

        // TODO: Upload to storage (MinIO or local)
        const downloadUrl = await this.uploadPdf(pdfBuffer, jobId);

        // Update progress: Complete
        await job.updateProgress(100);

        // Release context
        await this.browserPool.releaseContext(contextId);

        return {
          success: true,
          downloadUrl,
          fileSize: pdfBuffer.length,
          metadata: {
            url,
            format: options.format || 'A4',
            landscape: options.landscape || false,
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
   * Upload PDF to storage
   */
  private async uploadPdf(buffer: Buffer, jobId: string): Promise<string> {
    try {
      // Generate unique storage key
      const userId = 'system'; // TODO: Get from job data if user auth is implemented
      const filename = `${jobId}.pdf`;
      const key = this.storageService.generatePdfKey(userId, filename);

      // Upload to storage
      await this.storageService.upload(key, buffer, 'application/pdf', {
        jobId,
        uploadedAt: new Date().toISOString(),
      });

      // Generate signed URL (valid for 7 days)
      const downloadUrl = await this.storageService.getSignedUrl(key, 60 * 60 * 24 * 7);

      return downloadUrl;
    } catch (error) {
      throw new Error(
        `Failed to upload PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`PDF job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`PDF job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('PDF worker error:', err);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`PDF job ${jobId} stalled`);
    });

    this.worker.on('active', (job) => {
      console.log(`PDF job ${job.id} started processing`);
    });
  }

  /**
   * Get worker instance
   */
  getWorker(): Worker<PdfJobData, JobResult> {
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
 * Create and export PDF worker
 */
export const createPdfWorker = (): PdfWorker => {
  return new PdfWorker();
};
