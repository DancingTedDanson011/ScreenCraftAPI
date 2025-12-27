/**
 * Global type definitions for ScreenCraft API
 */

// Storage types
export interface StorageUploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export interface StorageMetadata {
  userId: string;
  fileName: string;
  uploadedAt: string;
  [key: string]: string;
}

// Cache types
export interface CachedScreenshot {
  url: string;
  storageKey: string;
  width: number;
  height: number;
  format: string;
  cachedAt: number;
}

export interface CachedPdf {
  url: string;
  storageKey: string;
  pageCount: number;
  cachedAt: number;
}

// Rate limiting
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  retryAfter?: number; // Seconds
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

// Health check
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database?: boolean;
    redis?: boolean;
    storage?: boolean;
  };
  timestamp: string;
}
