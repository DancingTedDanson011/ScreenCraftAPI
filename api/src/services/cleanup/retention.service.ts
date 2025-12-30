/**
 * Data Retention Cleanup Service
 *
 * Handles automatic cleanup of expired data for privacy compliance:
 * - Deletes expired screenshot/PDF files from MinIO storage
 * - Deletes or anonymizes expired metadata from database
 * - Runs on a scheduled basis (daily at 3:00 UTC)
 *
 * Retention periods by plan:
 * - FREE: Files 1h, Metadata 7 days
 * - PRO: Files 24h, Metadata 30 days
 * - BUSINESS: Files 7 days, Metadata 90 days
 * - ENTERPRISE: Files 30 days, Metadata 1 year
 */

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '../../lib/db.js';
import { getStorageService, StorageService } from '../storage/index.js';
import { createLogger } from '../../lib/logger.js';
import { redisConnection } from '../queue/queue.config.js';
import type { Tier } from '@prisma/client';

const logger = createLogger({ service: 'retention-cleanup' });

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  success: boolean;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  filesDeleted: number;
  fileErrors: number;
  screenshotsAnonymized: number;
  screenshotsDeleted: number;
  pdfsAnonymized: number;
  pdfsDeleted: number;
  errors: string[];
}

/**
 * Retention periods in milliseconds by tier
 */
