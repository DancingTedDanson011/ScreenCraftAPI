# BullMQ Queue & Worker System

## Overview

This directory contains the BullMQ-based queue system for ScreenCraft API. It provides asynchronous job processing for screenshot and PDF generation with the following features:

- **Parallel Processing**: 4 concurrent screenshot jobs, 3 concurrent PDF jobs
- **Priority Queues**: HIGH (1), NORMAL (5), LOW (10)
- **Progress Tracking**: Real-time job progress updates (10%, 30%, 60%, 80%, 100%)
- **Auto-Retry**: Exponential backoff with 3 retry attempts
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
- **Browser Pool Integration**: Efficient browser context management

## Architecture

```
queue/
├── queue.config.ts      # Redis connection & queue configuration
├── queues.ts            # Queue definitions & job management
├── screenshot.worker.ts # Screenshot job processor
├── pdf.worker.ts        # PDF job processor
├── index.ts             # Worker starter & exports
└── README.md            # This file
```

## Usage

### Starting Workers

**Development:**
```bash
npm run worker:dev
```

**Production:**
```bash
npm run build
npm run worker:start
```

**Docker:**
```bash
docker-compose up worker
```

### Adding Jobs to Queue

```typescript
import { addScreenshotJob, JobPriority } from './services/queue';

// Add screenshot job
const jobId = await addScreenshotJob(
  {
    jobId: 'unique-job-id',
    url: 'https://example.com',
    options: {
      format: 'png',
      fullPage: true,
      viewport: { width: 1920, height: 1080 },
    },
  },
  JobPriority.HIGH
);
```

### Checking Job Status

```typescript
import { getJobStatus, QUEUE_NAMES } from './services/queue';

const status = await getJobStatus(QUEUE_NAMES.SCREENSHOT, jobId);

console.log(status);
// {
//   status: 'completed',
//   progress: 100,
//   result: {
//     success: true,
//     downloadUrl: 'http://...',
//     fileSize: 123456
//   }
// }
```

### Canceling Jobs

```typescript
import { cancelJob, QUEUE_NAMES } from './services/queue';

await cancelJob(QUEUE_NAMES.SCREENSHOT, jobId);
```

## Configuration

### Redis Connection (queue.config.ts)

```typescript
export const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,  // CRITICAL for BullMQ
  enableReadyCheck: false,
});
```

### Queue Options

```typescript
export const queueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,                    // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,                  // Start with 2 seconds
    },
    removeOnComplete: {
      age: 3600,                    // Keep for 1 hour
      count: 1000,                  // Max 1000 jobs
    },
    removeOnFail: {
      age: 86400,                   // Keep failed for 24 hours
    },
  },
};
```

### Worker Options

```typescript
export const workerOptions = {
  connection: redisConnection,
  concurrency: 4,                   // Process 4 jobs in parallel
  lockDuration: 30000,              // 30 seconds lock
  maxStalledCount: 2,               // Max retries for stalled jobs
  stalledInterval: 5000,            // Check every 5 seconds
};
```

## Job Flow

### Screenshot Job Processing

1. **Acquire Context (10%)**: Get browser context from pool
2. **Navigate (30%)**: Load target URL
3. **Wait (60%)**: Wait for page load/selector
4. **Capture (80%)**: Take screenshot
5. **Upload (90%)**: Store in MinIO/local
6. **Complete (100%)**: Return download URL

### Error Handling

- Browser context is **always released** (even on error)
- Failed jobs are retried with exponential backoff
- Errors are logged with full context
- Job state is properly updated

## Health Monitoring

```typescript
import { getWorkerHealth } from './services/queue';

const health = await getWorkerHealth();

console.log(health);
// {
//   screenshotWorker: true,
//   pdfWorker: true,
//   browserPool: {
//     healthy: true,
//     issues: [],
//     stats: { ... }
//   }
// }
```

## Graceful Shutdown

Workers handle the following signals:
- `SIGTERM` - Docker/Kubernetes shutdown
- `SIGINT` - Ctrl+C
- `SIGUSR2` - Nodemon restart

Shutdown process:
1. Stop accepting new jobs
2. Wait for active jobs to complete
3. Close worker connections
4. Close queue connections
5. Shutdown browser pool
6. Exit cleanly

## Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional

# Worker Configuration
MAX_CONCURRENT_BROWSERS=5
PLAYWRIGHT_TIMEOUT=30000
```

## Best Practices

### Do:
- ✅ Always set job priority based on urgency
- ✅ Monitor queue length and worker health
- ✅ Use progress updates for long-running jobs
- ✅ Handle job failures gracefully
- ✅ Scale workers horizontally by running multiple instances

### Don't:
- ❌ Block worker thread with synchronous operations
- ❌ Store large payloads in job data (use references)
- ❌ Ignore failed jobs (monitor and fix issues)
- ❌ Run workers and API in same process (separate concerns)

## Scaling

### Horizontal Scaling

Run multiple worker processes:

```bash
# Terminal 1
npm run worker:start

# Terminal 2
npm run worker:start

# Terminal 3
npm run worker:start
```

All workers share the same Redis queue and process jobs in parallel.

### Vertical Scaling

Increase concurrency in `workerOptions`:

```typescript
{
  concurrency: 8,  // Process 8 jobs per worker
}
```

## Monitoring with BullMQ Board

Install BullMQ Board for visual monitoring:

```bash
npm install -g @bull-board/cli
bull-board --redis redis://localhost:6379
```

Then visit: http://localhost:3000

## Troubleshooting

### Jobs stuck in "active" state
- Check worker process is running
- Verify Redis connection
- Check browser pool capacity

### High memory usage
- Reduce worker concurrency
- Lower `MAX_CONCURRENT_BROWSERS`
- Enable job cleanup (removeOnComplete/removeOnFail)

### Slow job processing
- Increase worker concurrency
- Run multiple worker instances
- Optimize browser pool settings

## Future Enhancements

- [ ] Implement MinIO/S3 storage integration
- [ ] Add webhook notifications on job completion
- [ ] Implement job scheduling (cron-like)
- [ ] Add job metrics (duration, success rate)
- [ ] Implement dead letter queue for failed jobs
- [ ] Add job deduplication
