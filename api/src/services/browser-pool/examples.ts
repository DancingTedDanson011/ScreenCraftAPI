/**
 * Browser Pool Usage Examples
 * Real-world examples for common use cases
 */

import { getBrowserPool } from './index.js';
import type { ScreenshotOptions, PDFOptions, ScrapeResult } from './types.js';

/**
 * Example 1: Take a screenshot
 */
export async function takeScreenshot(options: ScreenshotOptions): Promise<Buffer> {
  const pool = getBrowserPool();
  const { page, contextId } = await pool.acquirePage({
    viewport: options.viewport || { width: 1920, height: 1080 },
  });

  try {
    // Block resources if needed
    if (options.blockImages || options.blockMedia) {
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        const shouldBlock =
          (options.blockImages && type === 'image') ||
          (options.blockMedia && type === 'media') ||
          (options.blockFonts && type === 'font');

        if (shouldBlock) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }

    // Navigate
    await page.goto(options.url, { waitUntil: 'networkidle' });

    // Wait for selector if specified
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
    }

    // Additional wait time
    if (options.waitForTimeout) {
      await page.waitForTimeout(options.waitForTimeout);
    }

    // Take screenshot
    const screenshot = await page.screenshot({
      fullPage: options.fullPage || false,
      type: options.format || 'png',
      quality: options.format === 'jpeg' ? options.quality || 80 : undefined,
    });

    return screenshot;
  } finally {
    await pool.releaseContext(contextId);
  }
}

/**
 * Example 2: Generate PDF
 */
export async function generatePDF(options: PDFOptions): Promise<Buffer> {
  const pool = getBrowserPool();
  const { page, contextId } = await pool.acquirePage({
    viewport: options.viewport || { width: 1920, height: 1080 },
  });

  try {
    await page.goto(options.url, { waitUntil: 'networkidle' });

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
    }

    if (options.waitForTimeout) {
      await page.waitForTimeout(options.waitForTimeout);
    }

    const pdf = await page.pdf({
      format: options.format || 'A4',
      landscape: options.landscape || false,
      margin: options.margin || { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      printBackground: options.printBackground !== false,
    });

    return pdf;
  } finally {
    await pool.releaseContext(contextId);
  }
}

/**
 * Example 3: Scrape page data
 */
export async function scrapePage(url: string): Promise<ScrapeResult> {
  const pool = getBrowserPool();
  const { page, contextId } = await pool.acquirePage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Extract data
    const data = await page.evaluate(() => {
      return {
        title: document.title,
        description:
          document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        ogImage:
          document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
        h1: document.querySelector('h1')?.textContent || '',
        links: Array.from(document.querySelectorAll('a')).map((a) => ({
          href: a.href,
          text: a.textContent?.trim() || '',
        })),
      };
    });

    return {
      url,
      title: data.title,
      content: data.h1,
      metadata: {
        description: data.description,
        ogImage: data.ogImage,
      },
      extractedData: data,
      timestamp: new Date(),
    };
  } finally {
    await pool.releaseContext(contextId);
  }
}

/**
 * Example 4: Batch screenshots
 */
export async function batchScreenshots(urls: string[]): Promise<Map<string, Buffer>> {
  const pool = getBrowserPool();
  const results = new Map<string, Buffer>();

  // Process in parallel (up to pool capacity)
  const promises = urls.map(async (url) => {
    const { page, contextId } = await pool.acquirePage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const screenshot = await page.screenshot({ fullPage: true });
      results.set(url, screenshot);
    } catch (error) {
      console.error(`Failed to screenshot ${url}:`, error);
    } finally {
      await pool.releaseContext(contextId);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Example 5: Wait for dynamic content
 */
export async function screenshotWithDynamicContent(url: string): Promise<Buffer> {
  const pool = getBrowserPool();
  const { page, contextId } = await pool.acquirePage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for specific element
    await page.waitForSelector('.dynamic-content', { timeout: 10000 });

    // Wait for network to be idle
    await page.waitForLoadState('networkidle');

    // Additional wait for animations
    await page.waitForTimeout(1000);

    return await page.screenshot({ fullPage: true });
  } finally {
    await pool.releaseContext(contextId);
  }
}

/**
 * Example 6: Authenticated screenshot
 */
export async function authenticatedScreenshot(
  url: string,
  cookies: Array<{ name: string; value: string; domain: string }>
): Promise<Buffer> {
  const pool = getBrowserPool();
  const { context, contextId } = await pool.acquireContext();

  try {
    // Add cookies
    await context.addCookies(cookies);

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    return await page.screenshot();
  } finally {
    await pool.releaseContext(contextId);
  }
}

/**
 * Example 7: Screenshot with custom JavaScript execution
 */
export async function screenshotWithScript(
  url: string,
  script: string
): Promise<{ screenshot: Buffer; scriptResult: any }> {
  const pool = getBrowserPool();
  const { page, contextId } = await pool.acquirePage();

  try {
    await page.goto(url, { waitUntil: 'networkidle' });

    // Execute custom script
    const scriptResult = await page.evaluate(script);

    // Wait a bit for any visual changes
    await page.waitForTimeout(500);

    const screenshot = await page.screenshot();

    return { screenshot, scriptResult };
  } finally {
    await pool.releaseContext(contextId);
  }
}

/**
 * Example 8: Mobile viewport screenshot
 */
export async function mobileScreenshot(url: string): Promise<Buffer> {
  const pool = getBrowserPool();
  const { page, contextId } = await pool.acquirePage({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    return await page.screenshot({ fullPage: true });
  } finally {
    await pool.releaseContext(contextId);
  }
}

/**
 * Example 9: Retry logic for flaky pages
 */
export async function screenshotWithRetry(
  url: string,
  maxRetries = 3
): Promise<Buffer | null> {
  const pool = getBrowserPool();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let contextId: string | null = null;

    try {
      const { page, contextId: id } = await pool.acquirePage();
      contextId = id;

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const screenshot = await page.screenshot();

      await pool.releaseContext(contextId);
      return screenshot;
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed for ${url}:`, error);

      if (contextId) {
        await pool.releaseContext(contextId).catch(console.error);
      }

      if (attempt === maxRetries - 1) {
        return null;
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  return null;
}

/**
 * Example 10: Health monitoring
 */
export async function monitorPoolHealth(): Promise<void> {
  const pool = getBrowserPool();

  setInterval(async () => {
    const health = await pool.checkHealth();

    console.log('Pool Health:', {
      status: health.healthy ? 'HEALTHY' : 'UNHEALTHY',
      stats: health.stats,
      issues: health.issues,
    });

    if (!health.healthy) {
      console.warn('Pool issues detected:', health.issues);
    }
  }, 60000); // Check every minute
}
