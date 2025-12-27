// Metrics Service - System and Application Metrics for Admin Dashboard

import os from 'node:os';
import { getBrowserPool } from '../../services/browser-pool/browser-pool.service.js';
import { queueService } from '../../services/queue/queue.service.js';
import { prisma } from '../../lib/db.js';
import type {
  ServerMetrics,
  BrowserPoolMetrics,
  QueueMetrics,
  AllQueueMetrics,
  OverviewMetrics,
} from '../types/admin.types.js';

/**
 * Metrics Service
 * Collects system and application metrics for the admin dashboard
 */
export class MetricsService {
  private cpuUsageHistory: number[] = [];
  private requestsPerMinute: number[] = [];
  private lastCpuInfo: { idle: number; total: number } | null = null;

  constructor() {
    // Start CPU usage tracking
    this.startCpuTracking();
  }

  /**
   * Start tracking CPU usage at regular intervals
   */
  private startCpuTracking(): void {
    setInterval(() => {
      const cpuUsage = this.calculateCpuUsage();
      this.cpuUsageHistory.push(cpuUsage);

      // Keep only last 60 samples (5 minutes at 5s intervals)
      if (this.cpuUsageHistory.length > 60) {
        this.cpuUsageHistory.shift();
      }
    }, 5000);
  }

  /**
   * Calculate current CPU usage percentage
   */
  private calculateCpuUsage(): number {
    const cpus = os.cpus();

    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      const times = cpu.times;
      totalIdle += times.idle;
      totalTick += times.user + times.nice + times.sys + times.idle + times.irq;
    }

    if (this.lastCpuInfo) {
      const idleDiff = totalIdle - this.lastCpuInfo.idle;
      const totalDiff = totalTick - this.lastCpuInfo.total;
      const usage = totalDiff > 0 ? 100 - (100 * idleDiff / totalDiff) : 0;

      this.lastCpuInfo = { idle: totalIdle, total: totalTick };
      return Math.round(usage);
    }

    this.lastCpuInfo = { idle: totalIdle, total: totalTick };
    return 0;
  }

  /**
   * Get server system metrics
   */
  getServerMetrics(): ServerMetrics {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Get current or average CPU usage
    const currentCpu = this.cpuUsageHistory.length > 0
      ? this.cpuUsageHistory[this.cpuUsageHistory.length - 1]
      : this.calculateCpuUsage();

    return {
      cpu: currentCpu,
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100),
      },
      uptime: Math.floor(os.uptime()),
      platform: os.platform(),
      hostname: os.hostname(),
      nodeVersion: process.version,
      pid: process.pid,
    };
  }

  /**
   * Get browser pool metrics
   */
  async getBrowserPoolMetrics(): Promise<BrowserPoolMetrics> {
    try {
      const pool = getBrowserPool();
      const stats = pool.getStats();

      return {
        totalBrowsers: stats.totalBrowsers,
        activeBrowsers: stats.activeBrowsers,
        totalContexts: stats.totalContexts,
        activeContexts: stats.activeContexts,
        averageContextsPerBrowser: Math.round(stats.averageContextsPerBrowser * 100) / 100,
        oldestBrowserAge: stats.oldestBrowserAge,
        totalUsageCount: stats.totalUsageCount,
      };
    } catch (error) {
      // Browser pool might not be initialized
      return {
        totalBrowsers: 0,
        activeBrowsers: 0,
        totalContexts: 0,
        activeContexts: 0,
        averageContextsPerBrowser: 0,
        oldestBrowserAge: 0,
        totalUsageCount: 0,
      };
    }
  }

  /**
   * Get queue metrics for a specific queue
   */
  async getQueueMetrics(queueName: 'screenshot' | 'pdf'): Promise<QueueMetrics> {
    try {
      const stats = await queueService.getQueueStats(queueName);
      return stats;
    } catch (error) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  /**
   * Get all queue metrics
   */
  async getAllQueueMetrics(): Promise<AllQueueMetrics> {
    const [screenshot, pdf] = await Promise.all([
      this.getQueueMetrics('screenshot'),
      this.getQueueMetrics('pdf'),
    ]);

    return { screenshot, pdf };
  }

  /**
   * Get overview metrics for dashboard
   */
  async getOverviewMetrics(): Promise<OverviewMetrics> {
    const [server, browser, queue] = await Promise.all([
      this.getServerMetrics(),
      this.getBrowserPoolMetrics(),
      this.getAllQueueMetrics(),
    ]);

    return {
      server,
      browser,
      queue,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get CPU usage history for charts
   */
  getCpuHistory(): number[] {
    return [...this.cpuUsageHistory];
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    accounts: number;
    apiKeys: number;
    screenshots: number;
    pdfs: number;
    activeSubscriptions: number;
  }> {
    const [accounts, apiKeys, screenshots, pdfs, activeSubscriptions] = await Promise.all([
      prisma.account.count(),
      prisma.apiKey.count({ where: { isActive: true } }),
      prisma.screenshot.count(),
      prisma.pdf.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      accounts,
      apiKeys,
      screenshots,
      pdfs,
      activeSubscriptions,
    };
  }

  /**
   * Get recent activity stats
   */
  async getRecentActivityStats(hours: number = 24): Promise<{
    screenshotsCreated: number;
    pdfsCreated: number;
    newAccounts: number;
    apiKeysCreated: number;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [screenshotsCreated, pdfsCreated, newAccounts, apiKeysCreated] = await Promise.all([
      prisma.screenshot.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.pdf.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.account.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.apiKey.count({
        where: { createdAt: { gte: since } },
      }),
    ]);

    return {
      screenshotsCreated,
      pdfsCreated,
      newAccounts,
      apiKeysCreated,
    };
  }

  /**
   * Get error rate for jobs
   */
  async getJobErrorRate(hours: number = 24): Promise<{
    screenshot: { total: number; failed: number; rate: number };
    pdf: { total: number; failed: number; rate: number };
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [screenshotTotal, screenshotFailed, pdfTotal, pdfFailed] = await Promise.all([
      prisma.screenshot.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.screenshot.count({
        where: {
          createdAt: { gte: since },
          status: 'FAILED',
        },
      }),
      prisma.pdf.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.pdf.count({
        where: {
          createdAt: { gte: since },
          status: 'FAILED',
        },
      }),
    ]);

    return {
      screenshot: {
        total: screenshotTotal,
        failed: screenshotFailed,
        rate: screenshotTotal > 0 ? Math.round((screenshotFailed / screenshotTotal) * 100) : 0,
      },
      pdf: {
        total: pdfTotal,
        failed: pdfFailed,
        rate: pdfTotal > 0 ? Math.round((pdfFailed / pdfTotal) * 100) : 0,
      },
    };
  }

  /**
   * Get tier distribution
   */
  async getTierDistribution(): Promise<Record<string, number>> {
    const accounts = await prisma.account.groupBy({
      by: ['tier'],
      _count: { tier: true },
    });

    const distribution: Record<string, number> = {
      FREE: 0,
      PRO: 0,
      BUSINESS: 0,
      ENTERPRISE: 0,
    };

    for (const item of accounts) {
      distribution[item.tier] = item._count.tier;
    }

    return distribution;
  }
}

/**
 * Singleton instance
 */
let metricsServiceInstance: MetricsService | null = null;

/**
 * Get or create MetricsService singleton
 */
export function getMetricsService(): MetricsService {
  if (!metricsServiceInstance) {
    metricsServiceInstance = new MetricsService();
  }
  return metricsServiceInstance;
}

export const metricsService = getMetricsService();
