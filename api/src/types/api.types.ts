import { FastifyRequest, FastifyReply } from 'fastify';
import type {
  ScreenshotRequest,
  ScreenshotResponse,
  GetScreenshotParams,
  ListScreenshotsQuery,
} from '../schemas/screenshot.schema';
import type {
  PdfRequest,
  PdfResponse,
  GetPdfParams,
  ListPdfsQuery,
} from '../schemas/pdf.schema';

// Base API Response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

// API Error
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

// Response Metadata
export interface ResponseMeta {
  timestamp: string;
  requestId: string;
  version: string;
  pagination?: PaginationMeta;
}

// Pagination Metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Screenshot API Types
export interface CreateScreenshotRequest extends FastifyRequest {
  body: ScreenshotRequest;
}

export interface GetScreenshotRequest extends FastifyRequest {
  params: GetScreenshotParams;
}

export interface ListScreenshotsRequest extends FastifyRequest {
  querystring: ListScreenshotsQuery;
}

export interface DownloadScreenshotRequest extends FastifyRequest {
  params: GetScreenshotParams;
}

// PDF API Types
export interface CreatePdfRequest extends FastifyRequest {
  body: PdfRequest;
}

export interface GetPdfRequest extends FastifyRequest {
  params: GetPdfParams;
}

export interface ListPdfsRequest extends FastifyRequest {
  querystring: ListPdfsQuery;
}

export interface DownloadPdfRequest extends FastifyRequest {
  params: GetPdfParams;
}

// Job Types
export interface JobStatus {
  id: string;
  type: 'screenshot' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// Rate Limit Types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// Storage Types
export interface StorageInfo {
  path: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
  expiresAt?: Date;
}

// Webhook Types
export interface WebhookPayload {
  event: 'screenshot.completed' | 'screenshot.failed' | 'pdf.completed' | 'pdf.failed';
  timestamp: string;
  data: ScreenshotResponse | PdfResponse;
}

// Error Codes
export enum ErrorCode {
  // Validation Errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_URL = 'INVALID_URL',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Authentication Errors (401)
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  EXPIRED_API_KEY = 'EXPIRED_API_KEY',

  // Permission Errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Not Found Errors (404)
  NOT_FOUND = 'NOT_FOUND',
  SCREENSHOT_NOT_FOUND = 'SCREENSHOT_NOT_FOUND',
  PDF_NOT_FOUND = 'PDF_NOT_FOUND',

  // Rate Limit Errors (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Server Errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  BROWSER_ERROR = 'BROWSER_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',

  // Timeout Errors (504)
  TIMEOUT = 'TIMEOUT',
  NAVIGATION_TIMEOUT = 'NAVIGATION_TIMEOUT',
}

// HTTP Status Codes
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

// Controller Return Types
export type ControllerResponse<T = any> = {
  statusCode: HttpStatus;
  body: ApiResponse<T>;
};

export type ControllerHandler<TRequest = any, TResponse = any> = (
  request: TRequest,
  reply: FastifyReply
) => Promise<void>;
