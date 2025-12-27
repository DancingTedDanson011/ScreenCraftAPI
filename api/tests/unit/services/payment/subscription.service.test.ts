import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Stripe from 'stripe';

// Mock stripeService
const mockStripeService = {
  getStripeSubscription: vi.fn(),
  cancelStripeSubscription: vi.fn(),
};

vi.mock('../../../../src/services/payment/stripe.service.js', () => ({
  stripeService: mockStripeService,
}));

// Mock Prisma
const mockPrismaSubscription = {
  findFirst: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
};

const mockPrismaAccount = {
  update: vi.fn(),
};

vi.mock('../../../../src/lib/prisma.js', () => ({
  prisma: {
    subscription: mockPrismaSubscription,
    account: mockPrismaAccount,
  },
}));

// Mock logger
vi.mock('../../../../src/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock stripe config
vi.mock('../../../../src/config/stripe.config.js', () => ({
  getCreditsForTier: vi.fn((tier: string) => {
    const credits: Record<string, number> = {
      FREE: 100,
      PRO: 1000,
      BUSINESS: 5000,
      ENTERPRISE: 25000,
    };
    return credits[tier] || 0;
  }),
}));

// Import after mocking
const { SubscriptionService } = await import(
  '../../../../src/services/payment/subscription.service.js'
);

// Helper to create mock Stripe subscription
function createMockStripeSubscription(
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 'sub_test123',
    object: 'subscription',
    customer: 'cus_test123',
    status: 'active',
    current_period_start: now,
    current_period_end: now + 30 * 24 * 60 * 60,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test123',
          object: 'subscription_item',
          price: {
            id: 'price_pro_monthly',
            object: 'price',
            product: 'prod_test123',
            unit_amount: 2900,
            currency: 'usd',
          } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '/v1/subscription_items',
    },
    metadata: {
      accountId: 'acc_test123',
      tier: 'PRO',
    },
    cancel_at_period_end: false,
    canceled_at: null,
    created: now,
    livemode: false,
    ...overrides,
  } as Stripe.Subscription;
}

