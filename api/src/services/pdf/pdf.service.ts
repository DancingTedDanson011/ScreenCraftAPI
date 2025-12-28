import type { Page } from 'playwright';
import { BrowserPoolService } from '../browser-pool/browser-pool.service.js';
import type {
  PdfMargin,
  PdfFormat,
} from '../../schemas/pdf.schema.js';
import { validateUrl, validateUrlWithDns, UrlValidationError } from '../../utils/url-validator.js';
import { sanitizeHtml, sanitizePdfTemplate } from '../../utils/html-sanitizer.js';

/**
 * PDF Generation Options
 */
export interface PdfGenerationOptions {
  type: 'url' | 'html';
  url?: string;
  html?: string;
  format?: PdfFormat;
  landscape?: boolean;
  printBackground?: boolean;
  margin?: PdfMargin;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  pageRanges?: string;
  preferCSSPageSize?: boolean;
  width?: string;
  height?: string;
  scale?: number;
  waitOptions?: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    timeout?: number;
    delay?: number;
  };
  headers?: Record<string, string>;
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  userAgent?: string;
}

/**
 * PDF Generation Result
 */
export interface PdfGenerationResult {
  buffer: Buffer;
  fileSize: number;
  pages: number;
  duration: number;
}

/**
 * Custom PDF Service Errors
 */
export class PdfServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'PdfServiceError';
  }
}

export class PdfGenerationError extends PdfServiceError {
  constructor(message: string, details?: unknown) {
    super(message, 'PDF_GENERATION_FAILED', details);
  }
}

export class PdfNavigationError extends PdfServiceError {
  constructor(url: string, details?: unknown) {
    super(`Failed to navigate to URL: ${url}`, 'PDF_NAVIGATION_FAILED', details);
  }
}

export class PdfRenderError extends PdfServiceError {
  constructor(message: string, details?: unknown) {
    super(`Failed to render PDF: ${message}`, 'PDF_RENDER_FAILED', details);
  }
}

/**
 * PDF Service
 * Handles PDF generation from URLs and HTML using Playwright
 */
export class PdfService {
  private static instance: PdfService | null = null;
  private browserPool: BrowserPoolService;

  private constructor() {
    this.browserPool = BrowserPoolService.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PdfService {
    if (!PdfService.instance) {
      PdfService.instance = new PdfService();
    }
    return PdfService.instance;
  }

  /**
   * Generate PDF from URL or HTML
   */
  async generatePdf(options: PdfGenerationOptions): Promise<PdfGenerationResult> {
    const startTime = Date.now();
    let contextId: string | undefined;
    let page: Page | undefined;

    try {
      // Entry Point Validation
      this.validateOptions(options);

      // Acquire browser context from pool
      const { page: acquiredPage, contextId: acquiredContextId } =
        await this.browserPool.acquirePage();
      page = acquiredPage;
      contextId = acquiredContextId;

      // Configure page
      await this.configurePage(page, options);

      // Load content
      if (options.type === 'url') {
        await this.loadUrl(page, options);
      } else {
        await this.loadHtml(page, options);
      }

      // Apply delay if specified
      if (options.waitOptions?.delay) {
        await page.waitForTimeout(options.waitOptions.delay);
      }

      // Generate PDF
      const buffer = await this.renderPdf(page, options);

      // Calculate result metadata
      const duration = Date.now() - startTime;
      const fileSize = buffer.length;
      const pages = await this.estimatePageCount(page, options);

      return {
        buffer,
        fileSize,
        pages,
        duration,
      };
    } catch (error) {
      if (error instanceof PdfServiceError) {
        throw error;
      }

      throw new PdfGenerationError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        error
      );
    } finally {
      // Always release context back to pool
      if (contextId) {
        await this.browserPool.releaseContext(contextId).catch((err) => {
          console.error(`Failed to release context ${contextId}:`, err);
        });
      }
    }
  }

