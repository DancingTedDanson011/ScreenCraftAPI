import { createStorageService, StorageService } from './storage.service.js';

/**
 * Singleton storage service instance
 */
let storageServiceInstance: StorageService | null = null;

/**
 * Get or create the singleton storage service instance
 */
export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = createStorageService();
  }
  return storageServiceInstance;
}

/**
 * Initialize the storage service
 * Call this during application startup
 */
export async function initializeStorage(): Promise<void> {
  const service = getStorageService();
  await service.initialize();
}

/**
 * Reset the storage service instance (useful for testing)
 */
export function resetStorageService(): void {
  storageServiceInstance = null;
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use getStorageService() instead
 */
export const storageService = getStorageService();

// Export types and class
export { StorageService, createStorageService } from './storage.service.js';
export type { StorageConfig, UploadResult, DownloadResult } from './storage.service.js';