// Helper to create mock internal subscription
function createMockSubscription(overrides: any = {}) {
  return {
    id: 'sub_internal_123',
    accountId: 'acc_test123',
    stripeSubscriptionId: 'sub_test123',
    stripePriceId: 'price_pro_monthly',
    status: 'ACTIVE',
    tier: 'PRO',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SubscriptionService', () => {
  let service: InstanceType<typeof SubscriptionService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SubscriptionService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // getSubscription
  // =========================================================================
  describe('getSubscription', () => {
    it('should return active subscription for account', async () => {
      const mockSub = createMockSubscription({ status: 'ACTIVE' });
      mockPrismaSubscription.findFirst.mockResolvedValue(mockSub);

      const result = await service.getSubscription('acc_test123');

      expect(result).toEqual(mockSub);
    });

    it('should return trialing subscription', async () => {
      const mockSub = createMockSubscription({ status: 'TRIALING' });
      mockPrismaSubscription.findFirst.mockResolvedValue(mockSub);

      const result = await service.getSubscription('acc_trial123');

      expect(result).toEqual(mockSub);
    });

    it('should return past_due subscription', async () => {
      const mockSub = createMockSubscription({ status: 'PAST_DUE' });
      mockPrismaSubscription.findFirst.mockResolvedValue(mockSub);

      const result = await service.getSubscription('acc_pastdue123');

      expect(result).toEqual(mockSub);
    });

    it('should return null if no subscription found', async () => {
      mockPrismaSubscription.findFirst.mockResolvedValue(null);

      const result = await service.getSubscription('acc_nosub123');

      expect(result).toBeNull();
    });

    it('should query with correct status filter', async () => {
      mockPrismaSubscription.findFirst.mockResolvedValue(null);

      await service.getSubscription('acc_filter123');

      expect(mockPrismaSubscription.findFirst).toHaveBeenCalledWith({
        where: {
          accountId: 'acc_filter123',
          status: {
            in: ['ACTIVE', 'TRIALING', 'PAST_DUE'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return most recent subscription when multiple exist', async () => {
      const recentSub = createMockSubscription({
        id: 'sub_recent',
        createdAt: new Date(),
      });
      mockPrismaSubscription.findFirst.mockResolvedValue(recentSub);

      const result = await service.getSubscription('acc_multi123');

      expect(result?.id).toBe('sub_recent');
    });
  });

  // =========================================================================
  // syncSubscription
  // =========================================================================
  describe('syncSubscription', () => {
    it('should create new subscription from Stripe data', async () => {
      const stripeSub = createMockStripeSubscription();
      mockPrismaSubscription.upsert.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.syncSubscription(stripeSub);

      expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith({
        where: {
          stripeSubscriptionId: 'sub_test123',
        },
        create: expect.objectContaining({
          accountId: 'acc_test123',
          stripeSubscriptionId: 'sub_test123',
          stripePriceId: 'price_pro_monthly',
          status: 'ACTIVE',
          tier: 'PRO',
        }),
        update: expect.objectContaining({
          status: 'ACTIVE',
          tier: 'PRO',
        }),
      });
    });

    it('should update account tier for active subscription', async () => {
      const stripeSub = createMockStripeSubscription({ status: 'active' });
      mockPrismaSubscription.upsert.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.syncSubscription(stripeSub);

      expect(mockPrismaAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc_test123' },
        data: {
          tier: 'PRO',
          monthlyCredits: 1000,
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });

    it('should update account tier for trialing subscription', async () => {
      const stripeSub = createMockStripeSubscription({ status: 'trialing' });
      mockPrismaSubscription.upsert.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.syncSubscription(stripeSub);

      expect(mockPrismaAccount.update).toHaveBeenCalled();
    });

    it('should not update account tier for canceled subscription', async () => {
      const stripeSub = createMockStripeSubscription({ status: 'canceled' });
      mockPrismaSubscription.upsert.mockResolvedValue({});

      await service.syncSubscription(stripeSub);

      expect(mockPrismaAccount.update).not.toHaveBeenCalled();
    });

    it('should not update account tier for past_due subscription', async () => {
      const stripeSub = createMockStripeSubscription({ status: 'past_due' });
      mockPrismaSubscription.upsert.mockResolvedValue({});

      await service.syncSubscription(stripeSub);

      expect(mockPrismaAccount.update).not.toHaveBeenCalled();
    });

    it('should throw error if accountId missing from metadata', async () => {
      const stripeSub = createMockStripeSubscription();
      stripeSub.metadata = { tier: 'PRO' };

      await expect(service.syncSubscription(stripeSub)).rejects.toThrow(
        'Missing accountId or tier in subscription metadata'
      );
    });

    it('should throw error if tier missing from metadata', async () => {
      const stripeSub = createMockStripeSubscription();
      stripeSub.metadata = { accountId: 'acc_123' };

      await expect(service.syncSubscription(stripeSub)).rejects.toThrow(
        'Missing accountId or tier in subscription metadata'
      );
    });

    it('should handle canceled_at timestamp', async () => {
      const canceledAt = Math.floor(Date.now() / 1000);
      const stripeSub = createMockStripeSubscription({
        status: 'canceled',
        canceled_at: canceledAt,
      });
      mockPrismaSubscription.upsert.mockResolvedValue({});

      await service.syncSubscription(stripeSub);

      expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            canceledAt: new Date(canceledAt * 1000),
          }),
          update: expect.objectContaining({
            canceledAt: new Date(canceledAt * 1000),
          }),
        })
      );
    });

    it('should log successful sync', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const stripeSub = createMockStripeSubscription();
      mockPrismaSubscription.upsert.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.syncSubscription(stripeSub);

      expect(logger.info).toHaveBeenCalledWith(
        {
          accountId: 'acc_test123',
          tier: 'PRO',
          status: 'ACTIVE',
          subscriptionId: 'sub_test123',
        },
        'Subscription synced'
      );
    });

    it('should log and rethrow error on sync failure', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const stripeSub = createMockStripeSubscription();
      const error = new Error('Database error');
      mockPrismaSubscription.upsert.mockRejectedValue(error);

      await expect(service.syncSubscription(stripeSub)).rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        { error, subscriptionId: 'sub_test123' },
        'Failed to sync subscription'
      );
    });
  });

  // =========================================================================
  // updateAccountTier
  // =========================================================================
  describe('updateAccountTier', () => {
    it('should update account to PRO tier with correct credits', async () => {
      mockPrismaAccount.update.mockResolvedValue({});

      await service.updateAccountTier('acc_tier123', 'PRO');

      expect(mockPrismaAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc_tier123' },
        data: {
          tier: 'PRO',
          monthlyCredits: 1000,
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });

    it('should update account to BUSINESS tier', async () => {
      mockPrismaAccount.update.mockResolvedValue({});

      await service.updateAccountTier('acc_business', 'BUSINESS');

      expect(mockPrismaAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc_business' },
        data: {
          tier: 'BUSINESS',
          monthlyCredits: 5000,
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });

    it('should update account to ENTERPRISE tier', async () => {
      mockPrismaAccount.update.mockResolvedValue({});

      await service.updateAccountTier('acc_enterprise', 'ENTERPRISE');

      expect(mockPrismaAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc_enterprise' },
        data: {
          tier: 'ENTERPRISE',
          monthlyCredits: 25000,
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });

    it('should update account to FREE tier', async () => {
      mockPrismaAccount.update.mockResolvedValue({});

      await service.updateAccountTier('acc_free', 'FREE');

      expect(mockPrismaAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc_free' },
        data: {
          tier: 'FREE',
          monthlyCredits: 100,
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });

    it('should log tier update', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      mockPrismaAccount.update.mockResolvedValue({});

      await service.updateAccountTier('acc_log', 'PRO');

      expect(logger.info).toHaveBeenCalledWith(
        { accountId: 'acc_log', tier: 'PRO', monthlyCredits: 1000 },
        'Account tier updated'
      );
    });
  });

  // =========================================================================
  // cancelSubscription
  // =========================================================================
  describe('cancelSubscription', () => {
    it('should cancel subscription at period end by default', async () => {
      const mockSub = createMockSubscription();
      mockPrismaSubscription.findFirst.mockResolvedValue(mockSub);
      mockStripeService.cancelStripeSubscription.mockResolvedValue({});
      mockPrismaSubscription.update.mockResolvedValue({});

      await service.cancelSubscription('acc_cancel123');

      expect(mockStripeService.cancelStripeSubscription).toHaveBeenCalledWith(
        'sub_test123',
        false
      );
      expect(mockPrismaSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_internal_123' },
        data: {
          cancelAtPeriodEnd: true,
          canceledAt: null,
          status: 'ACTIVE',
        },
      });
    });

    it('should cancel subscription immediately when requested', async () => {
      const mockSub = createMockSubscription();
      mockPrismaSubscription.findFirst.mockResolvedValue(mockSub);
      mockStripeService.cancelStripeSubscription.mockResolvedValue({});
      mockPrismaSubscription.update.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.cancelSubscription('acc_immediate123', true);

      expect(mockStripeService.cancelStripeSubscription).toHaveBeenCalledWith(
        'sub_test123',
        true
      );
      expect(mockPrismaSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_internal_123' },
        data: {
          cancelAtPeriodEnd: false,
          canceledAt: expect.any(Date),
          status: 'CANCELED',
        },
      });
    });

    it('should downgrade to FREE tier on immediate cancellation', async () => {
      const mockSub = createMockSubscription();
      mockPrismaSubscription.findFirst.mockResolvedValue(mockSub);
      mockStripeService.cancelStripeSubscription.mockResolvedValue({});
      mockPrismaSubscription.update.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.cancelSubscription('acc_downgrade123', true);

      expect(mockPrismaAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc_downgrade123' },
        data: {
          tier: 'FREE',
          monthlyCredits: 100,
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });

    it('should not downgrade on cancel at period end', async () => {
      const mockSub = createMockSubscription();
      mockPrismaSubscription.findFirst.mockResolvedValue(mockSub);
      mockStripeService.cancelStripeSubscription.mockResolvedValue({});
      mockPrismaSubscription.update.mockResolvedValue({});

      await service.cancelSubscription('acc_nodowngrade123', false);

      // Account update should not be called for tier downgrade
      expect(mockPrismaAccount.update).not.toHaveBeenCalled();
    });

    it('should throw error if no active subscription found', async () => {
      mockPrismaSubscription.findFirst.mockResolvedValue(null);

      await expect(service.cancelSubscription('acc_nosub123')).rejects.toThrow(
        'Failed to cancel subscription'
      );
    });

    it('should throw error if Stripe cancellation fails', async () => {
      const mockSub = createMockSubscription();
      mockPrismaSubscription.findFirst.mockResolvedValue(mockSub);
      mockStripeService.cancelStripeSubscription.mockRejectedValue(
        new Error('Stripe API error')
      );

      await expect(service.cancelSubscription('acc_stripefail123')).rejects.toThrow(
        'Failed to cancel subscription'
      );
    });

    it('should log cancellation', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const mockSub = createMockSubscription();
      mockPrismaSubscription.findFirst.mockResolvedValue(mockSub);
      mockStripeService.cancelStripeSubscription.mockResolvedValue({});
      mockPrismaSubscription.update.mockResolvedValue({});

      await service.cancelSubscription('acc_log123');

      expect(logger.info).toHaveBeenCalledWith(
        { accountId: 'acc_log123', subscriptionId: 'sub_internal_123', immediately: false },
        'Subscription canceled'
      );
    });

    it('should log error on failure', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      mockPrismaSubscription.findFirst.mockResolvedValue(null);

      await expect(service.cancelSubscription('acc_error123')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleSubscriptionDeleted
  // =========================================================================
  describe('handleSubscriptionDeleted', () => {
    it('should update subscription status to CANCELED', async () => {
      const stripeSub = createMockStripeSubscription();
      mockPrismaSubscription.update.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.handleSubscriptionDeleted(stripeSub);

      expect(mockPrismaSubscription.update).toHaveBeenCalledWith({
        where: {
          stripeSubscriptionId: 'sub_test123',
        },
        data: {
          status: 'CANCELED',
          canceledAt: expect.any(Date),
        },
      });
    });

    it('should downgrade account to FREE tier', async () => {
      const stripeSub = createMockStripeSubscription();
      mockPrismaSubscription.update.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.handleSubscriptionDeleted(stripeSub);

      expect(mockPrismaAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc_test123' },
        data: {
          tier: 'FREE',
          monthlyCredits: 100,
          usedCredits: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });

    it('should throw error if accountId missing', async () => {
      const stripeSub = createMockStripeSubscription();
      stripeSub.metadata = {};

      await expect(service.handleSubscriptionDeleted(stripeSub)).rejects.toThrow(
        'Missing accountId in subscription metadata'
      );
    });

    it('should log deletion', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const stripeSub = createMockStripeSubscription();
      mockPrismaSubscription.update.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.handleSubscriptionDeleted(stripeSub);

      expect(logger.info).toHaveBeenCalledWith(
        { accountId: 'acc_test123', subscriptionId: 'sub_test123' },
        'Subscription deleted'
      );
    });

    it('should log and rethrow error on failure', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const stripeSub = createMockStripeSubscription();
      const error = new Error('Database error');
      mockPrismaSubscription.update.mockRejectedValue(error);

      await expect(service.handleSubscriptionDeleted(stripeSub)).rejects.toThrow(
        'Database error'
      );

      expect(logger.error).toHaveBeenCalledWith(
        { error, subscriptionId: 'sub_test123' },
        'Failed to handle subscription deletion'
      );
    });
  });

  // =========================================================================
  // handleSubscriptionUpdated
  // =========================================================================
  describe('handleSubscriptionUpdated', () => {
    it('should call syncSubscription', async () => {
      const stripeSub = createMockStripeSubscription();
      mockPrismaSubscription.upsert.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.handleSubscriptionUpdated(stripeSub);

      expect(mockPrismaSubscription.upsert).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleInvoicePaymentSucceeded
  // =========================================================================
  describe('handleInvoicePaymentSucceeded', () => {
    it('should sync subscription after successful payment', async () => {
      const invoice = {
        id: 'in_success123',
        subscription: 'sub_invoice123',
      } as Stripe.Invoice;

      const stripeSub = createMockStripeSubscription({ id: 'sub_invoice123' });
      mockStripeService.getStripeSubscription.mockResolvedValue(stripeSub);
      mockPrismaSubscription.upsert.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.handleInvoicePaymentSucceeded(invoice);

      expect(mockStripeService.getStripeSubscription).toHaveBeenCalledWith('sub_invoice123');
      expect(mockPrismaSubscription.upsert).toHaveBeenCalled();
    });

    it('should do nothing if invoice has no subscription', async () => {
      const invoice = {
        id: 'in_nosub123',
        subscription: null,
      } as Stripe.Invoice;

      await service.handleInvoicePaymentSucceeded(invoice);

      expect(mockStripeService.getStripeSubscription).not.toHaveBeenCalled();
    });

    it('should log successful payment', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const invoice = {
        id: 'in_log123',
        subscription: 'sub_log123',
      } as Stripe.Invoice;

      const stripeSub = createMockStripeSubscription({ id: 'sub_log123' });
      mockStripeService.getStripeSubscription.mockResolvedValue(stripeSub);
      mockPrismaSubscription.upsert.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.handleInvoicePaymentSucceeded(invoice);

      expect(logger.info).toHaveBeenCalledWith(
        { subscriptionId: 'sub_log123', invoiceId: 'in_log123' },
        'Payment succeeded - subscription updated'
      );
    });

    it('should log and rethrow error on failure', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const invoice = {
        id: 'in_error123',
        subscription: 'sub_error123',
      } as Stripe.Invoice;

      const error = new Error('Stripe API error');
      mockStripeService.getStripeSubscription.mockRejectedValue(error);

      await expect(service.handleInvoicePaymentSucceeded(invoice)).rejects.toThrow(
        'Stripe API error'
      );

      expect(logger.error).toHaveBeenCalledWith(
        { error, invoiceId: 'in_error123' },
        'Failed to handle invoice payment'
      );
    });
  });

  // =========================================================================
  // handleInvoicePaymentFailed
  // =========================================================================
  describe('handleInvoicePaymentFailed', () => {
    it('should mark subscription as PAST_DUE', async () => {
      const invoice = {
        id: 'in_failed123',
        subscription: 'sub_failed123',
      } as Stripe.Invoice;

      const stripeSub = createMockStripeSubscription({ id: 'sub_failed123' });
      mockStripeService.getStripeSubscription.mockResolvedValue(stripeSub);
      mockPrismaSubscription.update.mockResolvedValue({});

      await service.handleInvoicePaymentFailed(invoice);

      expect(mockPrismaSubscription.update).toHaveBeenCalledWith({
        where: {
          stripeSubscriptionId: 'sub_failed123',
        },
        data: {
          status: 'PAST_DUE',
        },
      });
    });

    it('should do nothing if invoice has no subscription', async () => {
      const invoice = {
        id: 'in_nosub_fail123',
        subscription: null,
      } as Stripe.Invoice;

      await service.handleInvoicePaymentFailed(invoice);

      expect(mockStripeService.getStripeSubscription).not.toHaveBeenCalled();
      expect(mockPrismaSubscription.update).not.toHaveBeenCalled();
    });

    it('should log payment failure warning', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const invoice = {
        id: 'in_warn123',
        subscription: 'sub_warn123',
      } as Stripe.Invoice;

      const stripeSub = createMockStripeSubscription({ id: 'sub_warn123' });
      mockStripeService.getStripeSubscription.mockResolvedValue(stripeSub);
      mockPrismaSubscription.update.mockResolvedValue({});

      await service.handleInvoicePaymentFailed(invoice);

      expect(logger.warn).toHaveBeenCalledWith(
        { subscriptionId: 'sub_warn123', invoiceId: 'in_warn123' },
        'Payment failed - subscription marked as past due'
      );
    });

    it('should log and rethrow error on failure', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const invoice = {
        id: 'in_error_fail123',
        subscription: 'sub_error_fail123',
      } as Stripe.Invoice;

      const error = new Error('Database error');
      mockStripeService.getStripeSubscription.mockResolvedValue(
        createMockStripeSubscription({ id: 'sub_error_fail123' })
      );
      mockPrismaSubscription.update.mockRejectedValue(error);

      await expect(service.handleInvoicePaymentFailed(invoice)).rejects.toThrow(
        'Database error'
      );

      expect(logger.error).toHaveBeenCalledWith(
        { error, invoiceId: 'in_error_fail123' },
        'Failed to handle payment failure'
      );
    });
  });

  // =========================================================================
  // mapStripeStatus (private method tested through syncSubscription)
  // =========================================================================
  describe('mapStripeStatus (via syncSubscription)', () => {
    const testStatusMapping = async (
      stripeStatus: Stripe.Subscription.Status,
      expectedStatus: string
    ) => {
      const stripeSub = createMockStripeSubscription({ status: stripeStatus });
      mockPrismaSubscription.upsert.mockResolvedValue({});
      if (expectedStatus === 'ACTIVE' || expectedStatus === 'TRIALING') {
        mockPrismaAccount.update.mockResolvedValue({});
      }

      await service.syncSubscription(stripeSub);

      expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: expectedStatus }),
          update: expect.objectContaining({ status: expectedStatus }),
        })
      );
    };

    it('should map "active" to "ACTIVE"', async () => {
      await testStatusMapping('active', 'ACTIVE');
    });

    it('should map "past_due" to "PAST_DUE"', async () => {
      await testStatusMapping('past_due', 'PAST_DUE');
    });

    it('should map "canceled" to "CANCELED"', async () => {
      await testStatusMapping('canceled', 'CANCELED');
    });

    it('should map "incomplete" to "INCOMPLETE"', async () => {
      await testStatusMapping('incomplete', 'INCOMPLETE');
    });

    it('should map "incomplete_expired" to "INCOMPLETE_EXPIRED"', async () => {
      await testStatusMapping('incomplete_expired', 'INCOMPLETE_EXPIRED');
    });

    it('should map "trialing" to "TRIALING"', async () => {
      await testStatusMapping('trialing', 'TRIALING');
    });

    it('should map "unpaid" to "UNPAID"', async () => {
      await testStatusMapping('unpaid', 'UNPAID');
    });

    it('should map "paused" to "UNPAID"', async () => {
      await testStatusMapping('paused', 'UNPAID');
    });
  });

  // =========================================================================
  // getSubscriptionWithSync
  // =========================================================================
  describe('getSubscriptionWithSync', () => {
    it('should return null if no subscription exists', async () => {
      mockPrismaSubscription.findFirst.mockResolvedValue(null);

      const result = await service.getSubscriptionWithSync('acc_nosync123');

      expect(result).toBeNull();
      expect(mockStripeService.getStripeSubscription).not.toHaveBeenCalled();
    });

    it('should sync with Stripe and return updated subscription', async () => {
      const initialSub = createMockSubscription();
      const updatedSub = createMockSubscription({ status: 'ACTIVE', tier: 'BUSINESS' });
      const stripeSub = createMockStripeSubscription({
        metadata: { accountId: 'acc_sync123', tier: 'BUSINESS' },
      });

      mockPrismaSubscription.findFirst
        .mockResolvedValueOnce(initialSub)
        .mockResolvedValueOnce(updatedSub);
      mockStripeService.getStripeSubscription.mockResolvedValue(stripeSub);
      mockPrismaSubscription.upsert.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      const result = await service.getSubscriptionWithSync('acc_sync123');

      expect(result).toEqual(updatedSub);
      expect(mockStripeService.getStripeSubscription).toHaveBeenCalledWith('sub_test123');
    });

    it('should return cached subscription on Stripe sync error', async () => {
      const cachedSub = createMockSubscription();
      mockPrismaSubscription.findFirst.mockResolvedValue(cachedSub);
      mockStripeService.getStripeSubscription.mockRejectedValue(
        new Error('Stripe unavailable')
      );

      const result = await service.getSubscriptionWithSync('acc_fallback123');

      expect(result).toEqual(cachedSub);
    });

    it('should log error on sync failure', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const cachedSub = createMockSubscription();
      mockPrismaSubscription.findFirst.mockResolvedValue(cachedSub);
      const error = new Error('Stripe API error');
      mockStripeService.getStripeSubscription.mockRejectedValue(error);

      await service.getSubscriptionWithSync('acc_logerror123');

      expect(logger.error).toHaveBeenCalledWith(
        { error, accountId: 'acc_logerror123' },
        'Failed to sync subscription with Stripe'
      );
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================
  describe('Edge Cases', () => {
    it('should handle subscription with cancel_at_period_end true', async () => {
      const stripeSub = createMockStripeSubscription({
        cancel_at_period_end: true,
      });
      mockPrismaSubscription.upsert.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      await service.syncSubscription(stripeSub);

      expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ cancelAtPeriodEnd: true }),
          update: expect.objectContaining({ cancelAtPeriodEnd: true }),
        })
      );
    });

    it('should handle empty subscription items gracefully', async () => {
      const stripeSub = createMockStripeSubscription();
      stripeSub.items.data = [];
      mockPrismaSubscription.upsert.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      // This should throw or handle gracefully
      await expect(service.syncSubscription(stripeSub)).rejects.toThrow();
    });

    it('should handle concurrent sync calls', async () => {
      const stripeSub = createMockStripeSubscription();
      mockPrismaSubscription.upsert.mockResolvedValue({});
      mockPrismaAccount.update.mockResolvedValue({});

      // Simulate concurrent calls
      const results = await Promise.all([
        service.syncSubscription(stripeSub),
        service.syncSubscription(stripeSub),
        service.syncSubscription(stripeSub),
      ]);

      // All should complete successfully
      expect(mockPrismaSubscription.upsert).toHaveBeenCalledTimes(3);
    });
  });
});
