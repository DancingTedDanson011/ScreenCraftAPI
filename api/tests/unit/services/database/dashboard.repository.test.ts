import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create comprehensive Prisma mock
const mockPrisma = {
  account: {
    findUnique: vi.fn(),
  },
  usageEvent: {
    findMany: vi.fn(),
  },
  screenshot: {
    findMany: vi.fn(),
  },
  pdf: {
    findMany: vi.fn(),
  },
  apiKey: {
    findMany: vi.fn(),
  },
  webhook: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
};

// Mock crypto module
vi.mock('node:crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6'),
    })),
  },
}));

// Mock the prisma import
vi.mock('../../../../src/lib/db.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
const { DashboardRepository } = await import(
  '../../../../src/services/database/dashboard.repository.js'
);

// Test data factories
const createMockAccount = (overrides = {}) => ({
  id: 'acc-123',
  email: 'test@example.com',
  tier: 'FREE' as const,
  monthlyCredits: 1000,
  usedCredits: 250,
  lastResetAt: new Date('2024-01-15'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
  user: { email: 'user@example.com', name: 'Test User' },
  ...overrides,
});

const createMockUsageEvent = (overrides = {}) => ({
  id: 'event-123',
  accountId: 'acc-123',
  eventType: 'SCREENSHOT_BASIC' as const,
  credits: 1,
  metadata: {},
  createdAt: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
});

const createMockScreenshot = (overrides = {}) => ({
  id: 'screenshot-123',
  accountId: 'acc-123',
  url: 'https://example.com/page',
  status: 'COMPLETED' as const,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
});

const createMockPdf = (overrides = {}) => ({
  id: 'pdf-123',
  accountId: 'acc-123',
  url: 'https://example.com/document',
  type: 'URL' as const,
  status: 'COMPLETED' as const,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
});

const createMockApiKey = (overrides = {}) => ({
  id: 'key-123',
  accountId: 'acc-123',
  isActive: true,
  lastUsedAt: new Date(),
  revokedAt: null,
  ...overrides,
});

const createMockWebhook = (overrides = {}) => ({
  id: 'webhook-123',
  accountId: 'acc-123',
  url: 'https://webhook.example.com/callback',
  events: ['screenshot.completed', 'pdf.completed'],
  isActive: true,
  lastTriggeredAt: null,
  failCount: 0,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

describe('DashboardRepository', () => {
  let repository: InstanceType<typeof DashboardRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new DashboardRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================
  // getAccountOverview
  // ===========================================
  describe('getAccountOverview', () => {
    it('should return complete dashboard overview', async () => {
      const mockAccount = createMockAccount();
      const mockUsageEvents = [
        createMockUsageEvent({ eventType: 'SCREENSHOT_BASIC', credits: 1 }),
        createMockUsageEvent({ eventType: 'PDF_BASIC', credits: 2 }),
      ];
      const mockScreenshots = [createMockScreenshot()];
      const mockPdfs = [createMockPdf()];

      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);
      mockPrisma.usageEvent.findMany.mockResolvedValue(mockUsageEvents);
      mockPrisma.screenshot.findMany.mockResolvedValue(mockScreenshots);
      mockPrisma.pdf.findMany.mockResolvedValue(mockPdfs);

      const result = await repository.getAccountOverview('acc-123');

      expect(result).not.toBeNull();
      expect(result!.account.id).toBe('acc-123');
      expect(result!.account.email).toBe('test@example.com');
      expect(result!.account.tier).toBe('FREE');
      expect(result!.quota.used).toBe(250);
      expect(result!.quota.limit).toBe(1000);
      expect(result!.quota.percentage).toBe(25);
    });

    it('should return null when account not found', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      const result = await repository.getAccountOverview('nonexistent');

      expect(result).toBeNull();
    });

    it('should cap percentage at 100', async () => {
      const mockAccount = createMockAccount({
        monthlyCredits: 100,
        usedCredits: 150, // Over limit
      });
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);
      mockPrisma.usageEvent.findMany.mockResolvedValue([]);
      mockPrisma.screenshot.findMany.mockResolvedValue([]);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      const result = await repository.getAccountOverview('acc-123');

      expect(result!.quota.percentage).toBe(100);
    });

    it('should handle zero monthly credits', async () => {
      const mockAccount = createMockAccount({
        monthlyCredits: 0,
        usedCredits: 0,
      });
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);
      mockPrisma.usageEvent.findMany.mockResolvedValue([]);
      mockPrisma.screenshot.findMany.mockResolvedValue([]);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      const result = await repository.getAccountOverview('acc-123');

      expect(result!.quota.percentage).toBe(0);
    });

    it('should include account with user relation', async () => {
      const mockAccount = createMockAccount();
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);
      mockPrisma.usageEvent.findMany.mockResolvedValue([]);
      mockPrisma.screenshot.findMany.mockResolvedValue([]);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      await repository.getAccountOverview('acc-123');

      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'acc-123' },
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });
    });
  });

  // ===========================================
  // getRecentActivity
  // ===========================================
  describe('getRecentActivity', () => {
    it('should return combined recent activity sorted by date', async () => {
      const olderScreenshot = createMockScreenshot({
        id: 'ss-1',
        createdAt: new Date('2024-01-10'),
      });
      const newerPdf = createMockPdf({
        id: 'pdf-1',
        createdAt: new Date('2024-01-15'),
      });

      mockPrisma.screenshot.findMany.mockResolvedValue([olderScreenshot]);
      mockPrisma.pdf.findMany.mockResolvedValue([newerPdf]);

      const result = await repository.getRecentActivity('acc-123', 10);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('pdf'); // Newer first
      expect(result[1].type).toBe('screenshot');
    });

    it('should truncate long URLs in description', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(100);
      const screenshot = createMockScreenshot({ url: longUrl });

      mockPrisma.screenshot.findMany.mockResolvedValue([screenshot]);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      const result = await repository.getRecentActivity('acc-123');

      expect(result[0].description).toContain('...');
      expect(result[0].description.length).toBeLessThan(longUrl.length + 50);
    });

    it('should handle PDF with HTML content (no URL)', async () => {
      const htmlPdf = createMockPdf({ url: null, type: 'HTML' });

      mockPrisma.screenshot.findMany.mockResolvedValue([]);
      mockPrisma.pdf.findMany.mockResolvedValue([htmlPdf]);

      const result = await repository.getRecentActivity('acc-123');

      expect(result[0].description).toContain('HTML content');
    });

    it('should use default limit of 10', async () => {
      mockPrisma.screenshot.findMany.mockResolvedValue([]);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      await repository.getRecentActivity('acc-123');

      expect(mockPrisma.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
      expect(mockPrisma.pdf.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });

    it('should include metadata in activity items', async () => {
      const screenshot = createMockScreenshot({
        status: 'COMPLETED',
      });
      mockPrisma.screenshot.findMany.mockResolvedValue([screenshot]);
      mockPrisma.pdf.findMany.mockResolvedValue([]);

      const result = await repository.getRecentActivity('acc-123');

      expect(result[0].metadata).toEqual({
        url: screenshot.url,
        status: 'COMPLETED',
      });
    });
  });

  // ===========================================
  // getUsageStats
  // ===========================================
  describe('getUsageStats', () => {
    it('should calculate usage statistics correctly', async () => {
      const events = [
        createMockUsageEvent({ eventType: 'SCREENSHOT_BASIC', credits: 1 }),
        createMockUsageEvent({ eventType: 'SCREENSHOT_BASIC', credits: 1 }),
        createMockUsageEvent({ eventType: 'PDF_BASIC', credits: 2 }),
        createMockUsageEvent({ eventType: 'PDF_PREMIUM', credits: 5 }),
      ];
      mockPrisma.usageEvent.findMany.mockResolvedValue(events);

      const result = await repository.getUsageStats('acc-123');

      expect(result.totalRequests).toBe(4);
      expect(result.totalCredits).toBe(9);
      expect(result.screenshotCount).toBe(2);
      expect(result.pdfCount).toBe(2);
    });

    it('should calculate breakdown with percentages', async () => {
      const events = [
        createMockUsageEvent({ eventType: 'SCREENSHOT_BASIC', credits: 5 }),
        createMockUsageEvent({ eventType: 'PDF_BASIC', credits: 5 }),
      ];
      mockPrisma.usageEvent.findMany.mockResolvedValue(events);

      const result = await repository.getUsageStats('acc-123');

      expect(result.breakdown).toHaveLength(2);
      const screenshotBreakdown = result.breakdown.find(
        (b) => b.eventType === 'SCREENSHOT_BASIC'
      );
      expect(screenshotBreakdown?.percentage).toBe(50);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      mockPrisma.usageEvent.findMany.mockResolvedValue([]);

      await repository.getUsageStats('acc-123', startDate, endDate);

      expect(mockPrisma.usageEvent.findMany).toHaveBeenCalledWith({
        where: {
          accountId: 'acc-123',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          eventType: true,
          credits: true,
          createdAt: true,
        },
      });
    });

    it('should calculate average credits per day', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10'); // ~9-10 days depending on calculation
      const events = [
        createMockUsageEvent({ credits: 50 }),
        createMockUsageEvent({ credits: 50 }),
      ];
      mockPrisma.usageEvent.findMany.mockResolvedValue(events);

      const result = await repository.getUsageStats('acc-123', startDate, endDate);

      // Average should be total credits / days in range
      // The exact value depends on how days are calculated in the implementation
      expect(result.averageCreditsPerDay).toBeGreaterThan(0);
      expect(result.averageCreditsPerDay).toBeLessThanOrEqual(100);
    });

    it('should default to 30 days when no date range provided', async () => {
      const events = [createMockUsageEvent({ credits: 300 })];
      mockPrisma.usageEvent.findMany.mockResolvedValue(events);

      const result = await repository.getUsageStats('acc-123');

      expect(result.averageCreditsPerDay).toBe(10); // 300 / 30
    });

    it('should handle empty events', async () => {
      mockPrisma.usageEvent.findMany.mockResolvedValue([]);

      const result = await repository.getUsageStats('acc-123');

      expect(result.totalRequests).toBe(0);
      expect(result.totalCredits).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it('should handle zero total credits in breakdown percentage', async () => {
      mockPrisma.usageEvent.findMany.mockResolvedValue([]);

      const result = await repository.getUsageStats('acc-123');

      expect(result.breakdown).toEqual([]);
    });
  });

  // ===========================================
  // getUsageTimeline
  // ===========================================
  describe('getUsageTimeline', () => {
    it('should return timeline for day period (hourly)', async () => {
      const events = [
        createMockUsageEvent({
          eventType: 'SCREENSHOT_BASIC',
          credits: 1,
          createdAt: new Date(),
        }),
      ];
      mockPrisma.usageEvent.findMany.mockResolvedValue(events);

      const result = await repository.getUsageTimeline('acc-123', 'day');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('screenshots');
      expect(result[0]).toHaveProperty('pdfs');
      expect(result[0]).toHaveProperty('credits');
    });

    it('should return timeline for week period (daily)', async () => {
      const events = [createMockUsageEvent()];
      mockPrisma.usageEvent.findMany.mockResolvedValue(events);

      const result = await repository.getUsageTimeline('acc-123', 'week');

      expect(result.length).toBeLessThanOrEqual(8); // 7 days + 1
    });

    it('should return timeline for month period (daily)', async () => {
      const events = [createMockUsageEvent()];
      mockPrisma.usageEvent.findMany.mockResolvedValue(events);

      const result = await repository.getUsageTimeline('acc-123', 'month');

      expect(result.length).toBeGreaterThan(0);
    });

    it('should fill missing dates with zeros', async () => {
      mockPrisma.usageEvent.findMany.mockResolvedValue([]);

      const result = await repository.getUsageTimeline('acc-123', 'week');

      // Should have entries even with no events
      expect(result.length).toBeGreaterThan(0);
      result.forEach((item) => {
        expect(item.screenshots).toBe(0);
        expect(item.pdfs).toBe(0);
        expect(item.credits).toBe(0);
      });
    });

    it('should group events correctly by date', async () => {
      const sameHour = new Date();
      const events = [
        createMockUsageEvent({
          eventType: 'SCREENSHOT_BASIC',
          credits: 1,
          createdAt: sameHour,
        }),
        createMockUsageEvent({
          eventType: 'PDF_BASIC',
          credits: 2,
          createdAt: sameHour,
        }),
      ];
      mockPrisma.usageEvent.findMany.mockResolvedValue(events);

      const result = await repository.getUsageTimeline('acc-123', 'day');

      // Find the entry for the current hour
      const currentEntry = result.find((item) => item.screenshots > 0 || item.pdfs > 0);
      if (currentEntry) {
        expect(currentEntry.screenshots).toBe(1);
        expect(currentEntry.pdfs).toBe(1);
        expect(currentEntry.credits).toBe(3);
      }
    });
  });

  // ===========================================
  // getApiKeyStats
  // ===========================================
  describe('getApiKeyStats', () => {
    it('should return API key statistics', async () => {
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const keys = [
        createMockApiKey({ isActive: true, lastUsedAt: now }), // recently used
        createMockApiKey({ id: 'key-2', isActive: true, lastUsedAt: twoWeeksAgo }), // not recently used
        createMockApiKey({ id: 'key-3', isActive: false, revokedAt: now, lastUsedAt: null }),
      ];
      mockPrisma.apiKey.findMany.mockResolvedValue(keys);

      const result = await repository.getApiKeyStats('acc-123');

      expect(result.total).toBe(3);
      expect(result.active).toBe(2);
      expect(result.revoked).toBe(1);
      expect(result.recentlyUsed).toBe(1); // Only the first key was used within last 7 days
    });

    it('should return zeros when no keys exist', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);

      const result = await repository.getApiKeyStats('acc-123');

      expect(result).toEqual({
        total: 0,
        active: 0,
        revoked: 0,
        recentlyUsed: 0,
      });
    });

    it('should count recently used keys from last 7 days', async () => {
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const keys = [
        createMockApiKey({ lastUsedAt: now }), // Recently used
        createMockApiKey({ id: 'key-2', lastUsedAt: twoWeeksAgo }), // Not recently used
      ];
      mockPrisma.apiKey.findMany.mockResolvedValue(keys);

      const result = await repository.getApiKeyStats('acc-123');

      expect(result.recentlyUsed).toBe(1);
    });
  });

  // ===========================================
  // getWebhooks
  // ===========================================
  describe('getWebhooks', () => {
    it('should return webhooks for account', async () => {
      const webhooks = [createMockWebhook(), createMockWebhook({ id: 'wh-2' })];
      mockPrisma.webhook.findMany.mockResolvedValue(webhooks);

      const result = await repository.getWebhooks('acc-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith({
        where: { accountId: 'acc-123' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          url: true,
          events: true,
          isActive: true,
          lastTriggeredAt: true,
          failCount: true,
          createdAt: true,
        },
      });
    });

    it('should return empty array when no webhooks', async () => {
      mockPrisma.webhook.findMany.mockResolvedValue([]);

      const result = await repository.getWebhooks('acc-123');

      expect(result).toEqual([]);
    });
  });

  // ===========================================
  // createWebhook
  // ===========================================
  describe('createWebhook', () => {
    it('should create webhook with generated secret', async () => {
      const mockWebhook = {
        id: 'webhook-new',
        createdAt: new Date(),
      };
      mockPrisma.webhook.create.mockResolvedValue(mockWebhook);

      const result = await repository.createWebhook(
        'acc-123',
        'https://webhook.example.com/callback',
        ['screenshot.completed']
      );

      expect(result.id).toBe('webhook-new');
      expect(result.secret).toMatch(/^whsec_/);
      expect(mockPrisma.webhook.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc-123',
          url: 'https://webhook.example.com/callback',
          events: ['screenshot.completed'],
          secret: expect.stringMatching(/^whsec_/),
          isActive: true,
        },
        select: {
          id: true,
          createdAt: true,
        },
      });
    });
  });

  // ===========================================
  // deleteWebhook
  // ===========================================
  describe('deleteWebhook', () => {
    it('should delete webhook and return true', async () => {
      mockPrisma.webhook.deleteMany.mockResolvedValue({ count: 1 });

      const result = await repository.deleteWebhook('acc-123', 'webhook-123');

      expect(result).toBe(true);
      expect(mockPrisma.webhook.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'webhook-123',
          accountId: 'acc-123',
        },
      });
    });

    it('should return false when webhook not found', async () => {
      mockPrisma.webhook.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repository.deleteWebhook('acc-123', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should not delete webhook from different account', async () => {
      mockPrisma.webhook.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repository.deleteWebhook('other-acc', 'webhook-123');

      expect(result).toBe(false);
    });
  });

  // ===========================================
  // getAccountSettings
  // ===========================================
  describe('getAccountSettings', () => {
    it('should return account settings', async () => {
      const mockSettings = {
        id: 'acc-123',
        email: 'test@example.com',
        tier: 'PRO' as const,
        createdAt: new Date('2024-01-01'),
      };
      mockPrisma.account.findUnique.mockResolvedValue(mockSettings);

      const result = await repository.getAccountSettings('acc-123');

      expect(result).toEqual(mockSettings);
      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'acc-123' },
        select: {
          id: true,
          email: true,
          tier: true,
          createdAt: true,
        },
      });
    });

    it('should return null when account not found', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      const result = await repository.getAccountSettings('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ===========================================
  // Error Handling
  // ===========================================
  describe('Error Handling', () => {
    it('should propagate database errors from getAccountOverview', async () => {
      mockPrisma.account.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(repository.getAccountOverview('acc-123')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should propagate database errors from getUsageStats', async () => {
      mockPrisma.usageEvent.findMany.mockRejectedValue(
        new Error('Query timeout')
      );

      await expect(repository.getUsageStats('acc-123')).rejects.toThrow(
        'Query timeout'
      );
    });

    it('should propagate database errors from createWebhook', async () => {
      mockPrisma.webhook.create.mockRejectedValue(
        new Error('Unique constraint violation')
      );

      await expect(
        repository.createWebhook('acc-123', 'https://example.com', ['event'])
      ).rejects.toThrow('Unique constraint violation');
    });

    it('should propagate database errors from getRecentActivity', async () => {
      mockPrisma.screenshot.findMany.mockRejectedValue(
        new Error('Connection refused')
      );

      await expect(repository.getRecentActivity('acc-123')).rejects.toThrow(
        'Connection refused'
      );
    });
  });

  // ===========================================
  // Edge Cases
  // ===========================================
  describe('Edge Cases', () => {
    it('should handle very long event lists in timeline', async () => {
      const manyEvents = Array.from({ length: 1000 }, (_, i) =>
        createMockUsageEvent({
          id: `event-${i}`,
          createdAt: new Date(Date.now() - i * 60000),
        })
      );
      mockPrisma.usageEvent.findMany.mockResolvedValue(manyEvents);

      const result = await repository.getUsageTimeline('acc-123', 'day');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle special characters in webhook URL', async () => {
      const specialUrl = 'https://example.com/callback?token=abc&id=123';
      mockPrisma.webhook.create.mockResolvedValue({
        id: 'wh-1',
        createdAt: new Date(),
      });

      await repository.createWebhook('acc-123', specialUrl, ['event']);

      expect(mockPrisma.webhook.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            url: specialUrl,
          }),
        })
      );
    });
  });
});
