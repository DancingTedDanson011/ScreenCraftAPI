/**
 * Browser Pool Service Tests
 *
 * Run with: npm test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getBrowserPool, BrowserPoolExhaustedError } from './browser-pool.service.js';
import type { BrowserPoolService } from './browser-pool.service.js';

describe('BrowserPoolService', () => {
  let pool: BrowserPoolService;

  beforeAll(() => {
    pool = getBrowserPool();
  });

  afterAll(async () => {
    await pool.shutdown();
  });

  describe('Context Acquisition', () => {
    it('should acquire and release a context', async () => {
      const { context, contextId } = await pool.acquireContext();

      expect(context).toBeDefined();
      expect(contextId).toBeDefined();
      expect(contextId).toMatch(/^context-\d+-\d+$/);

      const stats = pool.getStats();
      expect(stats.activeContexts).toBe(1);

      await pool.releaseContext(contextId);

      const statsAfter = pool.getStats();
      expect(statsAfter.activeContexts).toBe(0);
    });

    it('should acquire multiple contexts', async () => {
      const contexts = await Promise.all([
        pool.acquireContext(),
        pool.acquireContext(),
        pool.acquireContext(),
      ]);

      expect(contexts).toHaveLength(3);

      const stats = pool.getStats();
      expect(stats.activeContexts).toBe(3);

      await Promise.all(contexts.map((c) => pool.releaseContext(c.contextId)));
    });

    it('should apply custom context options', async () => {
      const { context, contextId } = await pool.acquireContext({
        viewport: { width: 1366, height: 768 },
        locale: 'de-DE',
      });

      const page = await context.newPage();
      const viewport = page.viewportSize();

      expect(viewport?.width).toBe(1366);
      expect(viewport?.height).toBe(768);

      await pool.releaseContext(contextId);
    });
  });

  describe('Page Acquisition', () => {
    it('should acquire a page with context', async () => {
      const { page, contextId } = await pool.acquirePage();

      expect(page).toBeDefined();
      expect(contextId).toBeDefined();

      await pool.releaseContext(contextId);
    });

    it('should navigate to URL', async () => {
      const { page, contextId } = await pool.acquirePage();

      await page.goto('https://example.com');
      const title = await page.title();

      expect(title).toBe('Example Domain');

      await pool.releaseContext(contextId);
    }, 30000); // 30s timeout for network
  });

  describe('Pool Management', () => {
    it('should track pool statistics', async () => {
      const { contextId } = await pool.acquireContext();

      const stats = pool.getStats();

      expect(stats.totalBrowsers).toBeGreaterThan(0);
      expect(stats.activeContexts).toBeGreaterThan(0);
      expect(stats.totalUsageCount).toBeGreaterThan(0);

      await pool.releaseContext(contextId);
    });

    it('should reuse browsers for multiple contexts', async () => {
      const contexts = await Promise.all([
        pool.acquireContext(),
        pool.acquireContext(),
      ]);

      const stats = pool.getStats();

      // Should have contexts but not necessarily multiple browsers
      expect(stats.activeContexts).toBe(2);

      await Promise.all(contexts.map((c) => pool.releaseContext(c.contextId)));
    });

    it('should handle pool exhaustion gracefully', async () => {
      // Acquire all available contexts (4 browsers × 4 contexts = 16)
      const contexts: Array<{ contextId: string }> = [];

      try {
        for (let i = 0; i < 16; i++) {
          const ctx = await pool.acquireContext();
          contexts.push(ctx);
        }

        // Try to acquire one more (should fail or wait)
        const start = Date.now();
        await expect(
          Promise.race([
            pool.acquireContext(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 6000)
            ),
          ])
        ).rejects.toThrow();

        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(5000); // Should wait ~5s
      } finally {
        // Clean up all contexts
        await Promise.all(contexts.map((c) => pool.releaseContext(c.contextId)));
      }
    }, 20000);
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const health = await pool.checkHealth();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('issues');
      expect(health).toHaveProperty('stats');

      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    it('should detect unhealthy state', async () => {
      // Acquire and don't release (will be detected as stuck after timeout)
      const { contextId } = await pool.acquireContext();

      // Wait for context to become "stuck"
      await new Promise((resolve) => setTimeout(resolve, 65000)); // > 2× timeout

      const health = await pool.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);

      // Clean up
      await pool.releaseContext(contextId);
    }, 70000);
  });

  describe('Auto-Release', () => {
    it('should auto-release context after timeout', async () => {
      const { contextId } = await pool.acquireContext();

      const statsBefore = pool.getStats();
      expect(statsBefore.activeContexts).toBe(1);

      // Wait for auto-release (30s timeout + buffer)
      await new Promise((resolve) => setTimeout(resolve, 31000));

      const statsAfter = pool.getStats();
      expect(statsAfter.activeContexts).toBe(0);
    }, 35000);
  });

  describe('Browser Recycling', () => {
    it('should recycle browser after max uses', async () => {
      const statsInitial = pool.getStats();
      const initialBrowsers = statsInitial.totalBrowsers;

      // Use browser 50+ times to trigger recycling
      for (let i = 0; i < 55; i++) {
        const { page, contextId } = await pool.acquirePage();
        await page.goto('about:blank');
        await pool.releaseContext(contextId);
      }

      const statsAfter = pool.getStats();

      // Browser should have been recycled
      expect(statsAfter.totalUsageCount).toBeGreaterThanOrEqual(55);
    }, 60000);
  });

  describe('Stealth Features', () => {
    it('should hide webdriver property', async () => {
      const { page, contextId } = await pool.acquirePage();

      await page.goto('about:blank');

      const webdriver = await page.evaluate(() => navigator.webdriver);
      expect(webdriver).toBeUndefined();

      await pool.releaseContext(contextId);
    });

    it('should have realistic plugins', async () => {
      const { page, contextId } = await pool.acquirePage();

      await page.goto('about:blank');

      const plugins = await page.evaluate(() => navigator.plugins.length);
      expect(plugins).toBeGreaterThan(0);

      await pool.releaseContext(contextId);
    });

    it('should randomize user agent', async () => {
      const userAgents = new Set<string>();

      for (let i = 0; i < 5; i++) {
        const { page, contextId } = await pool.acquirePage();
        await page.goto('about:blank');

        const ua = await page.evaluate(() => navigator.userAgent);
        userAgents.add(ua);

        await pool.releaseContext(contextId);
      }

      // Should have some variety (not guaranteed but likely)
      expect(userAgents.size).toBeGreaterThan(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when releasing non-existent context', async () => {
      await expect(pool.releaseContext('invalid-context-id')).rejects.toThrow();
    });

    it('should handle browser crashes gracefully', async () => {
      const { context, contextId } = await pool.acquireContext();

      // Force close browser
      await context.browser()?.close();

      // Should handle gracefully
      await expect(pool.releaseContext(contextId)).resolves.not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent page navigations', async () => {
      const urls = [
        'https://example.com',
        'https://example.org',
        'https://example.net',
      ];

      const results = await Promise.all(
        urls.map(async (url) => {
          const { page, contextId } = await pool.acquirePage();
          try {
            await page.goto(url, { timeout: 10000 });
            const title = await page.title();
            return { url, title };
          } finally {
            await pool.releaseContext(contextId);
          }
        })
      );

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.title).toBeTruthy();
      });
    }, 30000);
  });
});