  /**
   * Validate generation options (Defense-in-Depth Layer 1)
   */
  private validateOptions(options: PdfGenerationOptions): void {
    if (options.type === 'url' && !options.url) {
      throw new PdfServiceError('URL is required for URL type', 'INVALID_OPTIONS');
    }

    if (options.type === 'html' && !options.html) {
      throw new PdfServiceError('HTML is required for HTML type', 'INVALID_OPTIONS');
    }

    // Validate URL format and SSRF protection
    if (options.type === 'url' && options.url) {
      try {
        new URL(options.url);
      } catch {
        throw new PdfServiceError('Invalid URL format', 'INVALID_URL');
      }

      // SSRF Protection: Block access to internal networks
      try {
        validateUrl(options.url);
      } catch (error) {
        if (error instanceof UrlValidationError) {
          throw new PdfServiceError(error.message, 'SSRF_BLOCKED');
        }
        throw error;
      }
    }

    // Validate timeout range
    if (options.waitOptions?.timeout) {
      const timeout = options.waitOptions.timeout;
      if (timeout < 1000 || timeout > 60000) {
        throw new PdfServiceError(
          'Timeout must be between 1000ms and 60000ms',
          'INVALID_TIMEOUT'
        );
      }
    }

    // Validate scale
    if (options.scale !== undefined) {
      if (options.scale < 0.1 || options.scale > 2) {
        throw new PdfServiceError('Scale must be between 0.1 and 2', 'INVALID_SCALE');
      }
    }
  }