export const RETENTION_PERIODS = {
  FREE: {
    files: 1 * 60 * 60 * 1000, // 1 hour
    metadata: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  PRO: {
    files: 24 * 60 * 60 * 1000, // 24 hours
    metadata: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  BUSINESS: {
    files: 7 * 24 * 60 * 60 * 1000, // 7 days
    metadata: 90 * 24 * 60 * 60 * 1000, // 90 days
  },
  ENTERPRISE: {
    files: 30 * 24 * 60 * 60 * 1000, // 30 days
    metadata: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
} as const;

/**
 * Queue name for cleanup jobs
 */
export const CLEANUP_QUEUE_NAME = 'data-retention-cleanup';

/**
 * Retention Service - Handles data cleanup operations
 */
export class RetentionService {
  private storageService: StorageService;

  constructor(storageService?: StorageService) {
    this.storageService = storageService || getStorageService();
  }

  /**
   * Delete expired screenshot files from MinIO storage
   * Files with expiresAt < now() are deleted
   */
  async cleanupExpiredFiles(): Promise<{ deleted: number; errors: string[] }> {
    const now = new Date();
    const errors: string[] = [];
    let deleted = 0;

    logger.info('Starting expired files cleanup');

    // Find screenshots with expired files
    const expiredScreenshots = await prisma.screenshot.findMany({
      where: {
        expiresAt: { lt: now },
        storageKey: { not: null },
      },
      select: {
        id: true,
        storageKey: true,
      },
    });

    // Find PDFs with expired files
    const expiredPdfs = await prisma.pdf.findMany({
      where: {
        expiresAt: { lt: now },
        storageKey: { not: null },
      },
      select: {
        id: true,
        storageKey: true,
      },
    });

    logger.info({
      expiredScreenshots: expiredScreenshots.length,
      expiredPdfs: expiredPdfs.length,
    }, 'Found expired files to delete');

    // Delete screenshot files
    for (const screenshot of expiredScreenshots) {
      try {
        if (screenshot.storageKey) {
          await this.storageService.delete(screenshot.storageKey);

          // Clear storage-related fields in DB
          await prisma.screenshot.update({
            where: { id: screenshot.id },
            data: {
              storageKey: null,
              downloadUrl: null,
              fileSize: null,
            },
          });

          deleted++;
          logger.debug({ screenshotId: screenshot.id }, 'Deleted expired screenshot file');
        }
      } catch (error) {
        const errorMsg = `Failed to delete screenshot file ${screenshot.id}: ${(error as Error).message}`;
        errors.push(errorMsg);
        logger.error({ screenshotId: screenshot.id, error }, errorMsg);
      }
    }

    // Delete PDF files
    for (const pdf of expiredPdfs) {
      try {
        if (pdf.storageKey) {
          await this.storageService.delete(pdf.storageKey);

          // Clear storage-related fields in DB
          await prisma.pdf.update({
            where: { id: pdf.id },
            data: {
              storageKey: null,
              downloadUrl: null,
              fileSize: null,
            },
          });

          deleted++;
          logger.debug({ pdfId: pdf.id }, 'Deleted expired PDF file');
        }
      } catch (error) {
        const errorMsg = `Failed to delete PDF file ${pdf.id}: ${(error as Error).message}`;
        errors.push(errorMsg);
        logger.error({ pdfId: pdf.id, error }, errorMsg);
      }
    }

    logger.info({ deleted, errorCount: errors.length }, 'Completed expired files cleanup');
    return { deleted, errors };
  }

  /**
   * Delete expired metadata from database
   * Records with metadataExpiresAt < now() are deleted entirely
   */
  async cleanupExpiredMetadata(): Promise<{
    screenshotsDeleted: number;
    pdfsDeleted: number;
    errors: string[];
  }> {
    const now = new Date();
    const errors: string[] = [];

    logger.info('Starting expired metadata cleanup');

    // First, ensure any remaining files are deleted before removing records
    const screenshotsToDelete = await prisma.screenshot.findMany({
      where: {
        metadataExpiresAt: { lt: now },
        storageKey: { not: null },
      },
      select: { id: true, storageKey: true },
    });

    const pdfsToDelete = await prisma.pdf.findMany({
      where: {
        metadataExpiresAt: { lt: now },
        storageKey: { not: null },
      },
      select: { id: true, storageKey: true },
    });

    // Delete any remaining files before deleting records
    for (const record of [...screenshotsToDelete, ...pdfsToDelete]) {
      try {
        if (record.storageKey) {
          await this.storageService.delete(record.storageKey);
        }
      } catch (error) {
        // Log but don't fail - we still want to delete the metadata
        logger.warn({ id: record.id, error }, 'Failed to delete file during metadata cleanup');
      }
    }

    // Delete expired screenshot records
    let screenshotsDeleted = 0;
    try {
      const result = await prisma.screenshot.deleteMany({
        where: {
          metadataExpiresAt: { lt: now },
        },
      });
      screenshotsDeleted = result.count;
    } catch (error) {
      const errorMsg = `Failed to delete expired screenshot metadata: ${(error as Error).message}`;
      errors.push(errorMsg);
      logger.error({ error }, errorMsg);
    }

    // Delete expired PDF records
    let pdfsDeleted = 0;
    try {
      const result = await prisma.pdf.deleteMany({
        where: {
          metadataExpiresAt: { lt: now },
        },
      });
      pdfsDeleted = result.count;
    } catch (error) {
      const errorMsg = `Failed to delete expired PDF metadata: ${(error as Error).message}`;
      errors.push(errorMsg);
      logger.error({ error }, errorMsg);
    }

    logger.info({ screenshotsDeleted, pdfsDeleted, errorCount: errors.length }, 'Completed expired metadata cleanup');
    return { screenshotsDeleted, pdfsDeleted, errors };
  }

  /**
   * Anonymize old URLs in records that are past their metadata retention but still needed for analytics
   * This hashes/nullifies the URL field while keeping the record for usage statistics
   */
  async anonymizeOldUrls(): Promise<{
    screenshotsAnonymized: number;
    pdfsAnonymized: number;
    errors: string[];
  }> {
    const now = new Date();
    const errors: string[] = [];

    logger.info('Starting URL anonymization');

    // Find screenshots that have expired file retention but not metadata retention
    // These should have their URLs anonymized (we keep urlHash and urlDomain for analytics)
    let screenshotsAnonymized = 0;
    try {
      const result = await prisma.screenshot.updateMany({
        where: {
          expiresAt: { lt: now },
          url: { not: '[ANONYMIZED]' },
          // Only anonymize if metadata hasn't expired (otherwise it will be deleted)
          OR: [
            { metadataExpiresAt: null },
            { metadataExpiresAt: { gt: now } },
          ],
        },
        data: {
          url: '[ANONYMIZED]',
          webhookUrl: null,
          userAgent: null,
        },
      });
      screenshotsAnonymized = result.count;
    } catch (error) {
      const errorMsg = `Failed to anonymize screenshot URLs: ${(error as Error).message}`;
      errors.push(errorMsg);
      logger.error({ error }, errorMsg);
    }

    // Anonymize PDF URLs
    let pdfsAnonymized = 0;
    try {
      const result = await prisma.pdf.updateMany({
        where: {
          expiresAt: { lt: now },
          AND: [
            { url: { not: '[ANONYMIZED]' } },
            { url: { not: null } },
          ],
          OR: [
            { metadataExpiresAt: null },
            { metadataExpiresAt: { gt: now } },
          ],
        },
        data: {
          url: '[ANONYMIZED]',
          webhookUrl: null,
          userAgent: null,
        },
      });
      pdfsAnonymized = result.count;
    } catch (error) {
      const errorMsg = `Failed to anonymize PDF URLs: ${(error as Error).message}`;
      errors.push(errorMsg);
      logger.error({ error }, errorMsg);
    }

    logger.info({ screenshotsAnonymized, pdfsAnonymized, errorCount: errors.length }, 'Completed URL anonymization');
    return { screenshotsAnonymized, pdfsAnonymized, errors };
  }

  /**
   * Main cleanup job - runs all cleanup operations
   */
  async runCleanup(): Promise<CleanupResult> {
    const startedAt = new Date();
    const allErrors: string[] = [];

    logger.info('Starting data retention cleanup job');

    // Run file cleanup
    const fileResult = await this.cleanupExpiredFiles();
    allErrors.push(...fileResult.errors);

    // Anonymize URLs before deleting metadata
    const anonymizeResult = await this.anonymizeOldUrls();
    allErrors.push(...anonymizeResult.errors);

    // Delete expired metadata
    const metadataResult = await this.cleanupExpiredMetadata();
    allErrors.push(...metadataResult.errors);

    const completedAt = new Date();
    const result: CleanupResult = {
      success: allErrors.length === 0,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      filesDeleted: fileResult.deleted,
      fileErrors: fileResult.errors.length,
      screenshotsAnonymized: anonymizeResult.screenshotsAnonymized,
      screenshotsDeleted: metadataResult.screenshotsDeleted,
      pdfsAnonymized: anonymizeResult.pdfsAnonymized,
      pdfsDeleted: metadataResult.pdfsDeleted,
      errors: allErrors,
    };

    logger.info({
      ...result,
      errors: result.errors.length > 0 ? result.errors : undefined,
    }, 'Completed data retention cleanup job');

    return result;
  }

  /**
   * Get retention period for a tier
   */
  static getRetentionPeriod(tier: Tier): { files: number; metadata: number } {
    return RETENTION_PERIODS[tier] || RETENTION_PERIODS.FREE;
  }

  /**
   * Calculate expiration dates for a new record based on tier
   */
  static calculateExpirationDates(tier: Tier): {
    expiresAt: Date;
    metadataExpiresAt: Date;
  } {
    const now = new Date();
    const periods = RetentionService.getRetentionPeriod(tier);

    return {
      expiresAt: new Date(now.getTime() + periods.files),
      metadataExpiresAt: new Date(now.getTime() + periods.metadata),
    };
  }
}

// ============================================
// BullMQ Queue and Worker for Scheduled Cleanup
// ============================================

/**
 * Cleanup job queue
 */
let cleanupQueue: Queue | null = null;

/**
 * Get or create the cleanup queue
 */
export function getCleanupQueue(): Queue {
  if (!cleanupQueue) {
    cleanupQueue = new Queue(CLEANUP_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 7 * 24 * 60 * 60, // Keep completed jobs for 7 days
          count: 100,
        },
        removeOnFail: {
          age: 30 * 24 * 60 * 60, // Keep failed jobs for 30 days
        },
      },
    });
  }
  return cleanupQueue;
}

