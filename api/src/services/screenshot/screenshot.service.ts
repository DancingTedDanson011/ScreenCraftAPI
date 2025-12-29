import type { Page } from 'playwright-core';
import type { BrowserContextOptions } from 'playwright-core';
import { getBrowserPool } from '../browser-pool/index.js';
import type { BrowserPoolService } from '../browser-pool/browser-pool.service.js';
import type { ScreenshotRequest, WaitOptions, ScrollPosition } from '../../schemas/screenshot.schema.js';
import { validateUrl, validateUrlWithDns, UrlValidationError } from '../../utils/url-validator.js';

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

export class ScrollError extends ScreenshotError {
  constructor(reason: string) {
    super(`Failed to scroll page: ${reason}`, 'SCROLL_FAILED', 400);
  }
}

/**
 * Cookie consent selectors covering major CMP libraries and common patterns
 */
const COOKIE_ACCEPT_SELECTORS = [
  // eBay specific
  '#gdpr-banner-accept',
  '#gdpr-banner button[id*="accept"]',
  'button[data-testid="gdpr-banner-accept"]',
  '.gdpr-banner__accept',
  '#scroll-to-top ~ div button', // eBay floating banner

  // Amazon specific
  '#sp-cc-accept',
  '#a-autoid-0-announce',

  // CookieBot
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',

  // OneTrust (very common)
  '#onetrust-accept-btn-handler',
  '.onetrust-close-btn-handler',
  '#accept-recommended-btn-handler',

  // Quantcast
  '.qc-cmp2-summary-buttons button[mode="primary"]',
  '.qc-cmp-button',

  // TrustArc
  '.trustarc-agree-btn',
  '#truste-consent-button',

  // Didomi
  '#didomi-notice-agree-button',
  '.didomi-continue-without-agreeing',

  // Osano / Cookie Consent
  '.cc-btn.cc-dismiss',
  '.cc-compliance .cc-btn',
  '.cc-allow',

  // Klaro
  '.klaro .cm-btn-success',
  '.klaro button[class*="accept"]',

  // Usercentrics
  '#uc-btn-accept-banner',
  '[data-testid="uc-accept-all-button"]',

  // Sourcepoint
  'button[title="Accept"]',
  'button[title="Accept All"]',

  // Generic patterns - IDs
  '#cookie-accept',
  '#accept-cookies',
  '#acceptCookies',
  '#cookie-consent-accept',
  '#cookieAccept',
  '#gdpr-accept',
  '#consent-accept',
  '#btn-cookie-allow',
  '#cookie-allow-all',
  '#cookies-accept-all',
  '#accept_all_cookies',

  // Generic patterns - Classes
  '.cookie-accept',
  '.cookie-consent-accept',
  '.accept-cookies',
  '.consent-accept',
  '.gdpr-accept',
  '.js-accept-cookies',
  '.cookie-notice-accept',
  '.cookies-accept',

  // Button text patterns via data attributes
  '[data-action="accept"]',
  '[data-cookie-accept]',
  '[data-consent="accept"]',
  '[data-testid*="accept"]',
  '[data-testid*="cookie"]',

  // ARIA patterns
  'button[aria-label*="accept" i]',
  'button[aria-label*="agree" i]',
  'button[aria-label*="akzeptieren" i]',
  'button[aria-label*="cookie" i][aria-label*="accept" i]',

  // Common button patterns
  '.cookie-banner button:first-of-type',
  '.cookie-popup button:first-of-type',
  '.consent-banner button:first-of-type',
  '.cookie-notice button:first-of-type',
  '.privacy-banner button:first-of-type',

  // iFrame cookie banners (common in EU)
  'iframe[title*="cookie" i]',

  // German sites
  'button:has-text("Alle akzeptieren")',
  'button:has-text("Akzeptieren")',
  'button:has-text("Zustimmen")',
  'button:has-text("Alle Cookies akzeptieren")',
  'button:has-text("Einverstanden")',

  // English sites
  'button:has-text("Accept All")',
  'button:has-text("Accept all cookies")',
  'button:has-text("I Accept")',
  'button:has-text("Allow All")',
  'button:has-text("Agree")',
  'button:has-text("OK")',
  'button:has-text("Got it")',
  'button:has-text("Allow cookies")',

  // French sites
  'button:has-text("Accepter")',
  'button:has-text("Tout accepter")',

  // Spanish sites
  'button:has-text("Aceptar")',
  'button:has-text("Aceptar todo")',
];

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

      // H-07: Validate URL with async DNS resolution (SSRF protection)
      try {
        await validateUrlWithDns(options.url);
      } catch (error) {
        if (error instanceof UrlValidationError) {
          throw new ScreenshotError(error.message, 'SSRF_BLOCKED', 403);
        }
        throw error;
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

      // Accept cookie consent banners if enabled (default: true)
      if (options.acceptCookies !== false) {
        const cookieTimeout = options.cookieAcceptTimeout ?? 2500;
        await this.acceptCookieConsent(page, cookieTimeout);
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

      // Scroll to specific position if requested (mutually exclusive with fullPage)
      if (options.scrollPosition && options.scrollPosition.y > 0) {
        try {
          await this.scrollToPosition(page, options.scrollPosition);
          // Small stabilization delay after scrolling for content to render
          await page.waitForTimeout(100);
        } catch (error) {
          throw new ScrollError(
            error instanceof Error ? error.message : 'Unknown scroll error'
          );
        }
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
   * Scroll page to specific Y position
   * @param page - Playwright page instance
   * @param scrollPosition - Scroll position configuration
   */
  private async scrollToPosition(
    page: Page,
    scrollPosition: ScrollPosition
  ): Promise<void> {
    const { y, behavior = 'instant' } = scrollPosition;

    // Execute scroll in browser context using expression string
    // This avoids TypeScript DOM type issues since the code runs in the browser
    await page.evaluate(`
      window.scrollTo({
        top: ${y},
        left: 0,
        behavior: '${behavior}'
      });
    `);

    // For smooth scrolling, wait for scroll animation to complete
    if (behavior === 'smooth') {
      await page.waitForFunction(`
        (() => {
          const currentY = window.scrollY;
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const targetY = ${y};
          return Math.abs(currentY - targetY) < 5 || (targetY > maxScroll && currentY >= maxScroll);
        })()
      `, { timeout: 5000 }).catch(() => {
        // Timeout is acceptable - page might not scroll that far
      });
    }
  }

  /**
   * Attempt to accept cookie consent banners with retry logic
   * Uses graceful degradation - failures are logged but don't block screenshot
   * @param page - Playwright page instance
   * @param timeout - Timeout in ms to wait for cookie banner
   */
  private async acceptCookieConsent(page: Page, timeout: number): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Wait a bit for dynamic banners to appear
        if (attempt > 0) {
          await page.waitForTimeout(500);
        }

        // Try combined selector first for efficiency
        const combinedSelector = COOKIE_ACCEPT_SELECTORS.slice(0, 30).join(', ');
        let button = await page.waitForSelector(combinedSelector, {
          timeout: Math.min(timeout, 2000),
          state: 'visible',
        }).catch(() => null);

        // If combined fails, try high-priority selectors individually
        if (!button) {
          const prioritySelectors = [
            '#gdpr-banner-accept',
            '#onetrust-accept-btn-handler',
            '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
            '#sp-cc-accept',
            '.cc-btn.cc-dismiss',
            '#didomi-notice-agree-button',
            'button[aria-label*="accept" i]',
            'button:has-text("Accept All")',
            'button:has-text("Alle akzeptieren")',
          ];

          for (const selector of prioritySelectors) {
            button = await page.$(selector).catch(() => null);
            if (button && await button.isVisible().catch(() => false)) {
              break;
            }
            button = null;
          }
        }

        // Also check for cookie banners in iframes
        if (!button) {
          const frames = page.frames();
          for (const frame of frames) {
            if (frame === page.mainFrame()) continue;
            try {
              button = await frame.$('#onetrust-accept-btn-handler, .cc-btn.cc-dismiss, button[aria-label*="accept" i]');
              if (button && await button.isVisible().catch(() => false)) {
                break;
              }
              button = null;
            } catch {
              // Frame might be detached
            }
          }
        }

        if (button) {
          // Scroll button into view first
          await button.scrollIntoViewIfNeeded().catch(() => {});

          // Try clicking
          await button.click({ timeout: 2000 }).catch(async () => {
            // Some buttons may not be clickable, try force click
            await button!.click({ force: true, timeout: 2000 }).catch(() => {});
          });

          // Wait for banner to close
          await page.waitForTimeout(500);

          // Check if banner is gone
          const stillVisible = await button.isVisible().catch(() => false);
          if (!stillVisible) {
            return; // Success!
          }
        }
      } catch {
        // Continue to next attempt
      }
    }

    // Final attempt: Try to hide any remaining cookie overlays via JS
    await page.evaluate(() => {
      const overlaySelectors = [
        '[class*="cookie"]',
        '[class*="consent"]',
        '[class*="gdpr"]',
        '[id*="cookie"]',
        '[id*="consent"]',
        '[id*="gdpr"]',
      ];
      overlaySelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.position === 'fixed' || style.position === 'sticky') {
            (el as HTMLElement).style.display = 'none';
          }
        });
      });
    }).catch(() => {});
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

    // Validate scrollPosition (mutually exclusive with fullPage)
    if (options.scrollPosition) {
      if (options.fullPage) {
        throw new ScreenshotError(
          'Cannot use scrollPosition with fullPage option. Use either fullPage for entire page capture, or scrollPosition to capture at a specific scroll level.',
          'INVALID_OPTION_COMBINATION',
          400
        );
      }
      if (options.scrollPosition.y < 0) {
        throw new ScreenshotError(
          'Scroll position Y must be a non-negative number',
          'INVALID_SCROLL_POSITION',
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
