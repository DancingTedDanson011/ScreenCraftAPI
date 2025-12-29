// Auth System Types

import { Tier, EventType } from '@prisma/client';

export interface ApiKeyInfo {
  id: string;
  accountId: string;
  tier: Tier;
  monthlyCredits: number;
  usedCredits: number;
  isActive: boolean;
}

export interface GeneratedApiKey {
  key: string;          // Raw key - show only once
  prefix: string;       // Display prefix (e.g., "sk_test_abc12345")
  keyId: string;        // UUID
  accountId: string;
}

export interface UsageEvent {
  accountId: string;
  eventType: EventType;
  credits: number;
  metadata?: Record<string, any>;
}

export interface UsageStats {
  accountId: string;
  tier: Tier;
  monthlyCredits: number;
  usedCredits: number;
  remainingCredits: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface TierLimits {
  points: number;       // Requests per duration
  duration: number;     // Time window in seconds
  credits: number;      // Monthly credits
}

export const TIER_CONFIG: Record<Tier, TierLimits> = {
  FREE: {
    points: 100,
    duration: 3600,
    credits: 250,
  },
  PRO: {
    points: 5000,
    duration: 3600,
    credits: 5000,
  },
  BUSINESS: {
    points: 25000,
    duration: 3600,
    credits: 20000,
  },
  ENTERPRISE: {
    points: 100000,
    duration: 3600,
    credits: 75000,
  },
};

export const CREDIT_COSTS: Record<EventType, number> = {
  SCREENSHOT: 1,
  SCREENSHOT_FULLPAGE: 2,
  PDF: 2,
  PDF_WITH_TEMPLATE: 3,
};
