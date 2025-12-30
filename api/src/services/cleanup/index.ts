/**
 * Data Retention Cleanup Service
 * Exports for automatic data cleanup and retention management
 */

export {
  RetentionService,
  retentionService,
  getRetentionService,
  CleanupResult,
  RETENTION_PERIODS,
  CLEANUP_QUEUE_NAME,
  getCleanupQueue,
  scheduleCleanupJob,
  createCleanupWorker,
  triggerImmediateCleanup,
} from './retention.service.js';
