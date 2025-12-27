import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create a mock Redis class
class MockRedis {
  get = vi.fn();
  set = vi.fn();
  setex = vi.fn();
  del = vi.fn();
  exists = vi.fn();
  incr = vi.fn();
  expire = vi.fn();
  ttl = vi.fn();
  ping = vi.fn();
  quit = vi.fn();
  on = vi.fn();
  scanStream = vi.fn();
  pipeline = vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  }));
}

const mockRedisInstance = new MockRedis();

// Mock ioredis as a class constructor
vi.mock('ioredis', () => {
  return {
    default: class Redis {
      get = mockRedisInstance.get;
      set = mockRedisInstance.set;
      setex = mockRedisInstance.setex;
      del = mockRedisInstance.del;
      exists = mockRedisInstance.exists;
      incr = mockRedisInstance.incr;
      expire = mockRedisInstance.expire;
      ttl = mockRedisInstance.ttl;
      ping = mockRedisInstance.ping;
      quit = mockRedisInstance.quit;
      on = mockRedisInstance.on;
      scanStream = mockRedisInstance.scanStream;
      pipeline = mockRedisInstance.pipeline;
    },
  };
});

// Import after mocking
const { CacheService } = await import('../../../src/services/cache/cache.service.js');

// Reference for tests
const mockRedis = mockRedisInstance;

describe('CacheService', () => {
  let service: InstanceType<typeof CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CacheService({
      host: 'localhost',
      port: 6379,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('should return parsed value for existing key', async () => {
      const testData = { name: 'test', value: 123 };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await service.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existing key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set a value without TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('test-key', { data: 'value' });

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'value' })
      );
    });

    it('should set a value with TTL using setex', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.set('test-key', { data: 'value' }, 3600);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        3600,
        JSON.stringify({ data: 'value' })
      );
    });

    it('should throw on set error', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      await expect(service.set('test-key', { data: 'value' })).rejects.toThrow(
        'Redis error'
      );
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.delete('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should throw on delete error', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.delete('test-key')).rejects.toThrow('Redis error');
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.exists('test-key');

      expect(result).toBe(true);
    });

    it('should return false for non-existing key', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.exists('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Redis error'));

      const result = await service.exists('test-key');

      expect(result).toBe(false);
    });
  });

  describe('getTTL', () => {
    it('should return TTL for key with expiry', async () => {
      mockRedis.ttl.mockResolvedValue(3500);

      const ttl = await service.getTTL('test-key');

      expect(ttl).toBe(3500);
    });

    it('should return -1 for key without expiry', async () => {
      mockRedis.ttl.mockResolvedValue(-1);

      const ttl = await service.getTTL('test-key');

      expect(ttl).toBe(-1);
    });

    it('should return -2 for non-existing key', async () => {
      mockRedis.ttl.mockResolvedValue(-2);

      const ttl = await service.getTTL('nonexistent');

      expect(ttl).toBe(-2);
    });

    it('should return -2 on error', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Redis error'));

      const ttl = await service.getTTL('test-key');

      expect(ttl).toBe(-2);
    });
  });

  describe('incrementRateLimit', () => {
    it('should increment and set expiry on first request', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const count = await service.incrementRateLimit('user-123', 60);

      expect(count).toBe(1);
      expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:user-123');
      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:user-123', 60);
    });

    it('should only increment on subsequent requests', async () => {
      mockRedis.incr.mockResolvedValue(5);

      const count = await service.incrementRateLimit('user-123', 60);

      expect(count).toBe(5);
      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe('cacheApiKey', () => {
    it('should cache API key with default TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const apiKeyData = {
        id: 'key-123',
        userId: 'user-123',
        name: 'Test Key',
        tier: 'pro',
        rateLimit: 1000,
        createdAt: new Date(),
      };

      await service.cacheApiKey('hash123', apiKeyData);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'apikey:hash123',
        3600,
        JSON.stringify(apiKeyData)
      );
    });

    it('should cache API key with custom TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const apiKeyData = {
        id: 'key-123',
        userId: 'user-123',
        name: 'Test Key',
        tier: 'pro',
        rateLimit: 1000,
        createdAt: new Date(),
      };

      await service.cacheApiKey('hash123', apiKeyData, 7200);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'apikey:hash123',
        7200,
        expect.any(String)
      );
    });
  });

  describe('getApiKey', () => {
    it('should return cached API key', async () => {
      const apiKeyData = {
        id: 'key-123',
        userId: 'user-123',
        name: 'Test Key',
        tier: 'pro',
        rateLimit: 1000,
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(apiKeyData));

      const result = await service.getApiKey('hash123');

      expect(result).toEqual(apiKeyData);
      expect(mockRedis.get).toHaveBeenCalledWith('apikey:hash123');
    });

    it('should return null for non-existing API key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getApiKey('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('invalidateApiKey', () => {
    it('should delete API key from cache', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateApiKey('hash123');

      expect(mockRedis.del).toHaveBeenCalledWith('apikey:hash123');
    });
  });

  describe('generateScreenshotCacheKey', () => {
    it('should generate consistent cache key', () => {
      const key1 = service.generateScreenshotCacheKey('https://example.com', {
        width: 1920,
        height: 1080,
      });
      const key2 = service.generateScreenshotCacheKey('https://example.com', {
        width: 1920,
        height: 1080,
      });

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^screenshot:/);
    });

    it('should generate different keys for different options', () => {
      const key1 = service.generateScreenshotCacheKey('https://example.com', {
        width: 1920,
        height: 1080,
      });
      const key2 = service.generateScreenshotCacheKey('https://example.com', {
        width: 1440,
        height: 900,
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different URLs', () => {
      const options = { width: 1920, height: 1080 };
      const key1 = service.generateScreenshotCacheKey('https://example.com', options);
      const key2 = service.generateScreenshotCacheKey('https://other.com', options);

      expect(key1).not.toBe(key2);
    });
  });

  describe('generatePdfCacheKey', () => {
    it('should generate consistent cache key', () => {
      const key1 = service.generatePdfCacheKey('https://example.com', {
        format: 'A4',
      });
      const key2 = service.generatePdfCacheKey('https://example.com', {
        format: 'A4',
      });

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^pdf:/);
    });
  });

  describe('healthCheck', () => {
    it('should return true when Redis is healthy', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when Redis is unhealthy', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('close', () => {
    it('should close Redis connection', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await service.close();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
