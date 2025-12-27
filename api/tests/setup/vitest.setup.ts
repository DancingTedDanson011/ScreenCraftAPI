import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/screencraft_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.MINIO_ENDPOINT = 'localhost';
process.env.MINIO_PORT = '9000';
process.env.MINIO_ACCESS_KEY = 'minioadmin';
process.env.MINIO_SECRET_KEY = 'minioadmin';
process.env.MINIO_BUCKET = 'test-screenshots';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake_secret';

// Global test setup
beforeAll(async () => {
  // Suppress console logs during tests unless explicitly needed
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  // Keep console.error for debugging failed tests
});

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// Global cleanup
afterAll(async () => {
  vi.restoreAllMocks();
});

// Extend vitest matchers if needed
declare global {
  namespace Vi {
    interface Assertion<T = any> {
      // Add custom matchers here if needed
    }
  }
}

// Custom test utilities
export const testUtils = {
  /**
   * Wait for a condition to be true
   */
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Generate random string for test data
   */
  randomString(length = 10): string {
    return Math.random().toString(36).substring(2, 2 + length);
  },

  /**
   * Generate random email for test data
   */
  randomEmail(): string {
    return `test-${this.randomString()}@example.com`;
  },
};