  /**
   * Configure page with options
   */
  private async configurePage(page: Page, options: PdfGenerationOptions): Promise<void> {
    try {
      // Set viewport if width/height specified
      if (options.width && options.height) {
        // Extract numeric values from width/height strings
        const width = this.parseSize(options.width);
        const height = this.parseSize(options.height);

        await page.setViewportSize({ width, height });
      }

      // Set user agent
      if (options.userAgent) {
        await page.setExtraHTTPHeaders({
          'User-Agent': options.userAgent,
        });
      }

      // Set custom headers
      if (options.headers) {
        await page.setExtraHTTPHeaders(options.headers);
      }

      // Set cookies
      if (options.cookies && options.cookies.length > 0) {
        const context = page.context();
        await context.addCookies(
          options.cookies.map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            expires: cookie.expires,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite,
          }))
        );
      }
    } catch (error) {
      throw new PdfServiceError(
        'Failed to configure page',
        'PAGE_CONFIGURATION_FAILED',
        error
      );
    }
  }

  /**
   * Load URL into page
   */
  private async loadUrl(page: Page, options: PdfGenerationOptions): Promise<void> {
    if (!options.url) {
      throw new PdfServiceError('URL is required', 'MISSING_URL');
    }

    // H-07: Validate URL with async DNS resolution (SSRF protection)
    try {
      await validateUrlWithDns(options.url);
    } catch (error) {
      if (error instanceof UrlValidationError) {
        throw new PdfServiceError(error.message, 'SSRF_BLOCKED');
      }
      throw error;
    }

    try {
      const waitUntil = options.waitOptions?.waitUntil || 'load';
      const timeout = options.waitOptions?.timeout || 30000;

      // Map waitUntil to Playwright's expected values
      const playwrightWaitUntil =
        waitUntil === 'networkidle0' || waitUntil === 'networkidle2'
          ? 'networkidle'
          : (waitUntil as 'load' | 'domcontentloaded' | 'networkidle');

      await page.goto(options.url, {
        waitUntil: playwrightWaitUntil,
        timeout,
      });
    } catch (error) {
      throw new PdfNavigationError(options.url, error);
    }
  }

  /**
   * Load HTML content into page
   * H-08: Sanitizes HTML to prevent XSS before rendering
   */
  private async loadHtml(page: Page, options: PdfGenerationOptions): Promise<void> {
    if (!options.html) {
      throw new PdfServiceError('HTML is required', 'MISSING_HTML');
    }

    try {
      // H-08: Sanitize HTML content to prevent XSS
      const sanitizedHtml = sanitizeHtml(options.html);

      await page.setContent(sanitizedHtml, {
        waitUntil: 'load',
        timeout: options.waitOptions?.timeout || 30000,
      });
    } catch (error) {
      throw new PdfServiceError('Failed to set HTML content', 'HTML_LOAD_FAILED', error);
    }
  }

  /**
   * Render page to PDF
   */
  private async renderPdf(page: Page, options: PdfGenerationOptions): Promise<Buffer> {
    try {
      const pdfOptions: Parameters<Page['pdf']>[0] = {
        format: options.format || 'A4',
        landscape: options.landscape || false,
        printBackground: options.printBackground !== false,
        displayHeaderFooter: options.displayHeaderFooter || false,
        scale: options.scale || 1,
        preferCSSPageSize: options.preferCSSPageSize || false,
      };

      // Add margins if specified
      if (options.margin) {
        pdfOptions.margin = {
          top: options.margin.top,
          right: options.margin.right,
          bottom: options.margin.bottom,
          left: options.margin.left,
        };
      }

      // Add header/footer templates if specified
      // H-08: Sanitize templates to prevent XSS
      if (options.headerTemplate) {
        pdfOptions.headerTemplate = sanitizePdfTemplate(options.headerTemplate);
      }

      if (options.footerTemplate) {
        pdfOptions.footerTemplate = sanitizePdfTemplate(options.footerTemplate);
      }

      // Add page ranges if specified
      if (options.pageRanges) {
        pdfOptions.pageRanges = options.pageRanges;
      }

      // Add width/height if specified and not using format
      if (options.width && !pdfOptions.format) {
        pdfOptions.width = options.width;
      }

      if (options.height && !pdfOptions.format) {
        pdfOptions.height = options.height;
      }

      const buffer = await page.pdf(pdfOptions);

      return buffer;
    } catch (error) {
      throw new PdfRenderError(
        error instanceof Error ? error.message : 'Unknown render error',
        error
      );
    }
  }

  /**
   * Estimate page count from rendered content
   */
  private async estimatePageCount(
    page: Page,
    options: PdfGenerationOptions
  ): Promise<number> {
    try {
      // Get page dimensions - evaluate in browser context
      const dimensions = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = (globalThis as any).document;
        return {
          width: doc.documentElement.scrollWidth,
          height: doc.documentElement.scrollHeight,
        };
      });

      // Calculate page height based on format
      const pageHeight = this.getPageHeight(options.format || 'A4', options.landscape);

      // Estimate number of pages
      const estimatedPages = Math.ceil(dimensions.height / pageHeight);

      return Math.max(1, estimatedPages);
    } catch {
      // If estimation fails, return 1 as fallback
      return 1;
    }
  }

  /**
   * Get page height for format
   */
  private getPageHeight(format: PdfFormat, landscape?: boolean): number {
    // Heights in pixels at 96 DPI
    const heights: Record<PdfFormat, number> = {
      Letter: 1056, // 11 inches
      Legal: 1344, // 14 inches
      Tabloid: 1632, // 17 inches
      Ledger: 1056, // 11 inches (landscape of Tabloid)
      A0: 4478,
      A1: 3168,
      A2: 2239,
      A3: 1587,
      A4: 1123,
      A5: 794,
      A6: 559,
    };

    const height = heights[format] || heights.A4;

    // Swap width/height for landscape
    if (landscape) {
      const widths: Record<PdfFormat, number> = {
        Letter: 816, // 8.5 inches
        Legal: 816, // 8.5 inches
        Tabloid: 1056, // 11 inches
        Ledger: 1632, // 17 inches
        A0: 3370,
        A1: 2384,
        A2: 1684,
        A3: 1191,
        A4: 794,
        A5: 559,
        A6: 396,
      };

      return widths[format] || widths.A4;
    }

    return height;
  }

  /**
   * Parse size string to pixels
   */
  private parseSize(size: string): number {
    const match = size.match(/^(\d+(?:\.\d+)?)(px|in|cm|mm)$/);
    if (!match) {
      throw new PdfServiceError('Invalid size format', 'INVALID_SIZE');
    }

    const value = parseFloat(match[1]);
    const unit = match[2];

    // Convert to pixels at 96 DPI
    const conversions: Record<string, number> = {
      px: 1,
      in: 96,
      cm: 37.8,
      mm: 3.78,
    };

    return Math.round(value * conversions[unit]);
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    browserPoolHealth: {
      healthy: boolean;
      issues: string[];
      stats: unknown;
    };
  }> {
    const browserPoolHealth = await this.browserPool.checkHealth();

    return {
      healthy: browserPoolHealth.healthy,
      browserPoolHealth,
    };
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    // Browser pool is managed separately, no cleanup needed here
    PdfService.instance = null;
  }
}

/**
 * Export singleton instance getter
 */
export const getPdfService = (): PdfService => PdfService.getInstance();
