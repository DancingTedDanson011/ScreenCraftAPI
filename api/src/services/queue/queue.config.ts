import Redis from 'ioredis';
import { config } from '../../config/index.js';

/**
 * Redis Connection Configuration for BullMQ
 *
 * CRITICAL SETTINGS:
 * - maxRetriesPerRequest: null - Required for BullMQ to work correctly
 * - enableReadyCheck: false - Prevents connection issues with BullMQ
 */
export const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // CRITICAL: Required for BullMQ
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

/**
 * Queue Configuration Options
 */
export const queueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
};

/**
 * Worker Configuration Options
 */
export const workerOptions = {
  connection: redisConnection,
  concurrency: 4, // Process 4 jobs in parallel
  lockDuration: 30000, // 30 seconds lock duration
  maxStalledCount: 2, // Max retries for stalled jobs
  stalledInterval: 5000, // Check for stalled jobs every 5 seconds
};

/**
 * Priority Levels
 */
export enum JobPriority {
  HIGH = 1,
  NORMAL = 5,
  LOW = 10,
}

/**
 * Queue Names
 */
export const QUEUE_NAMES = {
  SCREENSHOT: 'screenshot',
  PDF: 'pdf',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
