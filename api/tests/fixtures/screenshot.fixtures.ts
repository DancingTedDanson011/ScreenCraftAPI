import { faker } from '@faker-js/faker';

/**
 * Screenshot request fixtures for testing
 */
export const screenshotFixtures = {
  /**
   * Valid minimal screenshot request
   */
  validMinimal: () => ({
    url: 'https://example.com',
  }),

  /**
   * Valid screenshot request with all options
   */
  validFull: () => ({
    url: 'https://example.com',
    format: 'png' as const,
    fullPage: false,
    viewport: {
      width: 1920,
      height: 1080,
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
    cookies: [
      {
        name: 'session',
        value: 'test-session-id',
        domain: 'example.com',
        path: '/',
      },
    ],
    waitOptions: {
      waitUntil: 'load' as const,
      timeout: 30000,
      delay: 500,
    },
    omitBackground: false,
    quality: 80,
    clip: {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    },
    blockResources: [],
  }),

  /**
   * Screenshot request for full page capture
   */
  fullPage: () => ({
    url: 'https://example.com/long-page',
    format: 'png' as const,
    fullPage: true,
    viewport: {
      width: 1440,
      height: 900,
    },
    waitOptions: {
      waitUntil: 'networkidle0' as const,
      timeout: 45000,
    },
  }),

  /**
   * Screenshot request for mobile viewport
   */
  mobile: () => ({
    url: 'https://example.com',
    format: 'png' as const,
    fullPage: false,
    viewport: {
      width: 375,
      height: 812,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  }),

  /**
   * Screenshot request with JPEG format and quality
   */
  jpeg: () => ({
    url: 'https://example.com',
    format: 'jpeg' as const,
    quality: 75,
    viewport: {
      width: 1280,
      height: 720,
    },
  }),

  /**
   * Screenshot request with transparent background
   */
  transparent: () => ({
    url: 'https://example.com',
    format: 'png' as const,
    omitBackground: true,
    viewport: {
      width: 800,
      height: 600,
    },
  }),

  /**
   * Screenshot request with resource blocking
   */
  blockedResources: () => ({
    url: 'https://example.com',
    format: 'png' as const,
    blockResources: ['image', 'stylesheet', 'font'] as const,
    viewport: {
      width: 1920,
      height: 1080,
    },
  }),

  /**
   * Screenshot request with custom wait selector
   */
  waitForSelector: () => ({
    url: 'https://example.com',
    format: 'png' as const,
    waitOptions: {
      waitUntil: 'domcontentloaded' as const,
      timeout: 30000,
      selector: '#main-content',
    },
    viewport: {
      width: 1920,
      height: 1080,
    },
  }),

  /**
   * Invalid screenshot request - missing URL
   */
  invalidMissingUrl: () => ({
    format: 'png',
    viewport: { width: 1920, height: 1080 },
  }),

  /**
   * Invalid screenshot request - invalid URL format
   */
  invalidUrlFormat: () => ({
    url: 'not-a-valid-url',
    format: 'png' as const,
  }),

  /**
   * Invalid screenshot request - invalid format
   */
  invalidFormat: () => ({
    url: 'https://example.com',
    format: 'gif' as const, // Invalid format
  }),

  /**
   * Invalid screenshot request - viewport too small
   */
  invalidViewport: () => ({
    url: 'https://example.com',
    viewport: {
      width: 100,
      height: 100,
    },
  }),

  /**
   * Invalid screenshot request - quality with PNG format
   */
  invalidQualityWithPng: () => ({
    url: 'https://example.com',
    format: 'png' as const,
    quality: 80, // Quality is not allowed for PNG
  }),

  /**
   * Generate random valid screenshot request
   */
  random: () => ({
    url: faker.internet.url(),
    format: faker.helpers.arrayElement(['png', 'jpeg', 'webp']) as 'png' | 'jpeg' | 'webp',
    fullPage: faker.datatype.boolean(),
    viewport: {
      width: faker.number.int({ min: 320, max: 3840 }),
      height: faker.number.int({ min: 240, max: 2160 }),
    },
    waitOptions: {
      waitUntil: faker.helpers.arrayElement([
        'load',
        'domcontentloaded',
        'networkidle0',
        'networkidle2',
      ]) as 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2',
      timeout: faker.number.int({ min: 5000, max: 60000 }),
    },
  }),

  /**
   * Batch of random screenshot requests
   */
  batch: (count = 5) => {
    return Array.from({ length: count }, () => screenshotFixtures.random());
  },
};

/**
 * Screenshot result fixtures
 */
export const screenshotResultFixtures = {
  /**
   * Successful screenshot result
   */
  success: () => ({
    buffer: Buffer.from('fake-image-data'),
    format: 'png' as const,
    width: 1920,
    height: 1080,
    fileSize: 12345,
  }),

  /**
   * Successful JPEG screenshot result
   */
  successJpeg: () => ({
    buffer: Buffer.from('fake-jpeg-data'),
    format: 'jpeg' as const,
    width: 1280,
    height: 720,
    fileSize: 8765,
  }),

  /**
   * Full page screenshot result
   */
  fullPage: () => ({
    buffer: Buffer.from('fake-full-page-image-data'),
    format: 'png' as const,
    width: 1440,
    height: 5000,
    fileSize: 98765,
  }),
};

/**
 * Screenshot API response fixtures
 */
export const screenshotApiFixtures = {
  /**
   * Successful API response
   */
  successResponse: () => ({
    success: true,
    data: {
      url: 'https://storage.example.com/screenshots/test.png',
      format: 'png',
      width: 1920,
      height: 1080,
      fileSize: 12345,
      storageKey: 'screenshots/user-123/1234567890-test.png',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'req_123456',
      version: 'v1',
    },
  }),

  /**
   * Error API response - validation error
   */
  validationError: () => ({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: {
        url: ['URL is required'],
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'req_123456',
      version: 'v1',
    },
  }),

  /**
   * Error API response - navigation error
   */
  navigationError: () => ({
    success: false,
    error: {
      code: 'NAVIGATION_FAILED',
      message: 'Failed to navigate to https://example.com: Timeout',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'req_123456',
      version: 'v1',
    },
  }),

  /**
   * Error API response - rate limit
   */
  rateLimitError: () => ({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded. Please try again later.',
      details: {
        limit: 100,
        remaining: 0,
        reset: new Date(Date.now() + 60000).toISOString(),
      },
    },
  }),
};
