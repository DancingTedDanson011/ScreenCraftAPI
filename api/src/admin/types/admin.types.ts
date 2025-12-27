// Admin Types for ScreenCraft Overwatch Terminal

import { AdminRole } from '@prisma/client';

/**
 * Admin user info attached to request after authentication
 */
export interface AdminInfo {
  adminId: string;
  email: string;
  name: string;
  role: AdminRole;
}

/**
 * JWT Payload for admin tokens
 */
export interface AdminJwtPayload {
  adminId: string;
  email: string;
  role: AdminRole;
  iat?: number;
  exp?: number;
}

/**
 * Server metrics snapshot
 */
export interface ServerMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  platform: string;
  hostname: string;
  nodeVersion: string;
  pid: number;
}

/**
 * Browser pool metrics
 */
export interface BrowserPoolMetrics {
  totalBrowsers: number;
  activeBrowsers: number;
  totalContexts: number;
  activeContexts: number;
  averageContextsPerBrowser: number;
  oldestBrowserAge: number;
  totalUsageCount: number;
}

/**
 * Queue metrics for a single queue
 */
export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Combined queue metrics
 */
export interface AllQueueMetrics {
  screenshot: QueueMetrics;
  pdf: QueueMetrics;
}

/**
 * Overview metrics for dashboard
 */
export interface OverviewMetrics {
  server: ServerMetrics;
  browser: BrowserPoolMetrics;
  queue: AllQueueMetrics;
  timestamp: string;
}

/**
 * User list item for admin panel
 */
export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  monthlyCredits: number;
  usedCredits: number;
  apiKeyCount: number;
  createdAt: Date;
  lastLoginAt: Date | null;
  isBanned: boolean;
}

/**
 * API Key list item for admin panel
 */
export interface AdminApiKeyListItem {
  id: string;
  prefix: string;
  name: string | null;
  accountId: string;
  accountEmail: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

/**
 * Job list item for admin panel
 */
export interface AdminJobListItem {
  id: string;
  type: 'screenshot' | 'pdf';
  status: string;
  accountId: string;
  url: string | null;
  createdAt: Date;
  completedAt: Date | null;
  error: string | null;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  adminId: string | null;
  adminEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: Date;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Admin login request
 */
export interface AdminLoginRequest {
  email: string;
  password: string;
}

/**
 * Admin login response
 */
export interface AdminLoginResponse {
  token: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: AdminRole;
  };
  expiresAt: string;
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | 'metrics'
  | 'alert'
  | 'job_update'
  | 'user_activity';

/**
 * WebSocket message structure
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  timestamp: string;
}
