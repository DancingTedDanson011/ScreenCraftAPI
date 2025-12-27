import Redis, { RedisOptions } from 'ioredis';
import crypto from 'crypto';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface ApiKeyInfo {
  id: string;
  userId: string;
  name: string;
  tier: string;
  rateLimit: number;
  createdAt: Date;
}

export class CacheService {
  private redis: Redis;
  private keyPrefix: string;

  constructor(config?: Partial<CacheConfig>) {
    const redisOptions: RedisOptions = {
      host: config?.host || process.env.REDIS_HOST || 'localhost',
      port: config?.port || parseInt(process.env.REDIS_PORT || '6379', 10),
      password: config?.password || process.env.REDIS_PASSWORD || undefined,
      db: config?.db || 0,
      keyPrefix: config?.keyPrefix || 'screencraft:',
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

    this.redis = new Redis(redisOptions);
    this.keyPrefix = redisOptions.keyPrefix || 'screencraft:';

    // Error handling
    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Parsed value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional)
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a value from cache
   * @param key - Cache key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * @param pattern - Key pattern (e.g., "user:123:*")
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const stream = this.redis.scanStream({
        match: this.keyPrefix + pattern,
        count: 100,
      });

      let deletedCount = 0;
      const pipeline = this.redis.pipeline();

      for await (const keys of stream) {
        if (keys.length > 0) {
          for (const key of keys) {
            // Remove prefix for deletion
            const keyWithoutPrefix = key.replace(this.keyPrefix, '');
            pipeline.del(keyWithoutPrefix);
            deletedCount++;
          }
        }
      }

      await pipeline.exec();
      return deletedCount;
    } catch (error) {
      console.error(`Cache delete pattern error for pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Check if a key exists
   * @param key - Cache key
   * @returns true if key exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Generate cache key for screenshot
   * @param url - Screenshot URL
   * @param options - Screenshot options
   * @returns Cache key
   */
  generateScreenshotCacheKey(url: string, options: Record<string, any>): string {
    const optionsHash = this.hashObject(options);
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    return `screenshot:${urlHash}:${optionsHash}`;
  }

  /**
   * Generate cache key for PDF
   * @param url - PDF URL
   * @param options - PDF options
   * @returns Cache key
   */
  generatePdfCacheKey(url: string, options: Record<string, any>): string {
    const optionsHash = this.hashObject(options);
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    return `pdf:${urlHash}:${optionsHash}`;
  }

  /**
   * Cache API key information
   * @param hash - API key hash
   * @param data - API key information
   * @param ttl - Time to live in seconds (default: 1 hour)
   */
  async cacheApiKey(hash: string, data: ApiKeyInfo, ttl: number = 3600): Promise<void> {
    const key = `apikey:${hash}`;
    await this.set(key, data, ttl);
  }

  /**
   * Get cached API key information
   * @param hash - API key hash
   * @returns API key information or null if not found
   */
  async getApiKey(hash: string): Promise<ApiKeyInfo | null> {
    const key = `apikey:${hash}`;
    return this.get<ApiKeyInfo>(key);
  }

  /**
   * Invalidate API key cache
   * @param hash - API key hash
   */
  async invalidateApiKey(hash: string): Promise<void> {
    const key = `apikey:${hash}`;
    await this.delete(key);
  }

  /**
   * Cache rate limit information
   * @param identifier - Identifier (e.g., API key hash or IP)
   * @param count - Current request count
   * @param ttl - Time to live in seconds
   */
  async setRateLimit(identifier: string, count: number, ttl: number): Promise<void> {
    const key = `ratelimit:${identifier}`;
    await this.set(key, count, ttl);
  }

  /**
   * Get rate limit count
   * @param identifier - Identifier (e.g., API key hash or IP)
   * @returns Current count or null
   */
  async getRateLimit(identifier: string): Promise<number | null> {
    const key = `ratelimit:${identifier}`;
    return this.get<number>(key);
  }

  /**
   * Increment rate limit counter atomically
   * @param identifier - Identifier (e.g., API key hash or IP)
   * @param ttl - Time to live in seconds
   * @returns New count
   */
  async incrementRateLimit(identifier: string, ttl: number): Promise<number> {
    const key = `ratelimit:${identifier}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      // First request, set expiry
      await this.redis.expire(key, ttl);
    }

    return count;
  }

  /**
   * Get TTL for a key
   * @param key - Cache key
   * @returns TTL in seconds or -1 if no expiry, -2 if key doesn't exist
   */
  async getTTL(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Hash an object to create a consistent cache key
   * @param obj - Object to hash
   * @returns MD5 hash of the object
   */
  private hashObject(obj: Record<string, any>): string {
    // Sort keys for consistent hashing
    const sorted = Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
      }, {} as Record<string, any>);

    const str = JSON.stringify(sorted);
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Health check
   * @returns true if Redis is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}
