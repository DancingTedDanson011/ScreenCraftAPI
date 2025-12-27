import type { BrowserContextOptions } from 'playwright-core';

/**
 * User Agent Pool
 * Rotated to avoid detection
 */
const USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',

  // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',

  // Chrome on Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
] as const;

/**
 * Viewport configurations with randomization
 */
const VIEWPORT_CONFIGS = [
  { width: 1920, height: 1080, deviceScaleFactor: 1 },
  { width: 1366, height: 768, deviceScaleFactor: 1 },
  { width: 1536, height: 864, deviceScaleFactor: 1.25 },
  { width: 2560, height: 1440, deviceScaleFactor: 1.5 },
] as const;

/**
 * WebGL Vendor/Renderer combinations for spoofing
 */
const WEBGL_VENDORS = [
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti, OpenGL 4.5)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580, OpenGL 4.5)' },
] as const;

/**
 * Timezone configurations
 */
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
] as const;

/**
 * Locale configurations
 */
const LOCALES = [
  'en-US',
  'en-GB',
  'de-DE',
  'fr-FR',
] as const;

/**
 * Get random element from array
 */
function getRandomElement<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Add random variation to number (±5%)
 */
function addVariation(value: number): number {
  const variation = value * 0.05;
  return Math.floor(value + (Math.random() * variation * 2 - variation));
}

/**
 * Generate stealth context options with randomization
 */
export function generateStealthConfig(): BrowserContextOptions {
  const viewport = getRandomElement(VIEWPORT_CONFIGS);
  const webgl = getRandomElement(WEBGL_VENDORS);

  return {
    userAgent: getRandomElement(USER_AGENTS),

    viewport: {
      width: addVariation(viewport.width),
      height: addVariation(viewport.height),
    },

    deviceScaleFactor: viewport.deviceScaleFactor,

    locale: getRandomElement(LOCALES),
    timezoneId: getRandomElement(TIMEZONES),

    // Permissions
    permissions: [],

    // Geolocation spoofing (optional, can be overridden)
    geolocation: undefined,

    // Color scheme
    colorScheme: 'light',

    // Reduced motion (accessibility)
    reducedMotion: 'no-preference',

    // Force device scale factor
    isMobile: false,
    hasTouch: false,

    // HTTP credentials
    httpCredentials: undefined,

    // Offline mode
    offline: false,

    // Extra HTTP headers to appear more legitimate
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  };
}

/**
 * Anti-detection initialization script
 * Injected into every page to hide automation signals
 */
export const STEALTH_INIT_SCRIPT = `
  // Override navigator.webdriver
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    configurable: true
  });

  // Override navigator.plugins
  Object.defineProperty(navigator, 'plugins', {
    get: () => [
      {
        0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format" },
        description: "Portable Document Format",
        filename: "internal-pdf-viewer",
        length: 1,
        name: "Chrome PDF Plugin"
      },
      {
        0: { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format" },
        description: "Portable Document Format",
        filename: "internal-pdf-viewer",
        length: 1,
        name: "Chrome PDF Viewer"
      }
    ],
    configurable: true
  });

  // Override navigator.languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
    configurable: true
  });

  // Override permissions API
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) => (
    parameters.name === 'notifications'
      ? Promise.resolve({ state: 'denied' })
      : originalQuery(parameters)
  );

  // Remove headless indicator
  Object.defineProperty(navigator, 'platform', {
    get: () => 'Win32',
    configurable: true
  });

  // Chrome object
  window.chrome = {
    runtime: {},
    loadTimes: function() {},
    csi: function() {},
    app: {}
  };

  // Add realistic screen properties
  Object.defineProperty(screen, 'availWidth', {
    get: () => window.screen.width,
    configurable: true
  });

  Object.defineProperty(screen, 'availHeight', {
    get: () => window.screen.height - 40, // Taskbar
    configurable: true
  });

  // Battery API (avoid detection)
  if (navigator.getBattery) {
    navigator.getBattery = () => Promise.resolve({
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true
    });
  }

  // WebGL vendor spoofing
  const getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) return 'Google Inc. (Intel)';
    if (parameter === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)';
    return getParameter.call(this, parameter);
  };

  // WebGL2 vendor spoofing
  if (window.WebGL2RenderingContext) {
    const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Google Inc. (Intel)';
      if (parameter === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)';
      return getParameter2.call(this, parameter);
    };
  }

  // Console debug protection
  const originalConsoleDebug = console.debug;
  console.debug = function() {
    if (arguments[0]?.includes && arguments[0].includes('driver')) return;
    return originalConsoleDebug.apply(this, arguments);
  };

  // Connection rtt spoofing (network info)
  if (navigator.connection) {
    Object.defineProperty(navigator.connection, 'rtt', {
      get: () => 100,
      configurable: true
    });
  }

  // Notification permission
  Object.defineProperty(Notification, 'permission', {
    get: () => 'default',
    configurable: true
  });
`;

/**
 * Get stealth initialization script with optional custom WebGL vendor
 */
export function getStealthInitScript(customWebGL?: { vendor: string; renderer: string }): string {
  if (!customWebGL) {
    return STEALTH_INIT_SCRIPT;
  }

  // Inject custom WebGL vendor
  return STEALTH_INIT_SCRIPT.replace(
    /if \(parameter === 37445\) return '[^']+';/,
    `if (parameter === 37445) return '${customWebGL.vendor}';`
  ).replace(
    /if \(parameter === 37446\) return '[^']+';/g,
    `if (parameter === 37446) return '${customWebGL.renderer}';`
  );
}
