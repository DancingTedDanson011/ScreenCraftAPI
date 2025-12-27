import { createScreenshotWorker } from './screenshot.worker.js';
import { createPdfWorker } from './pdf.worker.js';
import { closeQueues } from './queues.js';
import { getBrowserPool } from '../browser-pool/browser-pool.service.js';
import type { ScreenshotWorker } from './screenshot.worker.js';
import type { PdfWorker } from './pdf.worker.js';

/**
 * Worker instances
 */
let screenshotWorker: ScreenshotWorker | null = null;
let pdfWorker: PdfWorker | null = null;

/**
 * Start all workers
 */
export async function startWorkers(): Promise<void> {
  console.log('Starting BullMQ workers...');

  try {
    // Create workers
    screenshotWorker = createScreenshotWorker();
    pdfWorker = createPdfWorker();

    console.log('Screenshot worker started');
    console.log('PDF worker started');

    // Setup graceful shutdown
    setupGracefulShutdown();

    console.log('All workers started successfully');
  } catch (error) {
    console.error('Failed to start workers:', error);
    throw error;
  }
}

/**
 * Stop all workers
 */
export async function stopWorkers(): Promise<void> {
  console.log('Stopping workers...');

  try {
    // Close workers
    if (screenshotWorker) {
      await screenshotWorker.close();
      screenshotWorker = null;
      console.log('Screenshot worker stopped');
    }

    if (pdfWorker) {
      await pdfWorker.close();
      pdfWorker = null;
      console.log('PDF worker stopped');
    }

    // Close queues
    await closeQueues();
    console.log('Queues closed');

    // Shutdown browser pool
    const browserPool = getBrowserPool();
    await browserPool.shutdown();
    console.log('Browser pool shutdown');

    console.log('All workers stopped successfully');
  } catch (error) {
    console.error('Error stopping workers:', error);
    throw error;
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}, initiating graceful shutdown...`);

      try {
        await stopWorkers();
        console.log('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    try {
      await stopWorkers();
    } catch (err) {
      console.error('Error during emergency shutdown:', err);
    }
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    try {
      await stopWorkers();
    } catch (err) {
      console.error('Error during emergency shutdown:', err);
    }
    process.exit(1);
  });
}

/**
 * Check if workers are running
 */
export function areWorkersRunning(): boolean {
  return screenshotWorker !== null && pdfWorker !== null;
}

/**
 * Get worker health status
 */
export async function getWorkerHealth(): Promise<{
  screenshotWorker: boolean;
  pdfWorker: boolean;
  browserPool: {
    healthy: boolean;
    issues: string[];
    stats: any;
  };
}> {
  const browserPool = getBrowserPool();
  const browserPoolHealth = await browserPool.checkHealth();

  return {
    screenshotWorker: screenshotWorker !== null,
    pdfWorker: pdfWorker !== null,
    browserPool: browserPoolHealth,
  };
}

// Export queue service
export { QueueService, getQueueService, queueService } from './queue.service.js';

// Export queue functions
export {
  screenshotQueue,
  pdfQueue,
  addScreenshotJob,
  addPdfJob,
  getJobStatus,
  cancelJob,
  getScreenshotQueue,
  getPdfQueue,
} from './queues.js';

// Export types
export type {
  ScreenshotJobData,
  PdfJobData,
  JobResult,
} from './queues.js';

// Export priority enum and config
export { JobPriority, QUEUE_NAMES, type QueueName } from './queue.config.js';
