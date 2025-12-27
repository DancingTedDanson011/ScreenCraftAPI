import type { LaunchOptions } from 'playwright-core';

/**
 * Browser Launch Configuration
 * Optimized for Docker environments and memory efficiency
 */
export const BROWSER_LAUNCH_OPTIONS: LaunchOptions = {
  headless: true,

  // Chrome/Chromium specific arguments for stability and performance
  args: [
    // Memory and performance optimizations
    '--disable-dev-shm-usage',           // Overcome limited resource problems in Docker
    '--disable-gpu',                      // GPU not needed for headless
    '--disable-software-rasterizer',      // Disable software rasterizer
    '--disable-extensions',               // No extensions needed
    '--disable-background-networking',    // Reduce background activity
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',                 // No crash reporting
    '--disable-component-extensions-with-background-pages',
    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
    '--disable-ipc-flooding-protection',  // Better performance
    '--disable-renderer-backgrounding',   // Keep renderers active

    // Resource blocking
    '--blink-settings=imagesEnabled=false', // Block images by default (override per context)
    '--disable-remote-fonts',              // Block custom fonts

    // Stability
    '--no-sandbox',                       // Required for Docker
    '--no-first-run',
    '--no-zygote',
    '--single-process',                   // More stable in containers

    // Memory limits (per process)
    '--max-old-space-size=512',           // 512MB heap limit
    '--js-flags=--max-old-space-size=512',

    // Disable unnecessary features
    '--disable-setuid-sandbox',
    '--disable-accelerated-2d-canvas',
    '--disable-gl-drawing-for-tests',
    '--mute-audio',                       // No audio needed
    '--hide-scrollbars',
    '--no-default-browser-check',
    '--metrics-recording-only',
    '--disable-sync',
    '--disable-translate',
    '--disable-notifications',

    // Window size (can be overridden per context)
    '--window-size=1920,1080',
  ],

  // Timeout configurations
  timeout: 60000, // 60 seconds to launch

  // Browser channel (use chromium bundled with playwright)
  channel: undefined,

  // Downloads handling
  downloadsPath: undefined, // Disable downloads

  // Ignore HTTPS errors
  ignoreHTTPSErrors: true,
};

/**
 * Resource blocking configuration
 * Used to reduce memory and bandwidth usage
 */
export const RESOURCE_BLOCKING_CONFIG = {
  // Block these resource types by default (can be overridden)
  blockedResourceTypes: [
    'image',
    'media',
    'font',
    'stylesheet',
    'manifest',
    'other',
  ] as const,

  // Block tracking and ads domains
  blockedDomains: [
    'google-analytics.com',
    'googletagmanager.com',
    'doubleclick.net',
    'facebook.com/tr',
    'connect.facebook.net',
    'hotjar.com',
    'clarity.ms',
    'mousestats.com',
    'crazyegg.com',
  ] as const,

  // Allowed resource types for specific use cases
  allowedResourceTypesForScreenshot: [
    'document',
    'stylesheet',
    'font',
  ] as const,
};

/**
 * Default viewport configurations
 */
export const VIEWPORT_PRESETS = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1366, height: 768 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
} as const;

/**
 * Browser pool configuration
 */
export const BROWSER_POOL_CONFIG = {
  maxBrowsers: 4,                // Maximum concurrent browser instances
  maxContextsPerBrowser: 4,      // Maximum contexts per browser
  contextTimeout: 30000,         // 30 seconds max per context usage
  recycleAfterUses: 50,          // Recycle browser after N uses
  healthCheckInterval: 60000,    // Health check every minute
  gracefulShutdownTimeout: 10000, // 10 seconds to clean up
} as const;

export type ViewportPreset = keyof typeof VIEWPORT_PRESETS;
export type ResourceType = typeof RESOURCE_BLOCKING_CONFIG.blockedResourceTypes[number];