/**
 * Schedule the cleanup job to run daily at 3:00 UTC
 */
export async function scheduleCleanupJob(): Promise<void> {
  const queue = getCleanupQueue();

  // Remove any existing repeatable jobs to avoid duplicates
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === 'daily-cleanup') {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Schedule the job to run daily at 3:00 UTC
  // Cron: minute hour day-of-month month day-of-week
  await queue.add(
    'daily-cleanup',
    { scheduledAt: new Date().toISOString() },
    {
      repeat: {
        pattern: '0 3 * * *', // 3:00 UTC daily
      },
    }
  );

  logger.info('Scheduled daily cleanup job at 3:00 UTC');
}

/**
 * Create and start the cleanup worker
 */
export function createCleanupWorker(): Worker {
  const retentionService = new RetentionService();

  const worker = new Worker(
    CLEANUP_QUEUE_NAME,
    async (job: Job) => {
      logger.info({ jobId: job.id, jobName: job.name }, 'Processing cleanup job');

      const result = await retentionService.runCleanup();

      if (!result.success) {
        // Log errors but don't throw - we want to mark job as complete
        // even if some individual operations failed
        logger.warn({
          jobId: job.id,
          errorCount: result.errors.length,
          errors: result.errors,
        }, 'Cleanup job completed with some errors');
      }

      return result;
    },
    {
      connection: redisConnection,
      concurrency: 1, // Only one cleanup at a time
    }
  );

  worker.on('completed', (job, result: CleanupResult) => {
    logger.info({
      jobId: job.id,
      filesDeleted: result.filesDeleted,
      screenshotsDeleted: result.screenshotsDeleted,
      pdfsDeleted: result.pdfsDeleted,
      durationMs: result.durationMs,
    }, 'Cleanup job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({
      jobId: job?.id,
      error: error.message,
    }, 'Cleanup job failed');
  });

  return worker;
}

/**
 * Trigger an immediate cleanup (for manual execution or testing)
 */
export async function triggerImmediateCleanup(): Promise<Job> {
  const queue = getCleanupQueue();
  return queue.add('manual-cleanup', {
    scheduledAt: new Date().toISOString(),
    triggeredManually: true,
  });
}

// Export singleton instance for direct use
let retentionServiceInstance: RetentionService | null = null;

export function getRetentionService(): RetentionService {
  if (!retentionServiceInstance) {
    retentionServiceInstance = new RetentionService();
  }
  return retentionServiceInstance;
}

export const retentionService = getRetentionService();
