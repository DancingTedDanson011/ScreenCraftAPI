/**
 * Worker Entry Point
 * Standalone worker process for BullMQ job processing
 *
 * Usage:
 * - Development: npm run worker:dev
 * - Production: npm run worker:start
 * - Docker: node dist/worker.js
 */

import { startWorkers } from './services/queue/index.js';

/**
 * Main worker entry
 */
async function main() {
  console.log('='.repeat(50));
  console.log('ScreenCraft API - Worker Process');
  console.log('='.repeat(50));
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Process ID: ${process.pid}`);
  console.log(`Node Version: ${process.version}`);
  console.log('='.repeat(50));
  console.log('');

  try {
    // Start all workers
    await startWorkers();

    console.log('');
    console.log('Worker process is running...');
    console.log('Press Ctrl+C to stop');
    console.log('');
  } catch (error) {
    console.error('Failed to start worker process:', error);
    process.exit(1);
  }
}

// Start worker
main().catch((error) => {
  console.error('Fatal error in worker process:', error);
  process.exit(1);
});
