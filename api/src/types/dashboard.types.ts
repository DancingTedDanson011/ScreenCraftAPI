// Dashboard Types

import { Tier, EventType } from '@prisma/client';

// ============================================
// OVERVIEW
// ============================================

export interface DashboardOverview {
  account: {
    id: string;
    email: string;
    tier: Tier;
    createdAt: Date;
  };
  quota: {
    used: number;
    limit: number;
    percentage: number;
    resetDate: Date;
  };
  usage: {
    screenshots: number;
    pdfs: number;
    totalCredits: number;
  };
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'screenshot' | 'pdf' | 'api_key_created' | 'api_key_revoked';
  description: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

// ============================================
// API KEYS
// ============================================

export interface ApiKeyListItem {
  id: string;
  name: string | null;
  prefix: string;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface CreateApiKeyRequest {
  name?: string;
}

export interface CreateApiKeyResponse {
  id: string;
  key: string; // Full key - shown only ONCE
  prefix: string;
  name: string | null;
  createdAt: Date;
}

export interface RevokeApiKeyResponse {
  success: boolean;
  message: string;
}

// ============================================
// USAGE
// ============================================

export interface UsageStats {
  totalRequests: number;
  totalCredits: number;
  screenshotCount: number;
  pdfCount: number;
  averageCreditsPerDay: number;
  breakdown: UsageBreakdown[];
}

export interface UsageBreakdown {
  eventType: EventType;
  count: number;
  credits: number;
  percentage: number;
}

export interface UsageTimelineItem {
  date: string; // ISO date string (YYYY-MM-DD)
  screenshots: number;
  pdfs: number;
  credits: number;
}

export type UsagePeriod = 'day' | 'week' | 'month';

export interface UsageTimelineRequest {
  period: UsagePeriod;
  startDate?: string;
  endDate?: string;
}

// ============================================
// SETTINGS
// ============================================

export interface AccountSettings {
  id: string;
  email: string;
  tier: Tier;
  createdAt: Date;
  defaultSettings: DefaultScreenshotSettings;
}

export interface DefaultScreenshotSettings {
  format: 'png' | 'jpeg' | 'webp';
  quality: number;
  fullPage: boolean;
  viewport: {
    width: number;
    height: number;
  };
}

export interface UpdateSettingsRequest {
  defaultSettings?: Partial<DefaultScreenshotSettings>;
}

// ============================================
// WEBHOOKS
// ============================================

export interface WebhookListItem {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: Date | null;
  failCount: number;
  createdAt: Date;
}

export interface CreateWebhookRequest {
  url: string;
  events: string[];
}

export interface CreateWebhookResponse {
  id: string;
  url: string;
  events: string[];
  secret: string; // Shown only ONCE
  createdAt: Date;
}

export interface DeleteWebhookResponse {
  success: boolean;
  message: string;
}

// ============================================
// COMMON
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
