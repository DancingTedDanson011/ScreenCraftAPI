import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// Mock BullMQ before importing any modules that use it
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation((name: string) => ({
    name,
    add: vi.fn(),
    getJob: vi.fn(),
    getJobs: vi.fn(),
    getWaitingCount: vi.fn(),
    getActiveCount: vi.fn(),
    getCompletedCount: vi.fn(),
    getFailedCount: vi.fn(),
    getDelayedCount: vi.fn(),
    clean: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
  Job: vi.fn(),
}));

// Mock the queues module
const mockScreenshotQueue = {
  name: 'screenshot',
  add: vi.fn(),
  getJob: vi.fn(),
  getJobs: vi.fn(),
  getWaitingCount: vi.fn().mockResolvedValue(5),
  getActiveCount: vi.fn().mockResolvedValue(2),
  getCompletedCount: vi.fn().mockResolvedValue(100),
  getFailedCount: vi.fn().mockResolvedValue(3),
  getDelayedCount: vi.fn().mockResolvedValue(1),
  clean: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
};

const mockPdfQueue = {
  name: 'pdf',
  add: vi.fn(),
  getJob: vi.fn(),
  getJobs: vi.fn(),
  getWaitingCount: vi.fn().mockResolvedValue(10),
  getActiveCount: vi.fn().mockResolvedValue(4),
  getCompletedCount: vi.fn().mockResolvedValue(50),
  getFailedCount: vi.fn().mockResolvedValue(2),
  getDelayedCount: vi.fn().mockResolvedValue(0),
  clean: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
};

const mockAddScreenshotJob = vi.fn();
const mockAddPdfJob = vi.fn();
const mockGetJobStatus = vi.fn();
const mockCancelJob = vi.fn();

vi.mock('../../../../src/services/queue/queues.js', () => ({
  screenshotQueue: mockScreenshotQueue,
  pdfQueue: mockPdfQueue,
  addScreenshotJob: mockAddScreenshotJob,
  addPdfJob: mockAddPdfJob,
  getJobStatus: mockGetJobStatus,
  cancelJob: mockCancelJob,
}));

vi.mock('../../../../src/services/queue/queue.config.js', () => ({
  QUEUE_NAMES: {
    SCREENSHOT: 'screenshot',
    PDF: 'pdf',
  },
  JobPriority: {
    HIGH: 1,
    NORMAL: 5,
    LOW: 10,
  },
  queueOptions: {},
  workerOptions: {},
}));

// Import after mocks are set up
import { QueueService, getQueueService } from '../../../../src/services/queue/queue.service.js';

