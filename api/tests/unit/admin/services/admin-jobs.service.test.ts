import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Prisma client
const mockPrisma = {
  screenshot: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  pdf: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

// Mock Queue Service
const mockQueueService = {
  cancelJob: vi.fn(),
  retryJob: vi.fn(),
};

vi.mock('../../../../src/lib/db.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../../src/services/queue/queue.service.js', () => ({
  queueService: mockQueueService,
}));

// Import after mocking
const { AdminJobsService } = await import(
  '../../../../src/admin/services/admin-jobs.service.js'
);

describe('AdminJobsService', () => {
  let service: InstanceType<typeof AdminJobsService>;

  // Test fixtures
  const mockScreenshot = {
    id: 'screenshot-123',
    accountId: 'account-123',
    url: 'https://example.com',
    status: 'COMPLETED',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    completedAt: new Date('2024-01-15T10:00:05Z'),
    error: null,
  };

  const mockPdf = {
    id: 'pdf-456',
    accountId: 'account-456',
    url: 'https://example.com/page',
    status: 'COMPLETED',
    createdAt: new Date('2024-01-15T11:00:00Z'),
    completedAt: new Date('2024-01-15T11:00:10Z'),
    error: null,
  };

  const mockFailedScreenshot = {
    id: 'screenshot-failed',
    accountId: 'account-789',
    url: 'https://invalid-url.com',
    status: 'FAILED',
    createdAt: new Date('2024-01-15T12:00:00Z'),
    completedAt: new Date('2024-01-15T12:00:30Z'),
    error: 'Navigation timeout',
  };

  const mockPendingPdf = {
    id: 'pdf-pending',
    accountId: 'account-111',
    url: 'https://pending.com',
    status: 'PENDING',
    createdAt: new Date('2024-01-15T13:00:00Z'),
    completedAt: null,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminJobsService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listJobs', () => {
    it('should return combined screenshot and PDF jobs when type is all', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(5);
      mockPrisma.screenshot.findMany.mockResolvedValue([mockScreenshot]);
      mockPrisma.pdf.count.mockResolvedValue(3);
      mockPrisma.pdf.findMany.mockResolvedValue([mockPdf]);

      const result = await service.listJobs({ page: 1, limit: 20, type: 'all' });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(8); // 5 + 3
      expect(result.data[0].type).toBeDefined();
    });

    it('should return only screenshots when type is screenshot', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(10);
      mockPrisma.screenshot.findMany.mockResolvedValue([mockScreenshot, mockFailedScreenshot]);

      const result = await service.listJobs({
        page: 1,
        limit: 20,
        type: 'screenshot',
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((job) => job.type === 'screenshot')).toBe(true);
      expect(result.pagination.total).toBe(10);
      expect(mockPrisma.pdf.count).not.toHaveBeenCalled();
      expect(mockPrisma.pdf.findMany).not.toHaveBeenCalled();
    });

    it('should return only PDFs when type is pdf', async () => {
      mockPrisma.pdf.count.mockResolvedValue(5);
      mockPrisma.pdf.findMany.mockResolvedValue([mockPdf, mockPendingPdf]);

      const result = await service.listJobs({ page: 1, limit: 20, type: 'pdf' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((job) => job.type === 'pdf')).toBe(true);
      expect(result.pagination.total).toBe(5);
      expect(mockPrisma.screenshot.count).not.toHaveBeenCalled();
      expect(mockPrisma.screenshot.findMany).not.toHaveBeenCalled();
    });

    it('should apply status filter', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(1);
      mockPrisma.screenshot.findMany.mockResolvedValue([mockFailedScreenshot]);
      mockPrisma.pdf.count.mockResolvedValue(0);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      await service.listJobs({
        page: 1,
        limit: 20,
        type: 'all',
        status: 'FAILED',
      });

      expect(mockPrisma.screenshot.count).toHaveBeenCalledWith({
        where: { status: 'FAILED' },
      });
      expect(mockPrisma.pdf.count).toHaveBeenCalledWith({
        where: { status: 'FAILED' },
      });
    });

    it('should apply accountId filter', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(1);
      mockPrisma.screenshot.findMany.mockResolvedValue([mockScreenshot]);
      mockPrisma.pdf.count.mockResolvedValue(0);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      await service.listJobs({
        page: 1,
        limit: 20,
        type: 'all',
        accountId: 'account-123',
      });

      expect(mockPrisma.screenshot.count).toHaveBeenCalledWith({
        where: { accountId: 'account-123' },
      });
      expect(mockPrisma.pdf.count).toHaveBeenCalledWith({
        where: { accountId: 'account-123' },
      });
    });

    it('should apply search filter on URL', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(1);
      mockPrisma.screenshot.findMany.mockResolvedValue([mockScreenshot]);
      mockPrisma.pdf.count.mockResolvedValue(0);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      await service.listJobs({
        page: 1,
        limit: 20,
        type: 'all',
        search: 'example.com',
      });

      expect(mockPrisma.screenshot.count).toHaveBeenCalledWith({
        where: { url: { contains: 'example.com', mode: 'insensitive' } },
      });
    });

    it('should handle pagination for specific job type', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(50);
      mockPrisma.screenshot.findMany.mockResolvedValue([mockScreenshot]);

      const result = await service.listJobs({
        page: 3,
        limit: 10,
        type: 'screenshot',
      });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        })
      );
      expect(result.pagination.totalPages).toBe(5);
    });

    it('should sort jobs by createdAt desc by default', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(2);
      mockPrisma.screenshot.findMany.mockResolvedValue([mockScreenshot, mockFailedScreenshot]);
      mockPrisma.pdf.count.mockResolvedValue(0);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      await service.listJobs({ page: 1, limit: 20, type: 'screenshot' });

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should transform jobs to correct response format', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(1);
      mockPrisma.screenshot.findMany.mockResolvedValue([mockScreenshot]);
      mockPrisma.pdf.count.mockResolvedValue(0);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      const result = await service.listJobs({
        page: 1,
        limit: 20,
        type: 'screenshot',
      });

      expect(result.data[0]).toEqual({
        id: 'screenshot-123',
        type: 'screenshot',
        status: 'COMPLETED',
        accountId: 'account-123',
        url: 'https://example.com',
        createdAt: mockScreenshot.createdAt,
        completedAt: mockScreenshot.completedAt,
        error: null,
      });
    });

    it('should sort combined results by createdAt when type is all', async () => {
      const newerScreenshot = {
        ...mockScreenshot,
        createdAt: new Date('2024-01-16T10:00:00Z'),
      };
      const olderPdf = { ...mockPdf, createdAt: new Date('2024-01-14T10:00:00Z') };

      mockPrisma.screenshot.count.mockResolvedValue(1);
      mockPrisma.screenshot.findMany.mockResolvedValue([newerScreenshot]);
      mockPrisma.pdf.count.mockResolvedValue(1);
      mockPrisma.pdf.findMany.mockResolvedValue([olderPdf]);

      const result = await service.listJobs({
        page: 1,
        limit: 20,
        type: 'all',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      // Newer should come first
      expect(result.data[0].type).toBe('screenshot');
      expect(result.data[1].type).toBe('pdf');
    });

    it('should limit combined results to requested limit', async () => {
      const screenshots = Array(10)
        .fill(null)
        .map((_, i) => ({
          ...mockScreenshot,
          id: `screenshot-${i}`,
        }));
      const pdfs = Array(10)
        .fill(null)
        .map((_, i) => ({ ...mockPdf, id: `pdf-${i}` }));

      mockPrisma.screenshot.count.mockResolvedValue(10);
      mockPrisma.screenshot.findMany.mockResolvedValue(screenshots);
      mockPrisma.pdf.count.mockResolvedValue(10);
      mockPrisma.pdf.findMany.mockResolvedValue(pdfs);

      const result = await service.listJobs({ page: 1, limit: 5, type: 'all' });

      expect(result.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getJob', () => {
    it('should return screenshot job details', async () => {
      mockPrisma.screenshot.findUnique.mockResolvedValue({
        ...mockScreenshot,
        account: { email: 'test@example.com', tier: 'PRO' },
      });

      const result = await service.getJob('screenshot-123', 'screenshot');

      expect(result).not.toBeNull();
      expect(result.id).toBe('screenshot-123');
      expect(result.account.email).toBe('test@example.com');
      expect(mockPrisma.screenshot.findUnique).toHaveBeenCalledWith({
        where: { id: 'screenshot-123' },
        include: {
          account: {
            select: {
              email: true,
              tier: true,
            },
          },
        },
      });
    });

    it('should return PDF job details', async () => {
      mockPrisma.pdf.findUnique.mockResolvedValue({
        ...mockPdf,
        account: { email: 'test@example.com', tier: 'FREE' },
      });

      const result = await service.getJob('pdf-456', 'pdf');

      expect(result).not.toBeNull();
      expect(result.id).toBe('pdf-456');
      expect(mockPrisma.pdf.findUnique).toHaveBeenCalledWith({
        where: { id: 'pdf-456' },
        include: {
          account: {
            select: {
              email: true,
              tier: true,
            },
          },
        },
      });
    });

    it('should return null for non-existent job', async () => {
      mockPrisma.screenshot.findUnique.mockResolvedValue(null);

      const result = await service.getJob('nonexistent', 'screenshot');

      expect(result).toBeNull();
    });
  });

  describe('cancelJob', () => {
    it('should cancel screenshot job and update database', async () => {
      mockQueueService.cancelJob.mockResolvedValue(undefined);
      mockPrisma.screenshot.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.cancelJob('screenshot-123', 'screenshot', 'admin-001');

      expect(mockQueueService.cancelJob).toHaveBeenCalledWith(
        'screenshot',
        'screenshot-123'
      );
      expect(mockPrisma.screenshot.update).toHaveBeenCalledWith({
        where: { id: 'screenshot-123' },
        data: {
          status: 'FAILED',
          error: 'Cancelled by admin',
          completedAt: expect.any(Date),
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-001',
          action: 'CANCEL_JOB',
          targetType: 'screenshot',
          targetId: 'screenshot-123',
        },
      });
    });

    it('should cancel PDF job and update database', async () => {
      mockQueueService.cancelJob.mockResolvedValue(undefined);
      mockPrisma.pdf.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.cancelJob('pdf-456', 'pdf', 'admin-001');

      expect(mockQueueService.cancelJob).toHaveBeenCalledWith('pdf', 'pdf-456');
      expect(mockPrisma.pdf.update).toHaveBeenCalledWith({
        where: { id: 'pdf-456' },
        data: {
          status: 'FAILED',
          error: 'Cancelled by admin',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should update database even if queue cancel fails', async () => {
      mockQueueService.cancelJob.mockRejectedValue(new Error('Job not in queue'));
      mockPrisma.screenshot.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      // Should not throw
      await service.cancelJob('screenshot-123', 'screenshot', 'admin-001');

      expect(mockPrisma.screenshot.update).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('retryJob', () => {
    it('should retry a failed screenshot job', async () => {
      mockPrisma.screenshot.findUnique.mockResolvedValue(mockFailedScreenshot);
      mockQueueService.retryJob.mockResolvedValue(undefined);
      mockPrisma.screenshot.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.retryJob(
        'screenshot-failed',
        'screenshot',
        'admin-001'
      );

      expect(result).toBe('screenshot-failed');
      expect(mockQueueService.retryJob).toHaveBeenCalledWith(
        'screenshot',
        'screenshot-failed'
      );
      expect(mockPrisma.screenshot.update).toHaveBeenCalledWith({
        where: { id: 'screenshot-failed' },
        data: {
          status: 'PENDING',
          error: null,
          completedAt: null,
        },
      });
    });

    it('should retry a failed PDF job', async () => {
      const failedPdf = { ...mockPdf, status: 'FAILED', error: 'Timeout' };
      mockPrisma.pdf.findUnique.mockResolvedValue(failedPdf);
      mockQueueService.retryJob.mockResolvedValue(undefined);
      mockPrisma.pdf.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.retryJob('pdf-456', 'pdf', 'admin-001');

      expect(result).toBe('pdf-456');
      expect(mockPrisma.pdf.update).toHaveBeenCalledWith({
        where: { id: 'pdf-456' },
        data: {
          status: 'PENDING',
          error: null,
          completedAt: null,
        },
      });
    });

    it('should throw error for non-existent job', async () => {
      mockPrisma.screenshot.findUnique.mockResolvedValue(null);

      await expect(
        service.retryJob('nonexistent', 'screenshot', 'admin-001')
      ).rejects.toThrow('Job not found');
    });

    it('should throw error for non-failed job', async () => {
      mockPrisma.screenshot.findUnique.mockResolvedValue(mockScreenshot); // COMPLETED status

      await expect(
        service.retryJob('screenshot-123', 'screenshot', 'admin-001')
      ).rejects.toThrow('Only failed jobs can be retried');
    });

    it('should throw error if queue retry fails', async () => {
      mockPrisma.screenshot.findUnique.mockResolvedValue(mockFailedScreenshot);
      mockQueueService.retryJob.mockRejectedValue(new Error('Queue error'));

      await expect(
        service.retryJob('screenshot-failed', 'screenshot', 'admin-001')
      ).rejects.toThrow('Failed to retry job: Queue error');
    });

    it('should create audit log for retry', async () => {
      mockPrisma.pdf.findUnique.mockResolvedValue({
        ...mockPdf,
        status: 'FAILED',
      });
      mockQueueService.retryJob.mockResolvedValue(undefined);
      mockPrisma.pdf.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.retryJob('pdf-456', 'pdf', 'admin-001');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-001',
          action: 'RETRY_JOB',
          targetType: 'pdf',
          targetId: 'pdf-456',
        },
      });
    });
  });

  describe('deleteJob', () => {
    it('should delete screenshot job and create audit log', async () => {
      mockPrisma.screenshot.delete.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.deleteJob('screenshot-123', 'screenshot', 'admin-001');

      expect(mockPrisma.screenshot.delete).toHaveBeenCalledWith({
        where: { id: 'screenshot-123' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-001',
          action: 'DELETE_JOB',
          targetType: 'screenshot',
          targetId: 'screenshot-123',
        },
      });
    });

    it('should delete PDF job and create audit log', async () => {
      mockPrisma.pdf.delete.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.deleteJob('pdf-456', 'pdf', 'admin-001');

      expect(mockPrisma.pdf.delete).toHaveBeenCalledWith({
        where: { id: 'pdf-456' },
      });
    });
  });

  describe('getJobStats', () => {
    it('should return job statistics for both queues', async () => {
      mockPrisma.screenshot.count
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(5) // processing
        .mockResolvedValueOnce(100) // completed
        .mockResolvedValueOnce(15); // failed

      mockPrisma.pdf.count
        .mockResolvedValueOnce(8) // pending
        .mockResolvedValueOnce(3) // processing
        .mockResolvedValueOnce(80) // completed
        .mockResolvedValueOnce(12); // failed

      const result = await service.getJobStats();

      expect(result.screenshot).toEqual({
        pending: 10,
        processing: 5,
        completed: 100,
        failed: 15,
        total: 130,
      });
      expect(result.pdf).toEqual({
        pending: 8,
        processing: 3,
        completed: 80,
        failed: 12,
        total: 103,
      });
    });

    it('should query with correct status filters', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(0);
      mockPrisma.pdf.count.mockResolvedValue(0);

      await service.getJobStats();

      expect(mockPrisma.screenshot.count).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
      });
      expect(mockPrisma.screenshot.count).toHaveBeenCalledWith({
        where: { status: 'PROCESSING' },
      });
      expect(mockPrisma.screenshot.count).toHaveBeenCalledWith({
        where: { status: 'COMPLETED' },
      });
      expect(mockPrisma.screenshot.count).toHaveBeenCalledWith({
        where: { status: 'FAILED' },
      });
    });

    it('should handle zero counts', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(0);
      mockPrisma.pdf.count.mockResolvedValue(0);

      const result = await service.getJobStats();

      expect(result.screenshot.total).toBe(0);
      expect(result.pdf.total).toBe(0);
    });
  });

  describe('cleanOldJobs', () => {
    it('should delete old completed and failed jobs', async () => {
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 50 });
      mockPrisma.pdf.deleteMany.mockResolvedValue({ count: 30 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.cleanOldJobs(30, 'admin-001');

      expect(result).toEqual({
        screenshots: 50,
        pdfs: 30,
      });
    });

    it('should use correct cutoff date', async () => {
      const now = new Date('2024-02-15T12:00:00Z');
      vi.setSystemTime(now);

      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.pdf.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.cleanOldJobs(30, 'admin-001');

      const expectedCutoff = new Date('2024-01-16T12:00:00Z');

      expect(mockPrisma.screenshot.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          completedAt: { lt: expect.any(Date) },
        },
      });

      const call = mockPrisma.screenshot.deleteMany.mock.calls[0][0];
      const actualCutoff = call.where.completedAt.lt;
      expect(actualCutoff.getTime()).toBeCloseTo(expectedCutoff.getTime(), -4);

      vi.useRealTimers();
    });

    it('should create audit log with details', async () => {
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 25 });
      mockPrisma.pdf.deleteMany.mockResolvedValue({ count: 15 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.cleanOldJobs(7, 'admin-001');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-001',
          action: 'CLEAN_OLD_JOBS',
          details: {
            olderThanDays: 7,
            deletedScreenshots: 25,
            deletedPdfs: 15,
          },
        },
      });
    });

    it('should only delete COMPLETED and FAILED jobs', async () => {
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.pdf.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.cleanOldJobs(30, 'admin-001');

      expect(mockPrisma.screenshot.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          completedAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty job list', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(0);
      mockPrisma.screenshot.findMany.mockResolvedValue([]);
      mockPrisma.pdf.count.mockResolvedValue(0);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      const result = await service.listJobs({ page: 1, limit: 20, type: 'all' });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should handle job with null url', async () => {
      const jobWithNullUrl = { ...mockScreenshot, url: null };
      mockPrisma.screenshot.count.mockResolvedValue(1);
      mockPrisma.screenshot.findMany.mockResolvedValue([jobWithNullUrl]);

      const result = await service.listJobs({
        page: 1,
        limit: 20,
        type: 'screenshot',
      });

      expect(result.data[0].url).toBeNull();
    });

    it('should handle job with null completedAt', async () => {
      mockPrisma.pdf.count.mockResolvedValue(1);
      mockPrisma.pdf.findMany.mockResolvedValue([mockPendingPdf]);

      const result = await service.listJobs({ page: 1, limit: 20, type: 'pdf' });

      expect(result.data[0].completedAt).toBeNull();
    });

    it('should handle combined filters', async () => {
      mockPrisma.screenshot.count.mockResolvedValue(1);
      mockPrisma.screenshot.findMany.mockResolvedValue([mockFailedScreenshot]);
      mockPrisma.pdf.count.mockResolvedValue(0);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      await service.listJobs({
        page: 1,
        limit: 20,
        type: 'all',
        status: 'FAILED',
        accountId: 'account-789',
        search: 'invalid',
      });

      expect(mockPrisma.screenshot.count).toHaveBeenCalledWith({
        where: {
          status: 'FAILED',
          accountId: 'account-789',
          url: { contains: 'invalid', mode: 'insensitive' },
        },
      });
    });
  });

  describe('Audit Trail', () => {
    it('should record admin ID in all operations', async () => {
      const adminId = 'admin-super';

      // Setup mocks
      mockPrisma.screenshot.findUnique.mockResolvedValue(mockFailedScreenshot);
      mockQueueService.retryJob.mockResolvedValue(undefined);
      mockQueueService.cancelJob.mockResolvedValue(undefined);
      mockPrisma.screenshot.update.mockResolvedValue({});
      mockPrisma.screenshot.delete.mockResolvedValue({});
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.pdf.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.cancelJob('job-1', 'screenshot', adminId);
      await service.retryJob('screenshot-failed', 'screenshot', adminId);
      await service.deleteJob('job-3', 'screenshot', adminId);
      await service.cleanOldJobs(30, adminId);

      const auditCalls = mockPrisma.auditLog.create.mock.calls;
      expect(auditCalls).toHaveLength(4);
      auditCalls.forEach((call) => {
        expect(call[0].data.adminId).toBe(adminId);
      });
    });

    it('should record correct actions for each operation', async () => {
      mockPrisma.screenshot.findUnique.mockResolvedValue(mockFailedScreenshot);
      mockQueueService.retryJob.mockResolvedValue(undefined);
      mockQueueService.cancelJob.mockResolvedValue(undefined);
      mockPrisma.screenshot.update.mockResolvedValue({});
      mockPrisma.screenshot.delete.mockResolvedValue({});
      mockPrisma.screenshot.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.pdf.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.cancelJob('job-1', 'screenshot', 'admin-001');
      await service.retryJob('screenshot-failed', 'screenshot', 'admin-001');
      await service.deleteJob('job-3', 'screenshot', 'admin-001');
      await service.cleanOldJobs(30, 'admin-001');

      const actions = mockPrisma.auditLog.create.mock.calls.map(
        (call) => call[0].data.action
      );
      expect(actions).toContain('CANCEL_JOB');
      expect(actions).toContain('RETRY_JOB');
      expect(actions).toContain('DELETE_JOB');
      expect(actions).toContain('CLEAN_OLD_JOBS');
    });
  });
});
