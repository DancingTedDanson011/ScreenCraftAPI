import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.string().transform(Number).default('9000'),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('screenshots'),
  MINIO_USE_SSL: z.string().transform(val => val === 'true').default('false'),
  MINIO_REGION: z.string().default('eu-central-1'),

  API_RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  API_RATE_LIMIT_WINDOW: z.string().default('15m'),

  PLAYWRIGHT_TIMEOUT: z.string().transform(Number).default('30000'),
  PLAYWRIGHT_NAVIGATION_TIMEOUT: z.string().transform(Number).default('30000'),
  MAX_CONCURRENT_BROWSERS: z.string().transform(Number).default('5'),

  STORAGE_TYPE: z.enum(['minio', 'local']).default('minio'),
  STORAGE_PATH: z.string().default('./uploads'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.string().transform(val => val === 'true').default('true'),

  CORS_ORIGIN: z.string().default('http://localhost:3001'),

  // Admin Configuration
  // C-05: No default for JWT secret - must be explicitly set
  // In development, use a dev-only fallback; in production, require explicit config
  ADMIN_JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters').optional(),
  ADMIN_JWT_EXPIRES_IN: z.string().default('8h'),
  ADMIN_ENABLED: z.string().transform(val => val === 'true').default('true'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

// C-05: Validate JWT secret based on environment
const nodeEnv = parsedEnv.data.NODE_ENV;
const jwtSecret = parsedEnv.data.ADMIN_JWT_SECRET;

if (nodeEnv === 'production' && !jwtSecret) {
  console.error('FATAL: ADMIN_JWT_SECRET must be set in production environment');
  console.error('Generate a secure secret with: openssl rand -hex 32');
  process.exit(1);
}

// Use dev fallback only in development/test
const resolvedJwtSecret = jwtSecret || (
  nodeEnv === 'development' || nodeEnv === 'test'
    ? 'dev-only-secret-not-for-production-min32chars'
    : ''
);

export const config = {
  server: {
    env: parsedEnv.data.NODE_ENV,
    port: parsedEnv.data.PORT,
    host: parsedEnv.data.HOST,
    isDevelopment: parsedEnv.data.NODE_ENV === 'development',
    isProduction: parsedEnv.data.NODE_ENV === 'production',
  },

  database: {
    url: parsedEnv.data.DATABASE_URL,
  },

  redis: {
    host: parsedEnv.data.REDIS_HOST,
    port: parsedEnv.data.REDIS_PORT,
    password: parsedEnv.data.REDIS_PASSWORD,
  },

  minio: {
    endpoint: parsedEnv.data.MINIO_ENDPOINT,
    port: parsedEnv.data.MINIO_PORT,
    accessKey: parsedEnv.data.MINIO_ACCESS_KEY,
    secretKey: parsedEnv.data.MINIO_SECRET_KEY,
    bucket: parsedEnv.data.MINIO_BUCKET,
    useSSL: parsedEnv.data.MINIO_USE_SSL,
    region: parsedEnv.data.MINIO_REGION,
  },

  api: {
    rateLimit: {
      max: parsedEnv.data.API_RATE_LIMIT_MAX,
      timeWindow: parsedEnv.data.API_RATE_LIMIT_WINDOW,
    },
  },

  playwright: {
    timeout: parsedEnv.data.PLAYWRIGHT_TIMEOUT,
    navigationTimeout: parsedEnv.data.PLAYWRIGHT_NAVIGATION_TIMEOUT,
    maxConcurrentBrowsers: parsedEnv.data.MAX_CONCURRENT_BROWSERS,
  },

  storage: {
    type: parsedEnv.data.STORAGE_TYPE,
    path: parsedEnv.data.STORAGE_PATH,
  },

  logging: {
    level: parsedEnv.data.LOG_LEVEL,
    pretty: parsedEnv.data.LOG_PRETTY,
  },

  cors: {
    origin: parsedEnv.data.CORS_ORIGIN.split(',').map(o => o.trim()),
  },

  admin: {
    // C-05: Use resolved secret (validated above)
    jwtSecret: resolvedJwtSecret,
    jwtExpiresIn: parsedEnv.data.ADMIN_JWT_EXPIRES_IN,
    enabled: parsedEnv.data.ADMIN_ENABLED,
  },
} as const;

export type Config = typeof config;
