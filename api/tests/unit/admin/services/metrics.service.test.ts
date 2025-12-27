// Metrics Service Unit Tests
// Tests system metrics collection and aggregation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetricsService, getMetricsService } from '../../../../src/admin/services/metrics.service.js';
import os from 'node:os';

// Mock Node.js os module
vi.mock('node:os', () => ({
  default: {
    cpus: vi.fn(),
    totalmem: vi.fn(),
    freemem: vi.fn(),
    uptime: vi.fn(),
    platform: vi.fn(),
    hostname: vi.fn(),
  },
}));

// Mock browser pool
vi.mock('../../../../src/services/browser-pool/browser-pool.service.js', () => ({
  getBrowserPool: vi.fn(),
}));

// Mock queue service
vi.mock('../../../../src/services/queue/queue.service.js', () => ({
  queueService: {
    getQueueStats: vi.fn(),
  },
}));

// Mock Prisma client
vi.mock('../../../../src/lib/db.js', () => ({
  prisma: {
    account: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    apiKey: {
      count: vi.fn(),
    },
    screenshot: {
      count: vi.fn(),
    },
    pdf: {
      count: vi.fn(),
    },
    subscription: {
      count: vi.fn(),
    },
  },
}));

// Import mocks after vi.mock
import { getBrowserPool } from '../../../../src/services/browser-pool/browser-pool.service.js';
import { queueService } from '../../../../src/services/queue/queue.service.js';
import { prisma } from '../../../../src/lib/db.js';

