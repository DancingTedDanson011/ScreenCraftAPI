import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from 'testcontainers';
import { vi } from 'vitest';

/**
 * Test database management for integration tests
 */
export class TestDatabase {
  private container: StartedPostgreSqlContainer | null = null;
  private prisma: PrismaClient | null = null;
  private connectionUrl: string | null = null;

  /**
   * Start a PostgreSQL container for testing
   * @param options - Container options
   */
  async start(options?: {
    database?: string;
    username?: string;
    password?: string;
  }): Promise<void> {
    const database = options?.database || 'screencraft_test';
    const username = options?.username || 'test';
    const password = options?.password || 'test';

    this.container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase(database)
      .withUsername(username)
      .withPassword(password)
      .withExposedPorts(5432)
      .start();

    this.connectionUrl = this.container.getConnectionUri();

    // Set environment variable for Prisma
    process.env.DATABASE_URL = this.connectionUrl;

    // Initialize Prisma client
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: this.connectionUrl,
        },
      },
      log: ['error'],
    });

    await this.prisma.$connect();
  }

  /**
   * Run migrations on the test database
   */
  async migrate(): Promise<void> {
    if (!this.connectionUrl) {
      throw new Error('Database not started. Call start() first.');
    }

    // Run prisma migrate deploy
    const { execSync } = await import('child_process');
    execSync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: this.connectionUrl,
      },
      stdio: 'pipe',
    });
  }

  /**
   * Get the Prisma client
   */
  getClient(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database not started. Call start() first.');
    }
    return this.prisma;
  }

  /**
   * Get the connection URL
   */
  getConnectionUrl(): string {
    if (!this.connectionUrl) {
      throw new Error('Database not started. Call start() first.');
    }
    return this.connectionUrl;
  }

  /**
   * Clean all data from the database
   */
  async clean(): Promise<void> {
    if (!this.prisma) {
      throw new Error('Database not started. Call start() first.');
    }

    const tablenames = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await this.prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "public"."${tablename}" CASCADE;`
        );
      }
    }
  }

  /**
   * Stop the database container
   */
  async stop(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }

    if (this.container) {
      await this.container.stop();
      this.container = null;
    }

    this.connectionUrl = null;
  }
}

/**
 * Create a mock Prisma client for unit tests
 * @returns Mocked Prisma client
 */
export function createMockPrisma() {
  const mockPrisma = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn().mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') {
        return fn(mockPrisma);
      }
      return Promise.all(fn);
    }),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),

    // Account model
    account: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },

    // ApiKey model
    apiKey: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },

    // Screenshot model
    screenshot: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },

    // Pdf model
    pdf: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },

    // Usage model
    usage: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },

    // Subscription model
    subscription: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
  };

  return mockPrisma as unknown as PrismaClient & typeof mockPrisma;
}

/**
 * Seed data factories for testing
 */
export const seedFactories = {
  /**
   * Create a test account in the database
   */
  async createAccount(
    prisma: PrismaClient,
    overrides?: Partial<{
      email: string;
      name: string;
      stripeCustomerId: string | null;
    }>
  ) {
    return prisma.account.create({
      data: {
        email: overrides?.email || `test-${Date.now()}@example.com`,
        name: overrides?.name || 'Test User',
        stripeCustomerId: overrides?.stripeCustomerId || null,
      },
    });
  },

  /**
   * Create a test API key in the database
   */
  async createApiKey(
    prisma: PrismaClient,
    accountId: string,
    overrides?: Partial<{
      key: string;
      name: string;
      isActive: boolean;
    }>
  ) {
    return prisma.apiKey.create({
      data: {
        key: overrides?.key || `sk_test_${Math.random().toString(36).substring(2)}`,
        name: overrides?.name || 'Test API Key',
        isActive: overrides?.isActive ?? true,
        accountId,
      },
    });
  },

  /**
   * Create a test screenshot record
   */
  async createScreenshot(
    prisma: PrismaClient,
    accountId: string,
    overrides?: Partial<{
      url: string;
      format: string;
      storageKey: string;
      status: string;
    }>
  ) {
    return prisma.screenshot.create({
      data: {
        url: overrides?.url || 'https://example.com',
        format: overrides?.format || 'png',
        storageKey: overrides?.storageKey || `screenshots/test/${Date.now()}.png`,
        status: overrides?.status || 'completed',
        accountId,
      },
    });
  },
};
