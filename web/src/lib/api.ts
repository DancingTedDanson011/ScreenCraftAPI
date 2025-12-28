// API Client for Dashboard

// Normalize API URL: Remove trailing /api if present to avoid /api/api/ double prefix
function normalizeApiUrl(url: string): string {
  const normalized = url.replace(/\/+$/, ''); // Remove trailing slashes
  // If URL ends with /api, remove it since our paths already include /api/v1
  if (normalized.endsWith('/api')) {
    return normalized.slice(0, -4);
  }
  return normalized;
}

const API_BASE = normalizeApiUrl(import.meta.env.PUBLIC_API_URL || 'http://localhost:3000');

// ============================================
// TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DashboardOverview {
  account: {
    id: string;
    email: string;
    tier: string;
    createdAt: string;
  };
  quota: {
    used: number;
    limit: number;
    percentage: number;
    resetDate: string;
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
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ApiKeyItem {
  id: string;
  name: string | null;
  prefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreatedApiKey {
  id: string;
  key: string;
  prefix: string;
  name: string | null;
  createdAt: string;
}

export interface UsageStats {
  totalRequests: number;
  totalCredits: number;
  screenshotCount: number;
  pdfCount: number;
  averageCreditsPerDay: number;
  breakdown: UsageBreakdown[];
}

export interface UsageBreakdown {
  eventType: string;
  count: number;
  credits: number;
  percentage: number;
}

export interface UsageTimelineItem {
  date: string;
  screenshots: number;
  pdfs: number;
  credits: number;
}

export interface AccountSettings {
  id: string;
  email: string;
  tier: string;
  createdAt: string;
  defaultSettings: {
    format: 'png' | 'jpeg' | 'webp';
    quality: number;
    fullPage: boolean;
    viewport: {
      width: number;
      height: number;
    };
  };
}

export interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  failCount: number;
  createdAt: string;
}

export interface CreatedWebhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  createdAt: string;
}

// ============================================
// API CLIENT
// ============================================

class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function fetchWithAuth<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiClientError(
        data.error || data.message || 'Request failed',
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    throw new ApiClientError(
      error instanceof Error ? error.message : 'Network error',
      0
    );
  }
}

// ============================================
// API METHODS
// ============================================

export const api = {
  dashboard: {
    /**
     * Get dashboard overview
     */
    getOverview: () =>
      fetchWithAuth<DashboardOverview>('/api/v1/dashboard/overview'),

    /**
     * Get all API keys
     */
    getApiKeys: () =>
      fetchWithAuth<ApiKeyItem[]>('/api/v1/dashboard/api-keys'),

    /**
     * Create a new API key
     */
    createApiKey: (name?: string) =>
      fetchWithAuth<CreatedApiKey>('/api/v1/dashboard/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),

    /**
     * Revoke an API key
     */
    revokeApiKey: (id: string) =>
      fetchWithAuth<{ success: boolean; message: string }>(
        `/api/v1/dashboard/api-keys/${id}`,
        { method: 'DELETE' }
      ),

    /**
     * Get usage statistics
     */
    getUsageStats: (startDate?: string, endDate?: string) => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const query = params.toString();
      return fetchWithAuth<UsageStats>(
        `/api/v1/dashboard/usage/stats${query ? `?${query}` : ''}`
      );
    },

    /**
     * Get usage timeline for charts
     */
    getUsageTimeline: (period: 'day' | 'week' | 'month' = 'month') =>
      fetchWithAuth<UsageTimelineItem[]>(
        `/api/v1/dashboard/usage/timeline?period=${period}`
      ),

    /**
     * Get account settings
     */
    getSettings: () =>
      fetchWithAuth<AccountSettings>('/api/v1/dashboard/settings'),

    /**
     * Update account settings
     */
    updateSettings: (settings: Partial<AccountSettings['defaultSettings']>) =>
      fetchWithAuth<{ success: boolean; message: string }>(
        '/api/v1/dashboard/settings',
        {
          method: 'PATCH',
          body: JSON.stringify({ defaultSettings: settings }),
        }
      ),

    /**
     * Get webhooks
     */
    getWebhooks: () =>
      fetchWithAuth<WebhookItem[]>('/api/v1/dashboard/settings/webhooks'),

    /**
     * Create a webhook
     */
    createWebhook: (url: string, events: string[]) =>
      fetchWithAuth<CreatedWebhook>('/api/v1/dashboard/settings/webhooks', {
        method: 'POST',
        body: JSON.stringify({ url, events }),
      }),

    /**
     * Delete a webhook
     */
    deleteWebhook: (id: string) =>
      fetchWithAuth<{ success: boolean; message: string }>(
        `/api/v1/dashboard/settings/webhooks/${id}`,
        { method: 'DELETE' }
      ),
  },
};

export { ApiClientError };
export default api;