describe('MetricsService', () => {
  let service: MetricsService;

  // Mock CPU data
  const mockCpuData = [
    {
      model: 'Intel Core i7',
      speed: 2800,
      times: { user: 1000, nice: 0, sys: 500, idle: 8000, irq: 50 },
    },
    {
      model: 'Intel Core i7',
      speed: 2800,
      times: { user: 1200, nice: 0, sys: 600, idle: 7500, irq: 40 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup default OS mocks
    vi.mocked(os.cpus).mockReturnValue(mockCpuData);
    vi.mocked(os.totalmem).mockReturnValue(16 * 1024 * 1024 * 1024); // 16GB
    vi.mocked(os.freemem).mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB free
    vi.mocked(os.uptime).mockReturnValue(86400); // 1 day
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(os.hostname).mockReturnValue('test-server');

    // Create fresh service instance for each test
    service = new MetricsService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ============================================
  // getServerMetrics Tests
  // ============================================
  describe('getServerMetrics', () => {
    it('should return server metrics with correct memory calculation', () => {
      const metrics = service.getServerMetrics();

      expect(metrics.memory.total).toBe(16 * 1024 * 1024 * 1024);
      expect(metrics.memory.used).toBe(8 * 1024 * 1024 * 1024);
      expect(metrics.memory.percentage).toBe(50);
    });

    it('should return correct uptime in seconds', () => {
      vi.mocked(os.uptime).mockReturnValue(7200); // 2 hours

      const metrics = service.getServerMetrics();

      expect(metrics.uptime).toBe(7200);
    });

    it('should return correct platform and hostname', () => {
      vi.mocked(os.platform).mockReturnValue('darwin');
      vi.mocked(os.hostname).mockReturnValue('macbook-pro');

      const metrics = service.getServerMetrics();

      expect(metrics.platform).toBe('darwin');
      expect(metrics.hostname).toBe('macbook-pro');
    });

    it('should include Node version and process ID', () => {
      const metrics = service.getServerMetrics();

      expect(metrics.nodeVersion).toBe(process.version);
      expect(metrics.pid).toBe(process.pid);
    });

    it('should return 0 for first CPU measurement', () => {
      const metrics = service.getServerMetrics();

      // First measurement should be 0 as there's no previous data
      expect(metrics.cpu).toBe(0);
    });

    it('should calculate CPU usage on subsequent calls', () => {
      // First call initializes
      service.getServerMetrics();

      // Advance time to trigger CPU tracking
      vi.advanceTimersByTime(5000);

      // Update CPU data to simulate usage
      vi.mocked(os.cpus).mockReturnValue([
        {
          model: 'Intel Core i7',
          speed: 2800,
          times: { user: 2000, nice: 0, sys: 1000, idle: 9000, irq: 100 },
        },
        {
          model: 'Intel Core i7',
          speed: 2800,
          times: { user: 2200, nice: 0, sys: 1100, idle: 8500, irq: 90 },
        },
      ]);

      const metrics = service.getServerMetrics();

      // CPU value should be present (not zero if history is populated)
      expect(typeof metrics.cpu).toBe('number');
    });

    it('should handle 100% memory usage', () => {
      vi.mocked(os.totalmem).mockReturnValue(16 * 1024 * 1024 * 1024);
      vi.mocked(os.freemem).mockReturnValue(0);

      const metrics = service.getServerMetrics();

      expect(metrics.memory.percentage).toBe(100);
      expect(metrics.memory.used).toBe(16 * 1024 * 1024 * 1024);
    });

    it('should floor uptime to integer', () => {
      vi.mocked(os.uptime).mockReturnValue(12345.789);

      const metrics = service.getServerMetrics();

      expect(metrics.uptime).toBe(12345);
    });
  });

  // ============================================
  // getBrowserPoolMetrics Tests
  // ============================================
  describe('getBrowserPoolMetrics', () => {
    it('should return browser pool metrics', async () => {
      const mockStats = {
        totalBrowsers: 5,
        activeBrowsers: 3,
        totalContexts: 15,
        activeContexts: 8,
        averageContextsPerBrowser: 3.5,
        oldestBrowserAge: 3600000,
        totalUsageCount: 1250,
      };

      vi.mocked(getBrowserPool).mockReturnValue({
        getStats: () => mockStats,
      } as any);

      const metrics = await service.getBrowserPoolMetrics();

      expect(metrics.totalBrowsers).toBe(5);
      expect(metrics.activeBrowsers).toBe(3);
      expect(metrics.totalContexts).toBe(15);
      expect(metrics.activeContexts).toBe(8);
      expect(metrics.averageContextsPerBrowser).toBe(3.5);
      expect(metrics.oldestBrowserAge).toBe(3600000);
      expect(metrics.totalUsageCount).toBe(1250);
    });

    it('should round averageContextsPerBrowser to 2 decimal places', async () => {
      const mockStats = {
        totalBrowsers: 3,
        activeBrowsers: 2,
        totalContexts: 10,
        activeContexts: 5,
        averageContextsPerBrowser: 3.33333333,
        oldestBrowserAge: 1000,
        totalUsageCount: 100,
      };

      vi.mocked(getBrowserPool).mockReturnValue({
        getStats: () => mockStats,
      } as any);

      const metrics = await service.getBrowserPoolMetrics();

      expect(metrics.averageContextsPerBrowser).toBe(3.33);
    });

    it('should return zeros when browser pool throws error', async () => {
      vi.mocked(getBrowserPool).mockImplementation(() => {
        throw new Error('Pool not initialized');
      });

      const metrics = await service.getBrowserPoolMetrics();

      expect(metrics).toEqual({
        totalBrowsers: 0,
        activeBrowsers: 0,
        totalContexts: 0,
        activeContexts: 0,
        averageContextsPerBrowser: 0,
        oldestBrowserAge: 0,
        totalUsageCount: 0,
      });
    });

    it('should handle browser pool getStats throwing error', async () => {
      vi.mocked(getBrowserPool).mockReturnValue({
        getStats: () => {
          throw new Error('Stats unavailable');
        },
      } as any);

      const metrics = await service.getBrowserPoolMetrics();

      expect(metrics.totalBrowsers).toBe(0);
      expect(metrics.activeBrowsers).toBe(0);
    });
  });

  // ============================================
  // getQueueMetrics Tests
  // ============================================
  describe('getQueueMetrics', () => {
    it('should return screenshot queue metrics', async () => {
      const mockStats = {
        waiting: 10,
        active: 5,
        completed: 1000,
        failed: 25,
        delayed: 3,
      };

      vi.mocked(queueService.getQueueStats).mockResolvedValue(mockStats);

      const metrics = await service.getQueueMetrics('screenshot');

      expect(queueService.getQueueStats).toHaveBeenCalledWith('screenshot');
      expect(metrics).toEqual(mockStats);
    });

    it('should return pdf queue metrics', async () => {
      const mockStats = {
        waiting: 5,
        active: 2,
        completed: 500,
        failed: 10,
        delayed: 1,
      };

      vi.mocked(queueService.getQueueStats).mockResolvedValue(mockStats);

      const metrics = await service.getQueueMetrics('pdf');

      expect(queueService.getQueueStats).toHaveBeenCalledWith('pdf');
      expect(metrics).toEqual(mockStats);
    });

    it('should return zeros when queue service throws error', async () => {
      vi.mocked(queueService.getQueueStats).mockRejectedValue(
        new Error('Queue not available')
      );

      const metrics = await service.getQueueMetrics('screenshot');

      expect(metrics).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });
  });

  // ============================================
  // getAllQueueMetrics Tests
  // ============================================
  describe('getAllQueueMetrics', () => {
    it('should return metrics for both queues', async () => {
      const screenshotStats = {
        waiting: 10,
        active: 5,
        completed: 1000,
        failed: 25,
        delayed: 3,
      };

      const pdfStats = {
        waiting: 5,
        active: 2,
        completed: 500,
        failed: 10,
        delayed: 1,
      };

      vi.mocked(queueService.getQueueStats)
        .mockResolvedValueOnce(screenshotStats)
        .mockResolvedValueOnce(pdfStats);

      const metrics = await service.getAllQueueMetrics();

      expect(metrics.screenshot).toEqual(screenshotStats);
      expect(metrics.pdf).toEqual(pdfStats);
    });

    it('should handle partial failures gracefully', async () => {
      vi.mocked(queueService.getQueueStats)
        .mockResolvedValueOnce({
          waiting: 10,
          active: 5,
          completed: 1000,
          failed: 25,
          delayed: 3,
        })
        .mockRejectedValueOnce(new Error('PDF queue error'));

      const metrics = await service.getAllQueueMetrics();

      expect(metrics.screenshot.waiting).toBe(10);
      expect(metrics.pdf).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });
  });

  // ============================================
  // getOverviewMetrics Tests
  // ============================================
  describe('getOverviewMetrics', () => {
    beforeEach(() => {
      vi.mocked(getBrowserPool).mockReturnValue({
        getStats: () => ({
          totalBrowsers: 3,
          activeBrowsers: 2,
          totalContexts: 9,
          activeContexts: 4,
          averageContextsPerBrowser: 3.0,
          oldestBrowserAge: 1000,
          totalUsageCount: 100,
        }),
      } as any);

      vi.mocked(queueService.getQueueStats).mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 5,
        delayed: 0,
      });
    });

    it('should return combined overview metrics', async () => {
      const overview = await service.getOverviewMetrics();

      expect(overview.server).toBeDefined();
      expect(overview.browser).toBeDefined();
      expect(overview.queue).toBeDefined();
      expect(overview.timestamp).toBeDefined();
    });

    it('should include ISO timestamp', async () => {
      const overview = await service.getOverviewMetrics();

      expect(() => new Date(overview.timestamp)).not.toThrow();
      expect(overview.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include queue metrics for both queues', async () => {
      const overview = await service.getOverviewMetrics();

      expect(overview.queue.screenshot).toBeDefined();
      expect(overview.queue.pdf).toBeDefined();
    });
  });

  // ============================================
  // getCpuHistory Tests
  // ============================================
  describe('getCpuHistory', () => {
    it('should return empty array initially', () => {
      const history = service.getCpuHistory();

      expect(history).toEqual([]);
    });

    it('should return copy of history array', () => {
      const history1 = service.getCpuHistory();
      const history2 = service.getCpuHistory();

      expect(history1).not.toBe(history2);
    });

    it('should accumulate CPU history over time', () => {
      // Advance timer multiple times to collect CPU samples
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(5000);
      }

      const history = service.getCpuHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history.length).toBeLessThanOrEqual(60);
    });

    it('should maintain max 60 samples in history', () => {
      // Advance timer 65 times (5 minutes + extra)
      for (let i = 0; i < 65; i++) {
        vi.advanceTimersByTime(5000);
      }

      const history = service.getCpuHistory();

      expect(history.length).toBeLessThanOrEqual(60);
    });
  });

  // ============================================
  // getDatabaseStats Tests
  // ============================================
  describe('getDatabaseStats', () => {
    it('should return all database counts', async () => {
      vi.mocked(prisma.account.count).mockResolvedValue(100);
      vi.mocked(prisma.apiKey.count).mockResolvedValue(250);
      vi.mocked(prisma.screenshot.count).mockResolvedValue(5000);
      vi.mocked(prisma.pdf.count).mockResolvedValue(2500);
      vi.mocked(prisma.subscription.count).mockResolvedValue(30);

      const stats = await service.getDatabaseStats();

      expect(stats).toEqual({
        accounts: 100,
        apiKeys: 250,
        screenshots: 5000,
        pdfs: 2500,
        activeSubscriptions: 30,
      });
    });

    it('should only count active API keys', async () => {
      vi.mocked(prisma.account.count).mockResolvedValue(10);
      vi.mocked(prisma.apiKey.count).mockResolvedValue(25);
      vi.mocked(prisma.screenshot.count).mockResolvedValue(100);
      vi.mocked(prisma.pdf.count).mockResolvedValue(50);
      vi.mocked(prisma.subscription.count).mockResolvedValue(5);

      await service.getDatabaseStats();

      expect(prisma.apiKey.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it('should only count active subscriptions', async () => {
      vi.mocked(prisma.account.count).mockResolvedValue(10);
      vi.mocked(prisma.apiKey.count).mockResolvedValue(25);
      vi.mocked(prisma.screenshot.count).mockResolvedValue(100);
      vi.mocked(prisma.pdf.count).mockResolvedValue(50);
      vi.mocked(prisma.subscription.count).mockResolvedValue(5);

      await service.getDatabaseStats();

      expect(prisma.subscription.count).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
    });
  });

  // ============================================
  // getRecentActivityStats Tests
  // ============================================
  describe('getRecentActivityStats', () => {
    it('should return activity stats for default 24 hours', async () => {
      vi.mocked(prisma.screenshot.count).mockResolvedValue(50);
      vi.mocked(prisma.pdf.count).mockResolvedValue(25);
      vi.mocked(prisma.account.count).mockResolvedValue(5);
      vi.mocked(prisma.apiKey.count).mockResolvedValue(10);

      const stats = await service.getRecentActivityStats();

      expect(stats).toEqual({
        screenshotsCreated: 50,
        pdfsCreated: 25,
        newAccounts: 5,
        apiKeysCreated: 10,
      });
    });

    it('should filter by correct time range', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      vi.mocked(prisma.screenshot.count).mockResolvedValue(0);
      vi.mocked(prisma.pdf.count).mockResolvedValue(0);
      vi.mocked(prisma.account.count).mockResolvedValue(0);
      vi.mocked(prisma.apiKey.count).mockResolvedValue(0);

      await service.getRecentActivityStats(12);

      expect(prisma.screenshot.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: expect.any(Date),
          },
        },
      });

      // Verify the date is approximately 12 hours ago
      const call = vi.mocked(prisma.screenshot.count).mock.calls[0][0];
      const sinceDate = call!.where!.createdAt!.gte as Date;
      const hoursDiff = (now - sinceDate.getTime()) / (1000 * 60 * 60);
      expect(Math.round(hoursDiff)).toBe(12);
    });

    it('should support custom hours parameter', async () => {
      vi.mocked(prisma.screenshot.count).mockResolvedValue(100);
      vi.mocked(prisma.pdf.count).mockResolvedValue(50);
      vi.mocked(prisma.account.count).mockResolvedValue(10);
      vi.mocked(prisma.apiKey.count).mockResolvedValue(20);

      const stats = await service.getRecentActivityStats(48);

      expect(stats.screenshotsCreated).toBe(100);
    });
  });

  // ============================================
  // getJobErrorRate Tests
  // ============================================
  describe('getJobErrorRate', () => {
    it('should calculate error rates correctly', async () => {
      vi.mocked(prisma.screenshot.count)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(5); // failed

      vi.mocked(prisma.pdf.count)
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(10); // failed

      const rates = await service.getJobErrorRate();

      expect(rates.screenshot).toEqual({
        total: 100,
        failed: 5,
        rate: 5,
      });
      expect(rates.pdf).toEqual({
        total: 50,
        failed: 10,
        rate: 20,
      });
    });

    it('should return 0 rate when no jobs exist', async () => {
      vi.mocked(prisma.screenshot.count)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      vi.mocked(prisma.pdf.count)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const rates = await service.getJobErrorRate();

      expect(rates.screenshot.rate).toBe(0);
      expect(rates.pdf.rate).toBe(0);
    });

    it('should filter failed jobs by FAILED status', async () => {
      vi.mocked(prisma.screenshot.count).mockResolvedValue(0);
      vi.mocked(prisma.pdf.count).mockResolvedValue(0);

      await service.getJobErrorRate();

      // Check that failed count query includes status: 'FAILED'
      expect(prisma.screenshot.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'FAILED',
          }),
        })
      );
    });

    it('should round error rate to integer', async () => {
      vi.mocked(prisma.screenshot.count)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(3); // 3%

      vi.mocked(prisma.pdf.count)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(7); // 7%

      const rates = await service.getJobErrorRate();

      expect(rates.screenshot.rate).toBe(3);
      expect(rates.pdf.rate).toBe(7);
    });

    it('should accept custom hours parameter', async () => {
      vi.mocked(prisma.screenshot.count).mockResolvedValue(0);
      vi.mocked(prisma.pdf.count).mockResolvedValue(0);

      const now = Date.now();
      vi.setSystemTime(now);

      await service.getJobErrorRate(48);

      // Verify time range is 48 hours
      const call = vi.mocked(prisma.screenshot.count).mock.calls[0][0];
      const sinceDate = call!.where!.createdAt!.gte as Date;
      const hoursDiff = (now - sinceDate.getTime()) / (1000 * 60 * 60);
      expect(Math.round(hoursDiff)).toBe(48);
    });
  });

  // ============================================
  // getTierDistribution Tests
  // ============================================
  describe('getTierDistribution', () => {
    it('should return tier distribution with all tiers', async () => {
      vi.mocked(prisma.account.groupBy).mockResolvedValue([
        { tier: 'FREE', _count: { tier: 80 } },
        { tier: 'PRO', _count: { tier: 15 } },
        { tier: 'BUSINESS', _count: { tier: 4 } },
        { tier: 'ENTERPRISE', _count: { tier: 1 } },
      ] as any);

      const distribution = await service.getTierDistribution();

      expect(distribution).toEqual({
        FREE: 80,
        PRO: 15,
        BUSINESS: 4,
        ENTERPRISE: 1,
      });
    });

    it('should return 0 for missing tiers', async () => {
      vi.mocked(prisma.account.groupBy).mockResolvedValue([
        { tier: 'FREE', _count: { tier: 50 } },
        { tier: 'PRO', _count: { tier: 10 } },
      ] as any);

      const distribution = await service.getTierDistribution();

      expect(distribution).toEqual({
        FREE: 50,
        PRO: 10,
        BUSINESS: 0,
        ENTERPRISE: 0,
      });
    });

    it('should handle empty database', async () => {
      vi.mocked(prisma.account.groupBy).mockResolvedValue([]);

      const distribution = await service.getTierDistribution();

      expect(distribution).toEqual({
        FREE: 0,
        PRO: 0,
        BUSINESS: 0,
        ENTERPRISE: 0,
      });
    });

    it('should use groupBy with tier field', async () => {
      vi.mocked(prisma.account.groupBy).mockResolvedValue([]);

      await service.getTierDistribution();

      expect(prisma.account.groupBy).toHaveBeenCalledWith({
        by: ['tier'],
        _count: { tier: true },
      });
    });
  });

  // ============================================
  // Singleton Pattern Tests
  // ============================================
  describe('getMetricsService', () => {
    it('should return MetricsService instance', () => {
      const instance = getMetricsService();

      expect(instance).toBeInstanceOf(MetricsService);
    });
  });
});
