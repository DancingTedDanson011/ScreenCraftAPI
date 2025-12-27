import { CacheService } from './cache.service.js';

/**
 * Singleton instance of CacheService
 * Configured from environment variables
 */
export const cacheService = new CacheService();

// Export types and class
export { CacheService } from './cache.service.js';
export type { CacheConfig, ApiKeyInfo } from './cache.service.js';
