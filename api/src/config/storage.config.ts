import { config } from './index';

export interface StorageConfig {
  endpoint: string;
  port: number;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  useSSL: boolean;
  region?: string;
}

/**
 * Get storage configuration from environment
 */
export function getStorageConfig(): StorageConfig {
  return {
    endpoint: config.minio.endpoint,
    port: config.minio.port,
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
    bucket: config.minio.bucket,
    useSSL: config.minio.useSSL,
    region: config.minio.region,
  };
}

/**
 * Storage configuration constants
 */
export const STORAGE_CONSTANTS = {
  DEFAULT_EXPIRATION: 3600, // 1 hour in seconds
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_MIME_TYPES: {
    images: ['image/png', 'image/jpeg', 'image/webp'],
    pdf: ['application/pdf'],
  },
  BUCKETS: {
    screenshots: 'screenshots',
    pdfs: 'pdfs',
  },
  PATHS: {
    screenshots: 'screenshots',
    pdfs: 'pdfs',
    temp: 'temp',
  },
} as const;

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxSize: number = STORAGE_CONSTANTS.MAX_FILE_SIZE): void {
  if (size > maxSize) {
    throw new Error(`File size exceeds maximum allowed size of ${maxSize} bytes`);
  }
}

/**
 * Validate MIME type
 */
export function validateMimeType(contentType: string, allowedTypes: string[]): void {
  if (!allowedTypes.includes(contentType)) {
    throw new Error(`Invalid content type: ${contentType}. Allowed types: ${allowedTypes.join(', ')}`);
  }
}

/**
 * Generate storage key with timestamp and sanitization
 */
export function generateStorageKey(prefix: string, userId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${prefix}/${userId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    pdf: 'application/pdf',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}
