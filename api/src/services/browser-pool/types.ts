import type { BrowserContext, Page } from 'playwright-core';

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  url: string;
  viewport?: {
    width: number;
    height: number;
  };
  fullPage?: boolean;
  waitForSelector?: string;
  waitForTimeout?: number;
  blockImages?: boolean;
  blockMedia?: boolean;
  blockFonts?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number; // 0-100 for jpeg
}

/**
 * PDF options
 */
export interface PDFOptions {
  url: string;
  viewport?: {
    width: number;
    height: number;
  };
  waitForSelector?: string;
  waitForTimeout?: number;
  format?: 'A4' | 'Letter' | 'Legal';
  landscape?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
}

/**
 * Scraping options
 */
export interface ScrapeOptions {
  url: string;
  waitForSelector?: string;
  waitForTimeout?: number;
  extractSelectors?: Record<string, string>;
  executeScript?: string;
  screenshot?: boolean;
}

/**
 * Scraping result
 */
export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  extractedData?: Record<string, any>;
  screenshot?: Buffer;
  timestamp: Date;
}

/**
 * Context acquisition result
 */
export interface ContextAcquisitionResult {
  context: BrowserContext;
  contextId: string;
  release: () => Promise<void>;
}

/**
 * Page acquisition result
 */
export interface PageAcquisitionResult {
  page: Page;
  contextId: string;
  release: () => Promise<void>;
}

/**
 * Resource blocking options
 */
export interface ResourceBlockingOptions {
  blockImages?: boolean;
  blockMedia?: boolean;
  blockFonts?: boolean;
  blockStylesheets?: boolean;
  blockTracking?: boolean;
  customBlockedDomains?: string[];
}

/**
 * Browser pool configuration override
 */
export interface PoolConfigOverride {
  maxBrowsers?: number;
  maxContextsPerBrowser?: number;
  contextTimeout?: number;
  recycleAfterUses?: number;
}
