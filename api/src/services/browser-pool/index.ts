/**
 * Browser Pool Service
 * Entry point for the browser pool module
 */

export {
  BrowserPoolService,
  getBrowserPool,
  BrowserPoolError,
  BrowserPoolExhaustedError,
  ContextTimeoutError,
} from './browser-pool.service.js';

export {
  generateStealthConfig,
  getStealthInitScript,
} from './stealth.config.js';

export type {
  ViewportPreset,
  ResourceType,
} from '../../config/browser.config.js';

export {
  BROWSER_LAUNCH_OPTIONS,
  BROWSER_POOL_CONFIG,
  RESOURCE_BLOCKING_CONFIG,
  VIEWPORT_PRESETS,
} from '../../config/browser.config.js';

/**
 * Example usage:
 *
 * ```typescript
 * import { getBrowserPool } from './services/browser-pool';
 *
 * const pool = getBrowserPool();
 *
 * // Acquire context
 * const { context, contextId } = await pool.acquireContext({
 *   viewport: { width: 1920, height: 1080 }
 * });
 *
 * // Use context
 * const page = await context.newPage();
 * await page.goto('https://example.com');
 * await page.screenshot({ path: 'screenshot.png' });
 *
 * // Release when done
 * await pool.releaseContext(contextId);
 *
 * // Or use convenience method
 * const { page, contextId } = await pool.acquirePage();
 * await page.goto('https://example.com');
 * await pool.releaseContext(contextId);
 * ```
 */
