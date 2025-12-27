import type { Page } from 'playwright-core';
import type { BrowserContextOptions } from 'playwright-core';
import { getBrowserPool } from '../browser-pool/index.js';
import type { BrowserPoolService } from '../browser-pool/browser-pool.service.js';
import type { ScreenshotRequest, WaitOptions } from '../../schemas/screenshot.schema.js';
import { validateUrl, UrlValidationError } from '../../utils/url-validator.js';

/**
 * Screenshot capture result
 */
export interface ScreenshotResult {
  buffer: Buffer;
  format: 'png' | 'jpeg' | 'webp';
  width: number;
  height: number;
  fileSize: number;
}

/**
 * Screenshot service error types
 */
export class ScreenshotError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode: number = 500) {
    super(message);
    this.name = 'ScreenshotError';
  }
}

export class NavigationError extends ScreenshotError {
  constructor(url: string, reason: string) {
    super(`Failed to navigate to ${url}: ${reason}`, 'NAVIGATION_FAILED', 400);
  }
}

export class CaptureError extends ScreenshotError {
  constructor(reason: string) {
    super(`Failed to capture screenshot: ${reason}`, 'CAPTURE_FAILED', 500);
  }
}

export class TimeoutError extends ScreenshotError {
  constructor(timeout: number) {
    super(`Screenshot operation timed out after ${timeout}ms`, 'TIMEOUT', 408);
  }
}

/**
 * Screenshot Service
 * Handles screenshot capture using Browser Pool
 */
export class ScreenshotService {
  private browserPool: BrowserPoolService;

  constructor() {
    this.browserPool = getBrowserPool();
  }

