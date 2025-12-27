// Logger Configuration
// Uses pino for structured JSON logging

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Configured pino logger instance
 * - Development: Pretty printed, all levels
 * - Production: JSON, warn and above
 * - Test: Silent unless explicitly enabled
 */
export const logger = pino({
  level: isTest ? 'silent' : (isDevelopment ? 'debug' : 'warn'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'screencraft-api',
    env: process.env.NODE_ENV || 'development',
  },
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
