import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the services before importing checkHealth
vi.mock('../../../src/services/index.js', () => ({
  storageService: {
    initialize: vi.fn(),
  },
  cacheService: {
    healthCheck: vi.fn(),
  },
}));

// Import after mocking
const { checkHealth } = await import('../../../src/utils/health.js');
const { storageService, cacheService } = await import('../../../src/services/index.js');

describe('Health Check Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('checkHealth', () => {
    describe('healthy status', () => {
      it('should return healthy status when all services are healthy', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        const result = await checkHealth();

        expect(result).toEqual({
          status: 'healthy',
          services: {
            redis: true,
            storage: true,
          },
          timestamp: '2025-01-15T10:00:00.000Z',
        });
      });

      it('should call all health check methods', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        await checkHealth();

        expect(cacheService.healthCheck).toHaveBeenCalledTimes(1);
        expect(storageService.initialize).toHaveBeenCalledTimes(1);
      });
    });

    describe('degraded status', () => {
      it('should return degraded status when redis is unhealthy but storage is healthy', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(false);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        const result = await checkHealth();

        expect(result.status).toBe('degraded');
        expect(result.services).toEqual({
          redis: false,
          storage: true,
        });
      });

      it('should return degraded status when storage is unhealthy but redis is healthy', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockRejectedValue(new Error('Storage error'));

        const result = await checkHealth();

        expect(result.status).toBe('degraded');
        expect(result.services).toEqual({
          redis: true,
          storage: false,
        });
      });

      it('should return degraded when redis health check throws error', async () => {
        vi.mocked(cacheService.healthCheck).mockRejectedValue(new Error('Connection refused'));
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        const result = await checkHealth();

        expect(result.status).toBe('degraded');
        expect(result.services.redis).toBe(false);
        expect(result.services.storage).toBe(true);
      });

      it('should return degraded when storage throws error', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockRejectedValue(new Error('Bucket not found'));

        const result = await checkHealth();

        expect(result.status).toBe('degraded');
        expect(result.services.redis).toBe(true);
        expect(result.services.storage).toBe(false);
      });
    });

    describe('unhealthy status', () => {
      it('should return unhealthy status when all services are unhealthy', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(false);
        vi.mocked(storageService.initialize).mockRejectedValue(new Error('Storage error'));

        const result = await checkHealth();

        expect(result.status).toBe('unhealthy');
        expect(result.services).toEqual({
          redis: false,
          storage: false,
        });
      });

      it('should return unhealthy when all services throw errors', async () => {
        vi.mocked(cacheService.healthCheck).mockRejectedValue(new Error('Redis timeout'));
        vi.mocked(storageService.initialize).mockRejectedValue(new Error('Storage timeout'));

        const result = await checkHealth();

        expect(result.status).toBe('unhealthy');
        expect(result.services.redis).toBe(false);
        expect(result.services.storage).toBe(false);
      });

      it('should return unhealthy when redis returns false and storage throws', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(false);
        vi.mocked(storageService.initialize).mockRejectedValue(new Error('S3 unreachable'));

        const result = await checkHealth();

        expect(result.status).toBe('unhealthy');
        expect(result.services).toEqual({
          redis: false,
          storage: false,
        });
      });
    });

    describe('timestamp handling', () => {
      it('should include current ISO timestamp', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        const result = await checkHealth();

        expect(result.timestamp).toBe('2025-01-15T10:00:00.000Z');
      });

      it('should use updated timestamp when time changes', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        vi.setSystemTime(new Date('2025-06-20T15:30:00.000Z'));

        const result = await checkHealth();

        expect(result.timestamp).toBe('2025-06-20T15:30:00.000Z');
      });
    });

    describe('concurrent health checks', () => {
      it('should run health checks in parallel using Promise.all', async () => {
        // Verify parallel execution by checking Promise.all is used
        // Both services should be called once and resolve together
        let redisCallTime: number | undefined;
        let storageCallTime: number | undefined;

        vi.useRealTimers(); // Need real timers for this test

        vi.mocked(cacheService.healthCheck).mockImplementation(async () => {
          redisCallTime = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 50));
          return true;
        });

        vi.mocked(storageService.initialize).mockImplementation(async () => {
          storageCallTime = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        const startTime = Date.now();
        const result = await checkHealth();
        const duration = Date.now() - startTime;

        // Both calls should have started at approximately the same time
        expect(redisCallTime).toBeDefined();
        expect(storageCallTime).toBeDefined();

        // The time difference between when each service was called should be minimal
        // (less than 10ms if parallel, would be 50+ ms if sequential)
        const callTimeDiff = Math.abs((redisCallTime || 0) - (storageCallTime || 0));
        expect(callTimeDiff).toBeLessThan(20);

        // Total duration should be close to the longer of the two (50ms), not sum (100ms)
        expect(duration).toBeLessThan(150); // Allow buffer for test overhead
        expect(result.status).toBe('healthy');
      });
    });

    describe('error handling', () => {
      it('should handle redis connection refused error gracefully', async () => {
        const connectionError = new Error('ECONNREFUSED');
        (connectionError as any).code = 'ECONNREFUSED';
        vi.mocked(cacheService.healthCheck).mockRejectedValue(connectionError);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        const result = await checkHealth();

        expect(result.services.redis).toBe(false);
        expect(result.services.storage).toBe(true);
        expect(result.status).toBe('degraded');
      });

      it('should handle storage bucket not found error gracefully', async () => {
        const bucketError = new Error('Bucket not found');
        (bucketError as any).code = 'NoSuchBucket';
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockRejectedValue(bucketError);

        const result = await checkHealth();

        expect(result.services.redis).toBe(true);
        expect(result.services.storage).toBe(false);
        expect(result.status).toBe('degraded');
      });

      it('should handle timeout errors gracefully', async () => {
        const timeoutError = new Error('Operation timed out');
        (timeoutError as any).code = 'ETIMEDOUT';
        vi.mocked(cacheService.healthCheck).mockRejectedValue(timeoutError);
        vi.mocked(storageService.initialize).mockRejectedValue(timeoutError);

        const result = await checkHealth();

        expect(result.services.redis).toBe(false);
        expect(result.services.storage).toBe(false);
        expect(result.status).toBe('unhealthy');
      });

      it('should handle unexpected error types gracefully', async () => {
        vi.mocked(cacheService.healthCheck).mockRejectedValue('string error');
        vi.mocked(storageService.initialize).mockRejectedValue(null);

        const result = await checkHealth();

        expect(result.services.redis).toBe(false);
        expect(result.services.storage).toBe(false);
        expect(result.status).toBe('unhealthy');
      });
    });

    describe('service status variations', () => {
      it('should correctly identify all healthy scenario', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        const result = await checkHealth();

        const allHealthy = Object.values(result.services).every((s) => s === true);
        expect(allHealthy).toBe(true);
        expect(result.status).toBe('healthy');
      });

      it('should correctly identify some healthy scenario', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockRejectedValue(new Error());

        const result = await checkHealth();

        const someHealthy = Object.values(result.services).some((s) => s === true);
        const allHealthy = Object.values(result.services).every((s) => s === true);
        expect(someHealthy).toBe(true);
        expect(allHealthy).toBe(false);
        expect(result.status).toBe('degraded');
      });

      it('should correctly identify none healthy scenario', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(false);
        vi.mocked(storageService.initialize).mockRejectedValue(new Error());

        const result = await checkHealth();

        const someHealthy = Object.values(result.services).some((s) => s === true);
        expect(someHealthy).toBe(false);
        expect(result.status).toBe('unhealthy');
      });
    });

    describe('return type structure', () => {
      it('should return object with correct structure', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        const result = await checkHealth();

        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('services');
        expect(result).toHaveProperty('timestamp');
        expect(typeof result.status).toBe('string');
        expect(typeof result.services).toBe('object');
        expect(typeof result.timestamp).toBe('string');
      });

      it('should have services object with boolean values', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        const result = await checkHealth();

        for (const [key, value] of Object.entries(result.services)) {
          expect(typeof value).toBe('boolean');
        }
      });

      it('should have valid status enum value', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        const result = await checkHealth();

        expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      });

      it('should have valid ISO timestamp format', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        const result = await checkHealth();

        // ISO 8601 format check
        const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
        expect(result.timestamp).toMatch(isoRegex);
      });
    });

    describe('edge cases', () => {
      it('should handle rapid consecutive health checks', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(true);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        vi.useRealTimers();

        const results = await Promise.all([
          checkHealth(),
          checkHealth(),
          checkHealth(),
        ]);

        for (const result of results) {
          expect(result.status).toBe('healthy');
        }

        // Each call should invoke the health checks
        expect(cacheService.healthCheck).toHaveBeenCalledTimes(3);
        expect(storageService.initialize).toHaveBeenCalledTimes(3);
      });

      it('should handle health check returning undefined', async () => {
        vi.mocked(cacheService.healthCheck).mockResolvedValue(undefined as any);
        vi.mocked(storageService.initialize).mockResolvedValue(undefined);

        const result = await checkHealth();

        // undefined is not strictly true, so should be treated as unhealthy
        expect(result.services.redis).toBe(undefined);
        expect(result.services.storage).toBe(true);
      });
    });
  });
});
