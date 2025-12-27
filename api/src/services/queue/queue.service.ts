import { Job } from 'bullmq';
import {
  screenshotQueue,
  pdfQueue,
  addScreenshotJob as enqueueScreenshotJob,
  addPdfJob as enqueuePdfJob,
  getJobStatus as getQueueJobStatus,
  cancelJob,
  type ScreenshotJobData,
  type PdfJobData,
  type JobResult,
} from './queues.js';
import { QUEUE_NAMES, JobPriority } from './queue.config.js';

/**
 * Queue Service
 * High-level API for managing screenshot and PDF generation jobs
 */
export class QueueService {
  /**
   * Add a screenshot job to the queue
   * @param data - Screenshot job data
   * @param priority - Job priority (1 = highest, 10 = lowest)
   * @returns Job ID
   */
  async addScreenshotJob(
    data: Omit<ScreenshotJobData, 'jobId'> & { jobId?: string },
    priority: number = JobPriority.NORMAL
  ): Promise<string> {
    const jobData: ScreenshotJobData = {
      ...data,
      jobId: data.jobId || `screenshot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

    try {
      const jobId = await enqueueScreenshotJob(jobData, priority);
      return jobId;
    } catch (error) {
      throw new Error(
        `Failed to queue screenshot job: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add a PDF job to the queue
   * @param data - PDF job data
   * @param priority - Job priority (1 = highest, 10 = lowest)
   * @returns Job ID
   */
  async addPdfJob(
    data: Omit<PdfJobData, 'jobId'> & { jobId?: string },
    priority: number = JobPriority.NORMAL
  ): Promise<string> {
    const jobData: PdfJobData = {
      ...data,
      jobId: data.jobId || `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

    try {
      const jobId = await enqueuePdfJob(jobData, priority);
      return jobId;
    } catch (error) {
      throw new Error(
        `Failed to queue PDF job: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get job status and progress
   * @param queueName - Name of the queue (screenshot or pdf)
   * @param jobId - Job ID
   * @returns Job status information
   */
  async getJobStatus(
    queueName: 'screenshot' | 'pdf',
    jobId: string
  ): Promise<{
    id: string;
    status: 'pending' | 'active' | 'completed' | 'failed' | 'delayed' | 'waiting';
    progress?: number;
    result?: JobResult;
    error?: string;
    attempts?: number;
    timestamp?: Date;
  }> {
    try {
      const queueNameKey = queueName === 'screenshot' ? QUEUE_NAMES.SCREENSHOT : QUEUE_NAMES.PDF;
      const jobStatus = await getQueueJobStatus(queueNameKey, jobId);

      const queue = queueName === 'screenshot' ? screenshotQueue : pdfQueue;
      const job = await queue.getJob(jobId);

      return {
        id: jobId,
        status: jobStatus.status as any,
        progress: jobStatus.progress,
        result: jobStatus.result,
        error: jobStatus.error,
        attempts: job?.attemptsMade,
        timestamp: job?.timestamp ? new Date(job.timestamp) : undefined,
      };
    } catch (error) {
      throw new Error(
        `Failed to get job status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Cancel a pending or active job
   * @param queueName - Name of the queue
   * @param jobId - Job ID
   */
  async cancelJob(queueName: 'screenshot' | 'pdf', jobId: string): Promise<void> {
    try {
      const queueNameKey = queueName === 'screenshot' ? QUEUE_NAMES.SCREENSHOT : QUEUE_NAMES.PDF;
      await cancelJob(queueNameKey, jobId);
    } catch (error) {
      throw new Error(
        `Failed to cancel job: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retry a failed job
   * @param queueName - Name of the queue
   * @param jobId - Job ID
   */
  async retryJob(queueName: 'screenshot' | 'pdf', jobId: string): Promise<void> {
    try {
      const queue = queueName === 'screenshot' ? screenshotQueue : pdfQueue;
      const job = await queue.getJob(jobId);

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const state = await job.getState();

      if (state !== 'failed') {
        throw new Error(`Job ${jobId} is not in failed state. Current state: ${state}`);
      }

      await job.retry();
    } catch (error) {
      throw new Error(
        `Failed to retry job: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get queue statistics
   * @param queueName - Name of the queue
   */
  async getQueueStats(queueName: 'screenshot' | 'pdf'): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const queue = queueName === 'screenshot' ? screenshotQueue : pdfQueue;

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      throw new Error(
        `Failed to get queue stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all jobs in a specific state
   * @param queueName - Name of the queue
   * @param state - Job state
   * @param start - Start index
   * @param end - End index
   */
  async getJobs(
    queueName: 'screenshot' | 'pdf',
    state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    start: number = 0,
    end: number = 10
  ): Promise<Job<ScreenshotJobData | PdfJobData, JobResult>[]> {
    try {
      const queue = queueName === 'screenshot' ? screenshotQueue : pdfQueue;
      const jobs = await queue.getJobs([state], start, end);
      return jobs as Job<ScreenshotJobData | PdfJobData, JobResult>[];
    } catch (error) {
      throw new Error(
        `Failed to get jobs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clean old jobs from the queue
   * @param queueName - Name of the queue
   * @param grace - Grace period in milliseconds
   * @param limit - Max number of jobs to clean
   */
  async cleanQueue(
    queueName: 'screenshot' | 'pdf',
    grace: number = 86400000, // 24 hours
    limit: number = 1000
  ): Promise<number[]> {
    try {
      const queue = queueName === 'screenshot' ? screenshotQueue : pdfQueue;

      const [completedCount, failedCount] = await Promise.all([
        queue.clean(grace, limit, 'completed'),
        queue.clean(grace, limit, 'failed'),
      ]);

      return [completedCount.length, failedCount.length];
    } catch (error) {
      throw new Error(
        `Failed to clean queue: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Singleton instance
 */
let queueServiceInstance: QueueService | null = null;

/**
 * Get or create QueueService singleton
 */
export function getQueueService(): QueueService {
  if (!queueServiceInstance) {
    queueServiceInstance = new QueueService();
  }
  return queueServiceInstance;
}

/**
 * Export default instance
 */
export const queueService = getQueueService();