  /**
   * Capture a screenshot based on provided options
   * @param options - Screenshot request options
   * @returns Screenshot result with buffer and metadata
   */
  async captureScreenshot(options: ScreenshotRequest): Promise<ScreenshotResult> {
    let contextId: string | null = null;
    let page: Page | null = null;

    try {
      // Prepare browser context options
      const contextOptions: BrowserContextOptions = {
        viewport: options.viewport
          ? { width: options.viewport.width, height: options.viewport.height }
          : { width: 1920, height: 1080 },
        userAgent: options.userAgent,
        bypassCSP: true,
        ignoreHTTPSErrors: true,
      };

      // Acquire page from browser pool
      const { page: acquiredPage, contextId: ctxId } = await this.browserPool.acquirePage(contextOptions);
      page = acquiredPage;
      contextId = ctxId;

      // Set custom headers if provided
      if (options.headers) {
        await page.setExtraHTTPHeaders(options.headers);
      }

      // Set cookies if provided
      if (options.cookies && options.cookies.length > 0) {
        const context = page.context();
        const validCookies = options.cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite,
        }));
        await context.addCookies(validCookies);
      }

      // Block resources if requested
      if (options.blockResources && options.blockResources.length > 0) {
        await this.setupResourceBlocking(page, options.blockResources);
      }

      // Navigate to URL with timeout and wait options
      const waitOptions: WaitOptions = options.waitOptions || {
        waitUntil: 'load',
        timeout: 30000,
      };
      const timeout = waitOptions.timeout;
      const waitUntil = this.mapWaitUntil(waitOptions.waitUntil);

      try {
        await page.goto(options.url, {
          waitUntil,
          timeout,
        });
      } catch (error) {
        throw new NavigationError(
          options.url,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      // Wait for specific selector if provided
      if (waitOptions.selector) {
        try {
          await page.waitForSelector(waitOptions.selector, { timeout });
        } catch (error) {
          throw new NavigationError(
            options.url,
            `Selector "${waitOptions.selector}" not found within ${timeout}ms`
          );
        }
      }

      // Additional delay if requested
      if (waitOptions.delay && waitOptions.delay > 0) {
        await page.waitForTimeout(waitOptions.delay);
      }

      // Prepare screenshot options
      const screenshotOptions: Parameters<Page['screenshot']>[0] = {
        type: options.format === 'webp' ? 'png' : options.format, // Fallback webp to png
        fullPage: options.fullPage,
        omitBackground: options.omitBackground,
      };

      // Add quality for jpeg only (webp not supported by Playwright screenshot API)
      if (options.quality && options.format === 'jpeg') {
        screenshotOptions.quality = options.quality;
      }

      // Add clip/crop if provided
      if (options.clip) {
        screenshotOptions.clip = {
          x: options.clip.x,
          y: options.clip.y,
          width: options.clip.width,
          height: options.clip.height,
        };
      }

      // Capture screenshot
      let buffer: Buffer;
      try {
        buffer = await page.screenshot(screenshotOptions);
      } catch (error) {
        throw new CaptureError(error instanceof Error ? error.message : 'Unknown error');
      }

      // Get viewport dimensions
      const viewport = page.viewportSize() || { width: 1920, height: 1080 };

      return {
        buffer,
        format: options.format,
        width: options.clip?.width || viewport.width,
        height: options.clip?.height || viewport.height,
        fileSize: buffer.length,
      };
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ScreenshotError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ScreenshotError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        'UNKNOWN_ERROR',
        500
      );
    } finally {
      // Always release context back to pool
      if (contextId) {
        try {
          await this.browserPool.releaseContext(contextId);
        } catch (error) {
          console.error(`Failed to release context ${contextId}:`, error);
        }
      }
    }
  }

  /**
   * Setup resource blocking based on requested types
   * @param page - Playwright page instance
   * @param blockedTypes - Array of resource types to block
   */
  private async setupResourceBlocking(
    page: Page,
    blockedTypes: Array<'image' | 'stylesheet' | 'font' | 'script' | 'media'>
  ): Promise<void> {
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();

      const typeMap: Record<string, string> = {
        image: 'image',
        stylesheet: 'stylesheet',
        font: 'font',
        script: 'script',
        media: 'media',
      };

      const shouldBlock = blockedTypes.some((type) => typeMap[type] === resourceType);

      if (shouldBlock) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  /**
   * Map wait until option to Playwright format
   * @param waitUntil - Wait until option from schema
   * @returns Playwright wait until value
   */
  private mapWaitUntil(
    waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  ): 'load' | 'domcontentloaded' | 'networkidle' | 'commit' {
    switch (waitUntil) {
      case 'load':
        return 'load';
      case 'domcontentloaded':
        return 'domcontentloaded';
      case 'networkidle0':
      case 'networkidle2':
        return 'networkidle';
      default:
        return 'load';
    }
  }

  /**
   * Validate screenshot request
   * @param options - Screenshot request options
   * @throws ScreenshotError if validation fails
   */
  validateRequest(options: ScreenshotRequest): void {
    // Validate URL format
    try {
      new URL(options.url);
    } catch {
      throw new ScreenshotError('Invalid URL provided', 'INVALID_URL', 400);
    }

    // SSRF Protection: Validate URL against blocked patterns
    try {
      validateUrl(options.url);
    } catch (error) {
      if (error instanceof UrlValidationError) {
        throw new ScreenshotError(error.message, 'SSRF_BLOCKED', 403);
      }
      throw error;
    }

    // Validate format-specific options
    if (options.quality && options.format === 'png') {
      throw new ScreenshotError(
        'Quality option is only supported for jpeg and webp formats',
        'INVALID_OPTION',
        400
      );
    }

    // Validate clip dimensions
    if (options.clip) {
      if (options.clip.width <= 0 || options.clip.height <= 0) {
        throw new ScreenshotError(
          'Clip dimensions must be positive numbers',
          'INVALID_CLIP',
          400
        );
      }
    }

    // Validate viewport dimensions
    if (options.viewport) {
      if (options.viewport.width < 320 || options.viewport.height < 240) {
        throw new ScreenshotError(
          'Viewport dimensions too small (minimum 320x240)',
          'INVALID_VIEWPORT',
          400
        );
      }
    }
  }

  /**
   * Get content type for screenshot format
   * @param format - Screenshot format
   * @returns MIME type string
   */
  getContentType(format: 'png' | 'jpeg' | 'webp'): string {
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    };

    return mimeTypes[format] || 'image/png';
  }

  /**
   * Health check for screenshot service
   * @returns Health status
   */
  async checkHealth(): Promise<{ healthy: boolean; message: string }> {
    try {
      const poolHealth = await this.browserPool.checkHealth();
      return {
        healthy: poolHealth.healthy,
        message: poolHealth.healthy
          ? 'Screenshot service operational'
          : `Browser pool issues: ${poolHealth.issues.join(', ')}`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Export singleton instance getter
 */
let screenshotServiceInstance: ScreenshotService | null = null;

export const getScreenshotService = (): ScreenshotService => {
  if (!screenshotServiceInstance) {
    screenshotServiceInstance = new ScreenshotService();
  }
  return screenshotServiceInstance;
};
