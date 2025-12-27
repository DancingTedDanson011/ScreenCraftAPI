import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import type { BrowserContextOptions } from 'playwright-core';
import { BROWSER_LAUNCH_OPTIONS, BROWSER_POOL_CONFIG } from '../../config/browser.config.js';
import { generateStealthConfig, getStealthInitScript } from './stealth.config.js';

/**
 * Browser instance metadata
 */
interface BrowserInstance {
  browser: Browser;
  contexts: Set<string>; // Context IDs currently in use
  usageCount: number;
  createdAt: Date;
  lastUsedAt: Date;
}

/**
 * Context metadata
 */
interface ContextMetadata {
  context: BrowserContext;
  browserId: string;
  acquiredAt: Date;
  releaseTimeout?: NodeJS.Timeout;
}

/**
 * Pool statistics
 */
interface PoolStats {
  totalBrowsers: number;
  activeBrowsers: number;
  totalContexts: number;
  activeContexts: number;
  averageContextsPerBrowser: number;
  oldestBrowserAge: number;
  totalUsageCount: number;
}

/**
 * Custom errors
 */
export class BrowserPoolError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'BrowserPoolError';
  }
}

export class BrowserPoolExhaustedError extends BrowserPoolError {
  constructor() {
    super('Browser pool exhausted. All browsers and contexts are in use.', 'POOL_EXHAUSTED');
  }
}

export class ContextTimeoutError extends BrowserPoolError {
  constructor(contextId: string) {
    super(`Context ${contextId} exceeded timeout`, 'CONTEXT_TIMEOUT');
  }
}

/**
 * Browser Pool Service
 * Manages a pool of Playwright browser instances with context reuse
 */
export class BrowserPoolService {
  private static instance: BrowserPoolService | null = null;
  private browsers: Map<string, BrowserInstance> = new Map();
  private contexts: Map<string, ContextMetadata> = new Map();
  private isShuttingDown = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private nextBrowserId = 0;
  private nextContextId = 0;

  private constructor() {
    this.startHealthCheck();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BrowserPoolService {
    if (!BrowserPoolService.instance) {
      BrowserPoolService.instance = new BrowserPoolService();
    }
    return BrowserPoolService.instance;
  }

  /**
   * Acquire a browser context
   */
  async acquireContext(options?: BrowserContextOptions): Promise<{
    context: BrowserContext;
    contextId: string;
  }> {
    if (this.isShuttingDown) {
      throw new BrowserPoolError('Pool is shutting down', 'SHUTTING_DOWN');
    }

    // Find or create a browser with available context slots
    const browser = await this.getAvailableBrowser();
    if (!browser) {
      throw new BrowserPoolExhaustedError();
    }

    // Create context with stealth config
    const stealthConfig = generateStealthConfig();
    const contextOptions: BrowserContextOptions = {
      ...stealthConfig,
      ...options, // User options override stealth config
    };

    const context = await browser.browser.newContext(contextOptions);

    // Inject stealth script into all new pages
    await context.addInitScript(getStealthInitScript());

    // Generate context ID
    const contextId = this.generateContextId();

    // Store context metadata
    const metadata: ContextMetadata = {
      context,
      browserId: browser.browser.guid,
      acquiredAt: new Date(),
    };

    // Set auto-release timeout
    metadata.releaseTimeout = setTimeout(() => {
      this.releaseContext(contextId).catch((err) => {
        console.error(`Auto-release failed for context ${contextId}:`, err);
      });
    }, BROWSER_POOL_CONFIG.contextTimeout);

    this.contexts.set(contextId, metadata);
    browser.contexts.add(contextId);
    browser.lastUsedAt = new Date();
    browser.usageCount++;

    return { context, contextId };
  }

  /**
   * Release a browser context
   */
  async releaseContext(contextId: string): Promise<void> {
    const metadata = this.contexts.get(contextId);
    if (!metadata) {
      throw new BrowserPoolError(`Context ${contextId} not found`, 'CONTEXT_NOT_FOUND');
    }

    // Clear timeout
    if (metadata.releaseTimeout) {
      clearTimeout(metadata.releaseTimeout);
    }

    // Close context
    try {
      await metadata.context.close();
    } catch (err) {
      console.error(`Error closing context ${contextId}:`, err);
    }

    // Update browser metadata
    const browserInstance = Array.from(this.browsers.values()).find(
      (b) => b.browser.guid === metadata.browserId
    );

    if (browserInstance) {
      browserInstance.contexts.delete(contextId);

      // Recycle browser if needed
      if (browserInstance.usageCount >= BROWSER_POOL_CONFIG.recycleAfterUses) {
        await this.recycleBrowser(metadata.browserId);
      }
    }

    // Remove context metadata
    this.contexts.delete(contextId);
  }

  /**
   * Get available browser or create new one
   */
  private async getAvailableBrowser(): Promise<BrowserInstance | null> {
    // Try to find browser with available context slots
    for (const browser of this.browsers.values()) {
      if (browser.contexts.size < BROWSER_POOL_CONFIG.maxContextsPerBrowser) {
        return browser;
      }
    }

    // Create new browser if pool not full
    if (this.browsers.size < BROWSER_POOL_CONFIG.maxBrowsers) {
      return await this.createBrowser();
    }

    // Wait for a context to become available (max 5 seconds)
    const startTime = Date.now();
    while (Date.now() - startTime < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 100));

      for (const browser of this.browsers.values()) {
        if (browser.contexts.size < BROWSER_POOL_CONFIG.maxContextsPerBrowser) {
          return browser;
        }
      }
    }