describe('QueueService', () => {
  let queueService: QueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    queueService = new QueueService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addScreenshotJob', () => {
    it('should add a screenshot job with provided jobId', async () => {
      const jobData = {
        url: 'https://example.com',
        options: { format: 'png', fullPage: true } as any,
        jobId: 'custom-job-id',
      };
      const expectedJobId = 'custom-job-id';
      mockAddScreenshotJob.mockResolvedValue(expectedJobId);

      const result = await queueService.addScreenshotJob(jobData);

      expect(result).toBe(expectedJobId);
      expect(mockAddScreenshotJob).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
          options: { format: 'png', fullPage: true },
          jobId: 'custom-job-id',
        }),
        5 // Default NORMAL priority
      );
    });

    it('should generate jobId if not provided', async () => {
      const jobData = {
        url: 'https://example.com',
        options: { format: 'jpeg' } as any,
      };
      const generatedJobId = 'screenshot_1234567890_abc123';
      mockAddScreenshotJob.mockResolvedValue(generatedJobId);

      const result = await queueService.addScreenshotJob(jobData);

      expect(result).toBe(generatedJobId);
      expect(mockAddScreenshotJob).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
          jobId: expect.stringMatching(/^screenshot_\d+_[a-z0-9]+$/),
        }),
        5
      );
    });

    it('should use custom priority when provided', async () => {
      const jobData = {
        url: 'https://example.com',
        options: {} as any,
        jobId: 'high-priority-job',
      };
      mockAddScreenshotJob.mockResolvedValue('high-priority-job');

      await queueService.addScreenshotJob(jobData, 1); // HIGH priority

      expect(mockAddScreenshotJob).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'high-priority-job' }),
        1
      );
    });

    it('should throw error when queue operation fails', async () => {
      const jobData = {
        url: 'https://example.com',
        options: {} as any,
      };
      mockAddScreenshotJob.mockRejectedValue(new Error('Redis connection failed'));

      await expect(queueService.addScreenshotJob(jobData)).rejects.toThrow(
        'Failed to queue screenshot job: Redis connection failed'
      );
    });

    it('should handle non-Error objects in catch block', async () => {
      const jobData = {
        url: 'https://example.com',
        options: {} as any,
      };
      mockAddScreenshotJob.mockRejectedValue('Unknown error string');

      await expect(queueService.addScreenshotJob(jobData)).rejects.toThrow(
        'Failed to queue screenshot job: Unknown error'
      );
    });
  });

  describe('addPdfJob', () => {
    it('should add a PDF job with provided jobId', async () => {
      const jobData = {
        url: 'https://example.com',
        options: { format: 'A4', landscape: false } as any,
        jobId: 'pdf-job-123',
      };
      mockAddPdfJob.mockResolvedValue('pdf-job-123');

      const result = await queueService.addPdfJob(jobData);

      expect(result).toBe('pdf-job-123');
      expect(mockAddPdfJob).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
          jobId: 'pdf-job-123',
        }),
        5
      );
    });

    it('should generate jobId if not provided', async () => {
      const jobData = {
        url: 'https://example.com/document',
        options: {} as any,
      };
      mockAddPdfJob.mockResolvedValue('pdf_1234567890_xyz789');

      const result = await queueService.addPdfJob(jobData);

      expect(result).toBe('pdf_1234567890_xyz789');
      expect(mockAddPdfJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: expect.stringMatching(/^pdf_\d+_[a-z0-9]+$/),
        }),
        5
      );
    });

    it('should use LOW priority when specified', async () => {
      const jobData = {
        url: 'https://example.com',
        options: {} as any,
        jobId: 'low-priority-pdf',
      };
      mockAddPdfJob.mockResolvedValue('low-priority-pdf');

      await queueService.addPdfJob(jobData, 10);

      expect(mockAddPdfJob).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'low-priority-pdf' }),
        10
      );
    });

    it('should throw error when queue operation fails', async () => {
      const jobData = {
        url: 'https://example.com',
        options: {} as any,
      };
      mockAddPdfJob.mockRejectedValue(new Error('Queue is full'));

      await expect(queueService.addPdfJob(jobData)).rejects.toThrow(
        'Failed to queue PDF job: Queue is full'
      );
    });

    it('should handle non-Error objects in catch block', async () => {
      const jobData = {
        url: 'https://example.com',
        options: {} as any,
      };
      mockAddPdfJob.mockRejectedValue({ code: 'UNKNOWN' });

      await expect(queueService.addPdfJob(jobData)).rejects.toThrow(
        'Failed to queue PDF job: Unknown error'
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return status for screenshot job', async () => {
      const mockJob = {
        id: 'screenshot-job-1',
        attemptsMade: 1,
        timestamp: Date.now(),
      };
      mockGetJobStatus.mockResolvedValue({
        status: 'active',
        progress: 50,
        result: undefined,
        error: undefined,
      });
      mockScreenshotQueue.getJob.mockResolvedValue(mockJob);

      const result = await queueService.getJobStatus('screenshot', 'screenshot-job-1');

      expect(result).toEqual({
        id: 'screenshot-job-1',
        status: 'active',
        progress: 50,
        result: undefined,
        error: undefined,
        attempts: 1,
        timestamp: expect.any(Date),
      });
    });

    it('should return status for PDF job', async () => {
      const mockJob = {
        id: 'pdf-job-1',
        attemptsMade: 2,
        timestamp: Date.now(),
      };
      mockGetJobStatus.mockResolvedValue({
        status: 'completed',
        progress: 100,
        result: { success: true, downloadUrl: 'https://storage.example.com/file.pdf' },
        error: undefined,
      });
      mockPdfQueue.getJob.mockResolvedValue(mockJob);

      const result = await queueService.getJobStatus('pdf', 'pdf-job-1');

      expect(result).toEqual({
        id: 'pdf-job-1',
        status: 'completed',
        progress: 100,
        result: { success: true, downloadUrl: 'https://storage.example.com/file.pdf' },
        error: undefined,
        attempts: 2,
        timestamp: expect.any(Date),
      });
    });

    it('should return failed job status with error', async () => {
      const mockJob = {
        id: 'failed-job-1',
        attemptsMade: 3,
        timestamp: Date.now(),
      };
      mockGetJobStatus.mockResolvedValue({
        status: 'failed',
        progress: 30,
        result: undefined,
        error: 'Navigation timeout',
      });
      mockScreenshotQueue.getJob.mockResolvedValue(mockJob);

      const result = await queueService.getJobStatus('screenshot', 'failed-job-1');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Navigation timeout');
      expect(result.attempts).toBe(3);
    });

    it('should handle job without timestamp', async () => {
      const mockJob = {
        id: 'job-no-timestamp',
        attemptsMade: 1,
        timestamp: undefined,
      };
      mockGetJobStatus.mockResolvedValue({
        status: 'waiting',
        progress: 0,
        result: undefined,
        error: undefined,
      });
      mockScreenshotQueue.getJob.mockResolvedValue(mockJob);

      const result = await queueService.getJobStatus('screenshot', 'job-no-timestamp');

      expect(result.timestamp).toBeUndefined();
    });

    it('should throw error when job status retrieval fails', async () => {
      mockGetJobStatus.mockRejectedValue(new Error('Job not found'));

      await expect(queueService.getJobStatus('screenshot', 'non-existent')).rejects.toThrow(
        'Failed to get job status: Job not found'
      );
    });

    it('should handle non-Error objects in catch block', async () => {
      mockGetJobStatus.mockRejectedValue(null);

      await expect(queueService.getJobStatus('pdf', 'job-123')).rejects.toThrow(
        'Failed to get job status: Unknown error'
      );
    });
  });

  describe('cancelJob', () => {
    it('should cancel screenshot job', async () => {
      mockCancelJob.mockResolvedValue(undefined);

      await queueService.cancelJob('screenshot', 'job-to-cancel');

      expect(mockCancelJob).toHaveBeenCalledWith('screenshot', 'job-to-cancel');
    });

    it('should cancel PDF job', async () => {
      mockCancelJob.mockResolvedValue(undefined);

      await queueService.cancelJob('pdf', 'pdf-job-to-cancel');

      expect(mockCancelJob).toHaveBeenCalledWith('pdf', 'pdf-job-to-cancel');
    });

    it('should throw error when cancellation fails', async () => {
      mockCancelJob.mockRejectedValue(new Error('Job is already processing'));

      await expect(queueService.cancelJob('screenshot', 'active-job')).rejects.toThrow(
        'Failed to cancel job: Job is already processing'
      );
    });

    it('should handle non-Error objects in catch block', async () => {
      mockCancelJob.mockRejectedValue('Cannot cancel');

      await expect(queueService.cancelJob('pdf', 'job-123')).rejects.toThrow(
        'Failed to cancel job: Unknown error'
      );
    });
  });

  describe('retryJob', () => {
    it('should retry a failed screenshot job', async () => {
      const mockJob = {
        id: 'failed-screenshot-job',
        getState: vi.fn().mockResolvedValue('failed'),
        retry: vi.fn().mockResolvedValue(undefined),
      };
      mockScreenshotQueue.getJob.mockResolvedValue(mockJob);

      await queueService.retryJob('screenshot', 'failed-screenshot-job');

      expect(mockJob.getState).toHaveBeenCalled();
      expect(mockJob.retry).toHaveBeenCalled();
    });

    it('should retry a failed PDF job', async () => {
      const mockJob = {
        id: 'failed-pdf-job',
        getState: vi.fn().mockResolvedValue('failed'),
        retry: vi.fn().mockResolvedValue(undefined),
      };
      mockPdfQueue.getJob.mockResolvedValue(mockJob);

      await queueService.retryJob('pdf', 'failed-pdf-job');

      expect(mockJob.getState).toHaveBeenCalled();
      expect(mockJob.retry).toHaveBeenCalled();
    });

    it('should throw error when job is not found', async () => {
      mockScreenshotQueue.getJob.mockResolvedValue(null);

      await expect(queueService.retryJob('screenshot', 'non-existent')).rejects.toThrow(
        'Failed to retry job: Job non-existent not found'
      );
    });

    it('should throw error when job is not in failed state', async () => {
      const mockJob = {
        id: 'active-job',
        getState: vi.fn().mockResolvedValue('active'),
        retry: vi.fn(),
      };
      mockScreenshotQueue.getJob.mockResolvedValue(mockJob);

      await expect(queueService.retryJob('screenshot', 'active-job')).rejects.toThrow(
        'Failed to retry job: Job active-job is not in failed state. Current state: active'
      );
    });

    it('should throw error when retry operation fails', async () => {
      const mockJob = {
        id: 'failed-job',
        getState: vi.fn().mockResolvedValue('failed'),
        retry: vi.fn().mockRejectedValue(new Error('Retry limit exceeded')),
      };
      mockPdfQueue.getJob.mockResolvedValue(mockJob);

      await expect(queueService.retryJob('pdf', 'failed-job')).rejects.toThrow(
        'Failed to retry job: Retry limit exceeded'
      );
    });

    it('should handle completed state correctly', async () => {
      const mockJob = {
        id: 'completed-job',
        getState: vi.fn().mockResolvedValue('completed'),
        retry: vi.fn(),
      };
      mockScreenshotQueue.getJob.mockResolvedValue(mockJob);

      await expect(queueService.retryJob('screenshot', 'completed-job')).rejects.toThrow(
        'Job completed-job is not in failed state. Current state: completed'
      );
    });

    it('should handle waiting state correctly', async () => {
      const mockJob = {
        id: 'waiting-job',
        getState: vi.fn().mockResolvedValue('waiting'),
        retry: vi.fn(),
      };
      mockPdfQueue.getJob.mockResolvedValue(mockJob);

      await expect(queueService.retryJob('pdf', 'waiting-job')).rejects.toThrow(
        'Job waiting-job is not in failed state. Current state: waiting'
      );
    });
  });

  describe('getQueueStats', () => {
    it('should return stats for screenshot queue', async () => {
      mockScreenshotQueue.getWaitingCount.mockResolvedValue(5);
      mockScreenshotQueue.getActiveCount.mockResolvedValue(2);
      mockScreenshotQueue.getCompletedCount.mockResolvedValue(100);
      mockScreenshotQueue.getFailedCount.mockResolvedValue(3);
      mockScreenshotQueue.getDelayedCount.mockResolvedValue(1);

      const stats = await queueService.getQueueStats('screenshot');

      expect(stats).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      });
    });

    it('should return stats for PDF queue', async () => {
      mockPdfQueue.getWaitingCount.mockResolvedValue(10);
      mockPdfQueue.getActiveCount.mockResolvedValue(4);
      mockPdfQueue.getCompletedCount.mockResolvedValue(50);
      mockPdfQueue.getFailedCount.mockResolvedValue(2);
      mockPdfQueue.getDelayedCount.mockResolvedValue(0);

      const stats = await queueService.getQueueStats('pdf');

      expect(stats).toEqual({
        waiting: 10,
        active: 4,
        completed: 50,
        failed: 2,
        delayed: 0,
      });
    });

    it('should throw error when stats retrieval fails', async () => {
      mockScreenshotQueue.getWaitingCount.mockRejectedValue(new Error('Redis timeout'));

      await expect(queueService.getQueueStats('screenshot')).rejects.toThrow(
        'Failed to get queue stats: Redis timeout'
      );
    });

    it('should handle zero counts', async () => {
      mockScreenshotQueue.getWaitingCount.mockResolvedValue(0);
      mockScreenshotQueue.getActiveCount.mockResolvedValue(0);
      mockScreenshotQueue.getCompletedCount.mockResolvedValue(0);
      mockScreenshotQueue.getFailedCount.mockResolvedValue(0);
      mockScreenshotQueue.getDelayedCount.mockResolvedValue(0);

      const stats = await queueService.getQueueStats('screenshot');

      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });

    it('should handle non-Error objects in catch block', async () => {
      mockPdfQueue.getActiveCount.mockRejectedValue({ message: 'Connection lost' });

      await expect(queueService.getQueueStats('pdf')).rejects.toThrow(
        'Failed to get queue stats: Unknown error'
      );
    });
  });

  describe('getJobs', () => {
    it('should return waiting jobs from screenshot queue', async () => {
      const mockJobs = [
        { id: 'job-1', data: { url: 'https://example1.com' } },
        { id: 'job-2', data: { url: 'https://example2.com' } },
      ];
      mockScreenshotQueue.getJobs.mockResolvedValue(mockJobs);

      const jobs = await queueService.getJobs('screenshot', 'waiting');

      expect(jobs).toEqual(mockJobs);
      expect(mockScreenshotQueue.getJobs).toHaveBeenCalledWith(['waiting'], 0, 10);
    });

    it('should return completed jobs from PDF queue', async () => {
      const mockJobs = [
        { id: 'pdf-1', data: { url: 'https://doc1.com' } },
      ];
      mockPdfQueue.getJobs.mockResolvedValue(mockJobs);

      const jobs = await queueService.getJobs('pdf', 'completed');

      expect(jobs).toEqual(mockJobs);
      expect(mockPdfQueue.getJobs).toHaveBeenCalledWith(['completed'], 0, 10);
    });

    it('should respect start and end parameters', async () => {
      mockScreenshotQueue.getJobs.mockResolvedValue([]);

      await queueService.getJobs('screenshot', 'failed', 5, 20);

      expect(mockScreenshotQueue.getJobs).toHaveBeenCalledWith(['failed'], 5, 20);
    });

    it('should return active jobs', async () => {
      const mockJobs = [
        { id: 'active-1', data: { url: 'https://processing.com' } },
      ];
      mockScreenshotQueue.getJobs.mockResolvedValue(mockJobs);

      const jobs = await queueService.getJobs('screenshot', 'active', 0, 5);

      expect(jobs).toHaveLength(1);
      expect(mockScreenshotQueue.getJobs).toHaveBeenCalledWith(['active'], 0, 5);
    });

    it('should return delayed jobs', async () => {
      mockPdfQueue.getJobs.mockResolvedValue([]);

      await queueService.getJobs('pdf', 'delayed');

      expect(mockPdfQueue.getJobs).toHaveBeenCalledWith(['delayed'], 0, 10);
    });

    it('should throw error when retrieval fails', async () => {
      mockScreenshotQueue.getJobs.mockRejectedValue(new Error('Queue not available'));

      await expect(queueService.getJobs('screenshot', 'waiting')).rejects.toThrow(
        'Failed to get jobs: Queue not available'
      );
    });

    it('should handle empty result', async () => {
      mockPdfQueue.getJobs.mockResolvedValue([]);

      const jobs = await queueService.getJobs('pdf', 'failed');

      expect(jobs).toEqual([]);
    });

    it('should handle non-Error objects in catch block', async () => {
      mockScreenshotQueue.getJobs.mockRejectedValue(undefined);

      await expect(queueService.getJobs('screenshot', 'active')).rejects.toThrow(
        'Failed to get jobs: Unknown error'
      );
    });
  });

  describe('cleanQueue', () => {
    it('should clean completed and failed jobs from screenshot queue', async () => {
      mockScreenshotQueue.clean.mockImplementation((grace, limit, type) => {
        if (type === 'completed') return Promise.resolve(['job-1', 'job-2', 'job-3']);
        if (type === 'failed') return Promise.resolve(['failed-1']);
        return Promise.resolve([]);
      });

      const result = await queueService.cleanQueue('screenshot');

      expect(result).toEqual([3, 1]);
      expect(mockScreenshotQueue.clean).toHaveBeenCalledTimes(2);
      expect(mockScreenshotQueue.clean).toHaveBeenCalledWith(86400000, 1000, 'completed');
      expect(mockScreenshotQueue.clean).toHaveBeenCalledWith(86400000, 1000, 'failed');
    });

    it('should clean PDF queue with custom parameters', async () => {
      mockPdfQueue.clean.mockImplementation((grace, limit, type) => {
        if (type === 'completed') return Promise.resolve(['p1', 'p2']);
        if (type === 'failed') return Promise.resolve([]);
        return Promise.resolve([]);
      });

      const result = await queueService.cleanQueue('pdf', 3600000, 500);

      expect(result).toEqual([2, 0]);
      expect(mockPdfQueue.clean).toHaveBeenCalledWith(3600000, 500, 'completed');
      expect(mockPdfQueue.clean).toHaveBeenCalledWith(3600000, 500, 'failed');
    });

    it('should handle no jobs to clean', async () => {
      mockScreenshotQueue.clean.mockResolvedValue([]);

      const result = await queueService.cleanQueue('screenshot');

      expect(result).toEqual([0, 0]);
    });

    it('should throw error when clean operation fails', async () => {
      mockPdfQueue.clean.mockRejectedValue(new Error('Clean operation failed'));

      await expect(queueService.cleanQueue('pdf')).rejects.toThrow(
        'Failed to clean queue: Clean operation failed'
      );
    });

    it('should handle non-Error objects in catch block', async () => {
      mockScreenshotQueue.clean.mockRejectedValue(42);

      await expect(queueService.cleanQueue('screenshot')).rejects.toThrow(
        'Failed to clean queue: Unknown error'
      );
    });

    it('should use default grace period of 24 hours', async () => {
      mockScreenshotQueue.clean.mockResolvedValue([]);

      await queueService.cleanQueue('screenshot');

      expect(mockScreenshotQueue.clean).toHaveBeenCalledWith(86400000, 1000, 'completed');
    });

    it('should use default limit of 1000', async () => {
      mockPdfQueue.clean.mockResolvedValue([]);

      await queueService.cleanQueue('pdf', 7200000);

      expect(mockPdfQueue.clean).toHaveBeenCalledWith(7200000, 1000, 'completed');
    });
  });

  describe('getQueueService (Singleton)', () => {
    it('should return a QueueService instance', () => {
      const service = getQueueService();
      expect(service).toBeInstanceOf(QueueService);
    });

    it('should return the same instance on subsequent calls', () => {
      const service1 = getQueueService();
      const service2 = getQueueService();
      expect(service1).toBe(service2);
    });
  });
});

