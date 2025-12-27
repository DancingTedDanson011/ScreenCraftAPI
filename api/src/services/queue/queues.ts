import { Queue } from 'bullmq';
import { queueOptions, QUEUE_NAMES } from './queue.config.js';
import type { ScreenshotRequest } from '../../schemas/screenshot.schema.js';

/**
 * Job Data Types
 */
export interface ScreenshotJobData {
  url: string;
  options: ScreenshotRequest;
  jobId: string;
  userId?: string;
}

export interface PdfJobData {
  url: string;
  options: any; // TODO: Define PDF schema
  jobId: string;
  userId?: string;
}

export interface JobResult {
  success: boolean;
  downloadUrl?: string;
  error?: string;
  fileSize?: number;
  metadata?: Record<string, any>;
}

/**
 * Screenshot Queue
 * Handles screenshot generation jobs
 */
export const screenshotQueue = new Queue<ScreenshotJobData, JobResult>(
  QUEUE_NAMES.SCREENSHOT,
  {
    ...queueOptions,
    defaultJobOptions: {
      ...queueOptions.defaultJobOptions,
      // Screenshot-specific options
      timeout: 60000, // 60 seconds max processing time
    },
  }
);

/**
 * PDF Queue
 * Handles PDF generation jobs
 */
export const pdfQueue = new Queue<PdfJobData, JobResult>(
  QUEUE_NAMES.PDF,
  {
    ...queueOptions,
    defaultJobOptions: {
      ...queueOptions.defaultJobOptions,
      // PDF-specific options
      timeout: 90000, // 90 seconds max processing time (PDFs can be larger)
    },
  }
);

/**
 * Add screenshot job to queue
 */
export async function addScreenshotJob(
  data: ScreenshotJobData,
  priority?: number
): Promise<string> {
  const job = await screenshotQueue.add(
    'generate-screenshot',
    data,
    {
      jobId: data.jobId,
      priority,
    }
  );

  return job.id!;
}

/**
 * Add PDF job to queue
 */
export async function addPdfJob(
  data: PdfJobData,
  priority?: number
): Promise<string> {
  const job = await pdfQueue.add(
    'generate-pdf',
    data,
    {
      jobId: data.jobId,
      priority,
    }
  );

  return job.id!;
}

/**
 * Get job status
 */
export async function getJobStatus(
  queueName: string,
  jobId: string
): Promise<{
  status: string;
  progress?: number;
  result?: JobResult;
  error?: string;
}> {
  const queue = queueName === QUEUE_NAMES.SCREENSHOT ? screenshotQueue : pdfQueue;
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const state = await job.getState();
  const progress = job.progress as number | undefined;
  const result = job.returnvalue as JobResult | undefined;
  const error = job.failedReason;

  return {
    status: state,
    progress,
    result,
    error,
  };
}

/**
 * Cancel job
 */
export async function cancelJob(
  queueName: string,
  jobId: string
): Promise<void> {
  const queue = queueName === QUEUE_NAMES.SCREENSHOT ? screenshotQueue : pdfQueue;
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  await job.remove();
}

/**
 * Get Screenshot Queue
 */
export function getScreenshotQueue() {
  return screenshotQueue;
}

/**
 * Get PDF Queue
 */
export function getPdfQueue() {
  return pdfQueue;
}

/**
 * Queue Event Listeners
 */
screenshotQueue.on('error', (error) => {
  console.error('Screenshot Queue Error:', error);
});

pdfQueue.on('error', (error) => {
  console.error('PDF Queue Error:', error);
});

/**
 * Graceful shutdown handler
 */
export async function closeQueues(): Promise<void> {
  await Promise.all([
    screenshotQueue.close(),
    pdfQueue.close(),
  ]);
}