    return null;
  }

  /**
   * Create new browser instance
   */
  private async createBrowser(): Promise<BrowserInstance> {
    const browser = await chromium.launch(BROWSER_LAUNCH_OPTIONS);
    const browserId = browser.guid;

    const instance: BrowserInstance = {
      browser,
      contexts: new Set(),
      usageCount: 0,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    this.browsers.set(browserId, instance);

    // Handle browser disconnect
    browser.on('disconnected', () => {
      this.browsers.delete(browserId);
    });

    return instance;
  }

  /**
   * Recycle browser (close and optionally recreate)
   */
  private async recycleBrowser(browserId: string): Promise<void> {
    const instance = this.browsers.get(browserId);
    if (!instance) return;

    // Close all contexts
    const contextIds = Array.from(instance.contexts);
    for (const contextId of contextIds) {
      await this.releaseContext(contextId).catch(console.error);
    }

    // Close browser
    try {
      await instance.browser.close();
    } catch (err) {
      console.error(`Error closing browser ${browserId}:`, err);
    }

    this.browsers.delete(browserId);
  }

  /**
   * Health check - remove stale browsers
   */
  private async performHealthCheck(): Promise<void> {
    const now = Date.now();

    for (const [browserId, instance] of this.browsers.entries()) {
      // Check if browser is idle and old
      const idleTime = now - instance.lastUsedAt.getTime();
      const age = now - instance.createdAt.getTime();

      // Recycle if idle for 5 minutes or very old
      if ((instance.contexts.size === 0 && idleTime > 300000) || age > 3600000) {
        await this.recycleBrowser(browserId);
      }

      // Check if browser is still connected
      if (!instance.browser.isConnected()) {
        this.browsers.delete(browserId);
      }
    }
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch((err) => {
        console.error('Health check failed:', err);
      });
    }, BROWSER_POOL_CONFIG.healthCheckInterval);
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const activeContexts = this.contexts.size;
    const totalContexts = Array.from(this.browsers.values()).reduce(
      (sum, b) => sum + b.contexts.size,
      0
    );

    const now = Date.now();
    const oldestBrowser = Array.from(this.browsers.values()).reduce((oldest, b) => {
      const age = now - b.createdAt.getTime();
      return age > oldest ? age : oldest;
    }, 0);

    const totalUsage = Array.from(this.browsers.values()).reduce(
      (sum, b) => sum + b.usageCount,
      0
    );

    return {
      totalBrowsers: this.browsers.size,
      activeBrowsers: Array.from(this.browsers.values()).filter((b) => b.contexts.size > 0).length,
      totalContexts,
      activeContexts,
      averageContextsPerBrowser:
        this.browsers.size > 0 ? totalContexts / this.browsers.size : 0,
      oldestBrowserAge: oldestBrowser,
      totalUsageCount: totalUsage,
    };
  }

  /**
   * Check pool health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    stats: PoolStats;
  }> {
    const issues: string[] = [];
    const stats = this.getStats();

    // Check for disconnected browsers
    for (const [browserId, instance] of this.browsers.entries()) {
      if (!instance.browser.isConnected()) {
        issues.push(`Browser ${browserId} is disconnected`);
      }
    }

    // Check for stuck contexts (older than max timeout)
    const now = Date.now();
    for (const [contextId, metadata] of this.contexts.entries()) {
      const age = now - metadata.acquiredAt.getTime();
      if (age > BROWSER_POOL_CONFIG.contextTimeout * 2) {
        issues.push(`Context ${contextId} is stuck (${Math.floor(age / 1000)}s old)`);
      }
    }

    // Check pool capacity
    if (
      this.browsers.size >= BROWSER_POOL_CONFIG.maxBrowsers &&
      stats.averageContextsPerBrowser >= BROWSER_POOL_CONFIG.maxContextsPerBrowser * 0.8
    ) {
      issues.push('Pool is near capacity');
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close all contexts
    const contextIds = Array.from(this.contexts.keys());
    await Promise.all(
      contextIds.map((id) => this.releaseContext(id).catch(console.error))
    );

    // Close all browsers
    await Promise.all(
      Array.from(this.browsers.values()).map((instance) =>
        instance.browser.close().catch(console.error)
      )
    );

    this.browsers.clear();
    this.contexts.clear();

    BrowserPoolService.instance = null;
  }

  /**
   * Generate unique browser ID
   */
  private generateBrowserId(): string {
    return `browser-${++this.nextBrowserId}-${Date.now()}`;
  }

  /**
   * Generate unique context ID
   */
  private generateContextId(): string {
    return `context-${++this.nextContextId}-${Date.now()}`;
  }

  /**
   * Utility: Create a page in a new context
   */
  async acquirePage(options?: BrowserContextOptions): Promise<{
    page: Page;
    contextId: string;
  }> {
    const { context, contextId } = await this.acquireContext(options);
    const page = await context.newPage();
    return { page, contextId };
  }
}

/**
 * Export singleton instance getter
 */
export const getBrowserPool = (): BrowserPoolService => BrowserPoolService.getInstance();