describe('QueueService - Edge Cases', () => {
  let queueService: QueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    queueService = new QueueService();
  });

  it('should handle very long job IDs', async () => {
    const longJobId = 'a'.repeat(500);
    const jobData = {
      url: 'https://example.com',
      options: {} as any,
      jobId: longJobId,
    };
    mockAddScreenshotJob.mockResolvedValue(longJobId);

    const result = await queueService.addScreenshotJob(jobData);

    expect(result).toBe(longJobId);
  });

  it('should handle URLs with special characters', async () => {
    const specialUrl = 'https://example.com/path?query=value&special=%20chars';
    const jobData = {
      url: specialUrl,
      options: {} as any,
    };
    mockAddPdfJob.mockResolvedValue('job-123');

    await queueService.addPdfJob(jobData);

    expect(mockAddPdfJob).toHaveBeenCalledWith(
      expect.objectContaining({ url: specialUrl }),
      5
    );
  });

  it('should handle concurrent job additions', async () => {
    mockAddScreenshotJob.mockImplementation((data) =>
      Promise.resolve(data.jobId)
    );

    const promises = Array.from({ length: 10 }, (_, i) =>
      queueService.addScreenshotJob({
        url: `https://example${i}.com`,
        options: {} as any,
        jobId: `concurrent-job-${i}`,
      })
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    results.forEach((result, i) => {
      expect(result).toBe(`concurrent-job-${i}`);
    });
  });

  it('should handle empty options object', async () => {
    const jobData = {
      url: 'https://example.com',
      options: {} as any,
      jobId: 'empty-options-job',
    };
    mockAddScreenshotJob.mockResolvedValue('empty-options-job');

    const result = await queueService.addScreenshotJob(jobData);

    expect(result).toBe('empty-options-job');
  });

  it('should handle options with nested objects', async () => {
    const jobData = {
      url: 'https://example.com',
      options: {
        viewport: { width: 1920, height: 1080 },
        waitOptions: { timeout: 5000, waitUntil: 'networkidle' },
        headers: { 'X-Custom': 'value' },
      } as any,
      jobId: 'nested-options-job',
    };
    mockAddScreenshotJob.mockResolvedValue('nested-options-job');

    await queueService.addScreenshotJob(jobData);

    expect(mockAddScreenshotJob).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          viewport: { width: 1920, height: 1080 },
        }),
      }),
      5
    );
  });
});

describe('QueueService - Priority Tests', () => {
  let queueService: QueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    queueService = new QueueService();
  });

  it('should accept priority value of 1 (highest)', async () => {
    mockAddScreenshotJob.mockResolvedValue('high-priority');

    await queueService.addScreenshotJob(
      { url: 'https://example.com', options: {} as any, jobId: 'high' },
      1
    );

    expect(mockAddScreenshotJob).toHaveBeenCalledWith(
      expect.anything(),
      1
    );
  });

  it('should accept priority value of 10 (lowest)', async () => {
    mockAddPdfJob.mockResolvedValue('low-priority');

    await queueService.addPdfJob(
      { url: 'https://example.com', options: {} as any, jobId: 'low' },
      10
    );

    expect(mockAddPdfJob).toHaveBeenCalledWith(
      expect.anything(),
      10
    );
  });

  it('should default to priority 5 (NORMAL)', async () => {
    mockAddScreenshotJob.mockResolvedValue('default-priority');

    await queueService.addScreenshotJob({
      url: 'https://example.com',
      options: {} as any,
    });

    expect(mockAddScreenshotJob).toHaveBeenCalledWith(
      expect.anything(),
      5
    );
  });
});
