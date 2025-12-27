import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import supertest from 'supertest';

/**
 * Create a test application instance
 * @returns Fastify app configured for testing
 */
export async function createTestApp(): Promise<FastifyInstance> {
  const { buildApp } = await import('../../src/app.js');

  const app = await buildApp({
    port: 0, // Random available port
    host: '127.0.0.1',
    env: 'test',
    rateLimitMax: 1000, // Higher limit for tests
    rateLimitTimeWindow: '1 minute',
  });

  // Ready the app but don't start listening
  await app.ready();

  return app;
}

/**
 * Create a supertest instance for the app
 * @param app - Fastify instance
 * @returns Supertest instance
 */
export function createTestClient(app: FastifyInstance) {
  return supertest(app.server);
}

/**
 * Clean all tables in the test database
 * @param prisma - Prisma client instance
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;

  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "public"."${tablename}" CASCADE;`
      );
    }
  }
}

/**
 * Reset specific tables
 * @param prisma - Prisma client instance
 * @param tables - Array of table names to reset
 */
export async function resetTables(
  prisma: PrismaClient,
  tables: string[]
): Promise<void> {
  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "public"."${table}" CASCADE;`
    );
  }
}

/**
 * Create test API key header
 * @param apiKey - API key value
 * @returns Headers object with API key
 */
export function createAuthHeaders(apiKey: string): Record<string, string> {
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };
}

/**
 * Wait for a promise with timeout
 * @param promise - Promise to wait for
 * @param timeout - Timeout in milliseconds
 * @param message - Error message on timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  message = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeout);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Assert that a promise rejects with specific error
 * @param promise - Promise expected to reject
 * @param errorType - Expected error type/class
 * @param message - Optional message substring to match
 */
export async function expectError<T extends Error>(
  promise: Promise<any>,
  errorType: new (...args: any[]) => T,
  message?: string
): Promise<T> {
  try {
    await promise;
    throw new Error(`Expected promise to reject with ${errorType.name}`);
  } catch (error) {
    if (error instanceof errorType) {
      if (message && !error.message.includes(message)) {
        throw new Error(
          `Expected error message to include "${message}", got "${error.message}"`
        );
      }
      return error;
    }
    throw error;
  }
}

/**
 * Mock current date/time for consistent tests
 * @param date - Date to freeze time to
 * @returns Cleanup function
 */
export function freezeTime(date: Date): () => void {
  const originalDate = global.Date;
  const frozenTime = date.getTime();

  class MockDate extends Date {
    constructor();
    constructor(value: number | string);
    constructor(
      year: number,
      month: number,
      date?: number,
      hours?: number,
      minutes?: number,
      seconds?: number,
      ms?: number
    );
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(frozenTime);
      } else {
        super(...(args as [any]));
      }
    }

    static now(): number {
      return frozenTime;
    }
  }

  global.Date = MockDate as any;

  return () => {
    global.Date = originalDate;
  };
}

/**
 * Generate test data with consistent structure
 */
export const testDataGenerators = {
  /**
   * Generate a valid screenshot request
   */
  screenshotRequest(overrides = {}) {
    return {
      url: 'https://example.com',
      format: 'png' as const,
      fullPage: false,
      viewport: { width: 1920, height: 1080 },
      ...overrides,
    };
  },

  /**
   * Generate a valid PDF request
   */
  pdfRequest(overrides = {}) {
    return {
      url: 'https://example.com',
      format: 'A4' as const,
      landscape: false,
      printBackground: true,
      ...overrides,
    };
  },

  /**
   * Generate a test account
   */
  account(overrides = {}) {
    return {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      plan: 'free' as const,
      ...overrides,
    };
  },

  /**
   * Generate a test API key
   */
  apiKey(overrides = {}) {
    return {
      key: `sk_test_${Math.random().toString(36).substring(2)}`,
      name: 'Test API Key',
      ...overrides,
    };
  },
};
