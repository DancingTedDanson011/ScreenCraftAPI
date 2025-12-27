import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Stripe from 'stripe';

// Create mock Stripe client instances
const mockCustomersCreate = vi.fn();
const mockCustomersRetrieve = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockSubscriptionsCancel = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();
const mockWebhooksConstructEvent = vi.fn();

// Mock Stripe SDK - must be a class constructor
vi.mock('stripe', () => {
  const MockStripe = function(this: any) {
    this.customers = {
      create: mockCustomersCreate,
      retrieve: mockCustomersRetrieve,
    };
    this.subscriptions = {
      retrieve: mockSubscriptionsRetrieve,
      update: mockSubscriptionsUpdate,
      cancel: mockSubscriptionsCancel,
    };
    this.checkout = {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
    };
    this.billingPortal = {
      sessions: {
        create: mockBillingPortalSessionsCreate,
      },
    };
    this.webhooks = {
      constructEvent: mockWebhooksConstructEvent,
    };
  };
  return { default: MockStripe };
});

// Mock Prisma
const mockPrismaAccount = {
  findUnique: vi.fn(),
  update: vi.fn(),
};

const mockPrismaWebhookEvent = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

vi.mock('../../../../src/lib/prisma.js', () => ({
  prisma: {
    account: mockPrismaAccount,
    webhookEvent: mockPrismaWebhookEvent,
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
  STRIPE_CONFIG: {
    secretKey: 'sk_test_fake_key',
    webhookSecret: 'whsec_test_fake_secret',
    currency: 'usd',
    successUrl: 'http://localhost:3000/billing/success',
    cancelUrl: 'http://localhost:3000/billing/cancel',
    prices: {
      FREE: null,
      PRO: 'price_pro_monthly',
      BUSINESS: 'price_business_monthly',
      ENTERPRISE: 'price_enterprise_monthly',
    },
  },
  getPriceIdForTier: vi.fn((tier: string) => {
    const prices: Record<string, string | null> = {
      FREE: null,
      PRO: 'price_pro_monthly',
      BUSINESS: 'price_business_monthly',
      ENTERPRISE: 'price_enterprise_monthly',
    };
    const priceId = prices[tier];
    if (!priceId && tier !== 'FREE') {
      throw new Error(`No Stripe price ID configured for tier: ${tier}`);
    }
    return priceId;
  }),
}));

// Import after mocking
const { StripeService } = await import('../../../../src/services/payment/stripe.service.js');

describe('StripeService', () => {
  let service: InstanceType<typeof StripeService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StripeService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // createCustomer
  // =========================================================================
  describe('createCustomer', () => {
    it('should create a new Stripe customer with email', async () => {
      const mockCustomer = {
        id: 'cus_test123',
        email: 'test@example.com',
        metadata: { accountId: '' },
      };
      mockCustomersCreate.mockResolvedValue(mockCustomer);

      const result = await service.createCustomer('test@example.com');

      expect(result).toBe('cus_test123');
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: 'test@example.com',
        metadata: { accountId: '' },
      });
    });

    it('should create a customer with accountId metadata', async () => {
      const mockCustomer = {
        id: 'cus_test456',
        email: 'test@example.com',
        metadata: { accountId: 'acc_123' },
      };
      mockCustomersCreate.mockResolvedValue(mockCustomer);

      const result = await service.createCustomer('test@example.com', 'acc_123');

      expect(result).toBe('cus_test456');
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: 'test@example.com',
        metadata: { accountId: 'acc_123' },
      });
    });

    it('should throw error when Stripe API fails', async () => {
      mockCustomersCreate.mockRejectedValue(new Error('Stripe API error'));

      await expect(service.createCustomer('test@example.com')).rejects.toThrow(
        'Failed to create Stripe customer'
      );
    });

    it('should log customer creation', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const mockCustomer = { id: 'cus_test789', email: 'log@example.com' };
      mockCustomersCreate.mockResolvedValue(mockCustomer);

      await service.createCustomer('log@example.com');

      expect(logger.info).toHaveBeenCalledWith(
        { customerId: 'cus_test789', email: 'log@example.com' },
        'Stripe customer created'
      );
    });

    it('should log error on failure', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const error = new Error('Stripe API error');
      mockCustomersCreate.mockRejectedValue(error);

      await expect(service.createCustomer('fail@example.com')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        { error, email: 'fail@example.com' },
        'Failed to create Stripe customer'
      );
    });
  });

  // =========================================================================
  // getOrCreateCustomer
  // =========================================================================
  describe('getOrCreateCustomer', () => {
    it('should return existing customer ID if available', async () => {
      mockPrismaAccount.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_existing123',
        email: 'existing@example.com',
      });

      const result = await service.getOrCreateCustomer('acc_123');

      expect(result).toBe('cus_existing123');
      expect(mockCustomersCreate).not.toHaveBeenCalled();
    });

    it('should create new customer if no existing customer ID', async () => {
      mockPrismaAccount.findUnique.mockResolvedValue({
        stripeCustomerId: null,
        email: 'new@example.com',
      });
      mockCustomersCreate.mockResolvedValue({ id: 'cus_new123' });
      mockPrismaAccount.update.mockResolvedValue({});

      const result = await service.getOrCreateCustomer('acc_123');

      expect(result).toBe('cus_new123');
      expect(mockCustomersCreate).toHaveBeenCalled();
      expect(mockPrismaAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc_123' },
        data: { stripeCustomerId: 'cus_new123' },
      });
    });

    it('should throw error if account not found', async () => {
      mockPrismaAccount.findUnique.mockResolvedValue(null);

      await expect(service.getOrCreateCustomer('nonexistent')).rejects.toThrow('Account not found');
    });

    it('should query account with correct fields', async () => {
      mockPrismaAccount.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_123',
        email: 'test@example.com',
      });

      await service.getOrCreateCustomer('acc_456');

      expect(mockPrismaAccount.findUnique).toHaveBeenCalledWith({
        where: { id: 'acc_456' },
        select: { stripeCustomerId: true, email: true },
      });
    });
  });

  // =========================================================================
  // createCheckoutSession
  // =========================================================================
  describe('createCheckoutSession', () => {
    beforeEach(() => {
      mockPrismaAccount.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_checkout123',
        email: 'checkout@example.com',
      });
    });

    it('should create checkout session for PRO tier', async () => {
      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/session123',
      };
      mockCheckoutSessionsCreate.mockResolvedValue(mockSession);

      const result = await service.createCheckoutSession('acc_123', 'PRO');

      expect(result).toEqual({
        url: 'https://checkout.stripe.com/session123',
        sessionId: 'cs_test123',
      });
    });

    it('should create checkout session for BUSINESS tier', async () => {
      const mockSession = {
        id: 'cs_business123',
        url: 'https://checkout.stripe.com/business123',
      };
      mockCheckoutSessionsCreate.mockResolvedValue(mockSession);

      const result = await service.createCheckoutSession('acc_123', 'BUSINESS');

      expect(result).toEqual({
        url: 'https://checkout.stripe.com/business123',
        sessionId: 'cs_business123',
      });
    });

    it('should create checkout session for ENTERPRISE tier', async () => {
      const mockSession = {
        id: 'cs_enterprise123',
        url: 'https://checkout.stripe.com/enterprise123',
      };
      mockCheckoutSessionsCreate.mockResolvedValue(mockSession);

      const result = await service.createCheckoutSession('acc_123', 'ENTERPRISE');

      expect(result).toEqual({
        url: 'https://checkout.stripe.com/enterprise123',
        sessionId: 'cs_enterprise123',
      });
    });

    it('should include correct session configuration', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: 'cs_config123',
        url: 'https://checkout.stripe.com/config123',
      });

      await service.createCheckoutSession('acc_789', 'PRO');

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith({
        customer: 'cus_checkout123',
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: 'price_pro_monthly',
            quantity: 1,
          },
        ],
        success_url: 'http://localhost:3000/billing/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/billing/cancel',
        metadata: {
          accountId: 'acc_789',
          tier: 'PRO',
        },
        subscription_data: {
          metadata: {
            accountId: 'acc_789',
            tier: 'PRO',
          },
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      });
    });

    it('should throw error if session URL is not created', async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: 'cs_no_url',
        url: null,
      });

      await expect(service.createCheckoutSession('acc_123', 'PRO')).rejects.toThrow(
        'Failed to create checkout session'
      );
    });

    it('should throw error for invalid tier (FREE has no price)', async () => {
      // Import the mock to override getPriceIdForTier
      const config = await import('../../../../src/config/stripe.config.js');
      vi.mocked(config.getPriceIdForTier).mockReturnValue(null);

      await expect(
        service.createCheckoutSession('acc_123', 'PRO' as any)
      ).rejects.toThrow('Failed to create checkout session');
    });

    it('should throw error when Stripe API fails', async () => {
      mockCheckoutSessionsCreate.mockRejectedValue(new Error('Stripe checkout error'));

      await expect(service.createCheckoutSession('acc_123', 'PRO')).rejects.toThrow(
        'Failed to create checkout session'
      );
    });

    it('should log checkout session creation', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      // Reset the getPriceIdForTier mock in case previous test modified it
      const config = await import('../../../../src/config/stripe.config.js');
      vi.mocked(config.getPriceIdForTier).mockImplementation((tier: string) => {
        const prices: Record<string, string | null> = {
          FREE: null,
          PRO: 'price_pro_monthly',
          BUSINESS: 'price_business_monthly',
          ENTERPRISE: 'price_enterprise_monthly',
        };
        return prices[tier] || null;
      });

      mockCheckoutSessionsCreate.mockResolvedValue({
        id: 'cs_logged123',
        url: 'https://checkout.stripe.com/logged123',
      });

      await service.createCheckoutSession('acc_logged', 'BUSINESS');

      expect(logger.info).toHaveBeenCalledWith(
        { accountId: 'acc_logged', tier: 'BUSINESS', sessionId: 'cs_logged123' },
        'Checkout session created'
      );
    });
  });

  // =========================================================================
  // createPortalSession
  // =========================================================================
  describe('createPortalSession', () => {
    it('should create billing portal session', async () => {
      mockBillingPortalSessionsCreate.mockResolvedValue({
        id: 'bps_test123',
        url: 'https://billing.stripe.com/session/test123',
      });

      const result = await service.createPortalSession('cus_portal123');

      expect(result).toEqual({
        url: 'https://billing.stripe.com/session/test123',
      });
    });

    it('should include correct return URL', async () => {
      mockBillingPortalSessionsCreate.mockResolvedValue({
        id: 'bps_return123',
        url: 'https://billing.stripe.com/return123',
      });

      await service.createPortalSession('cus_return123');

      expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
        customer: 'cus_return123',
        return_url: 'http://localhost:3000/billing/success',
      });
    });

    it('should throw error when Stripe API fails', async () => {
      mockBillingPortalSessionsCreate.mockRejectedValue(new Error('Portal creation failed'));

      await expect(service.createPortalSession('cus_fail123')).rejects.toThrow(
        'Failed to create portal session'
      );
    });

    it('should log portal session creation', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      mockBillingPortalSessionsCreate.mockResolvedValue({
        id: 'bps_logged123',
        url: 'https://billing.stripe.com/logged123',
      });

      await service.createPortalSession('cus_logged123');

      expect(logger.info).toHaveBeenCalledWith(
        { customerId: 'cus_logged123', sessionId: 'bps_logged123' },
        'Portal session created'
      );
    });

    it('should log error on portal session failure', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const error = new Error('Portal error');
      mockBillingPortalSessionsCreate.mockRejectedValue(error);

      await expect(service.createPortalSession('cus_error123')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        { error, customerId: 'cus_error123' },
        'Failed to create portal session'
      );
    });
  });

  // =========================================================================
  // handleWebhook
  // =========================================================================
  describe('handleWebhook', () => {
    const createMockEvent = (type: string, id = 'evt_test123') => ({
      id,
      type,
      object: 'event',
      data: { object: {} },
      created: Math.floor(Date.now() / 1000),
    });

    it('should verify and return webhook event', async () => {
      const mockEvent = createMockEvent('customer.subscription.created');
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockPrismaWebhookEvent.findUnique.mockResolvedValue(null);
      mockPrismaWebhookEvent.create.mockResolvedValue({});

      const payload = Buffer.from(JSON.stringify(mockEvent));
      const signature = 't=123,v1=abc123';

      const result = await service.handleWebhook(payload, signature);

      expect(result).toEqual(mockEvent);
    });

    it('should verify webhook signature', async () => {
      const mockEvent = createMockEvent('invoice.paid');
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockPrismaWebhookEvent.findUnique.mockResolvedValue(null);
      mockPrismaWebhookEvent.create.mockResolvedValue({});

      const payload = Buffer.from('{"test": "data"}');
      const signature = 't=123456,v1=signature123';

      await service.handleWebhook(payload, signature);

      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'whsec_test_fake_secret'
      );
    });

    it('should throw error for invalid webhook signature', async () => {
      mockWebhooksConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const payload = Buffer.from('{}');

      await expect(service.handleWebhook(payload, 'invalid_sig')).rejects.toThrow(
        'Invalid webhook signature'
      );
    });

    it('should check for duplicate events (idempotency)', async () => {
      const mockEvent = createMockEvent('customer.updated', 'evt_duplicate123');
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockPrismaWebhookEvent.findUnique.mockResolvedValue({ id: 'existing' });

      const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(result).toEqual(mockEvent);
      expect(mockPrismaWebhookEvent.create).not.toHaveBeenCalled();
    });

    it('should store new webhook event for idempotency', async () => {
      const mockEvent = createMockEvent('subscription.updated', 'evt_new123');
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockPrismaWebhookEvent.findUnique.mockResolvedValue(null);
      mockPrismaWebhookEvent.create.mockResolvedValue({});

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockPrismaWebhookEvent.create).toHaveBeenCalledWith({
        data: {
          stripeEventId: 'evt_new123',
          eventType: 'subscription.updated',
          payload: mockEvent as unknown as Record<string, unknown>,
          processed: false,
        },
      });
    });

    it('should log webhook receipt', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const mockEvent = createMockEvent('checkout.session.completed', 'evt_log123');
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockPrismaWebhookEvent.findUnique.mockResolvedValue(null);
      mockPrismaWebhookEvent.create.mockResolvedValue({});

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(logger.info).toHaveBeenCalledWith(
        { eventType: 'checkout.session.completed', eventId: 'evt_log123' },
        'Webhook received'
      );
    });

    it('should log duplicate event detection', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const mockEvent = createMockEvent('payment.succeeded', 'evt_dup123');
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockPrismaWebhookEvent.findUnique.mockResolvedValue({ id: 'existing' });

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(logger.info).toHaveBeenCalledWith(
        { eventId: 'evt_dup123' },
        'Duplicate webhook event ignored'
      );
    });

    it('should log signature verification failure', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const error = new Error('Signature mismatch');
      mockWebhooksConstructEvent.mockImplementation(() => {
        throw error;
      });

      await expect(service.handleWebhook(Buffer.from('{}'), 'bad_sig')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith({ error }, 'Webhook signature verification failed');
    });
  });

  // =========================================================================
  // markWebhookProcessed
  // =========================================================================
  describe('markWebhookProcessed', () => {
    it('should mark webhook as processed without error', async () => {
      mockPrismaWebhookEvent.update.mockResolvedValue({});

      await service.markWebhookProcessed('evt_success123');

      expect(mockPrismaWebhookEvent.update).toHaveBeenCalledWith({
        where: { stripeEventId: 'evt_success123' },
        data: {
          processed: true,
          processedAt: expect.any(Date),
          error: undefined,
        },
      });
    });

    it('should mark webhook as processed with error message', async () => {
      mockPrismaWebhookEvent.update.mockResolvedValue({});

      await service.markWebhookProcessed('evt_error123', 'Processing failed: invalid data');

      expect(mockPrismaWebhookEvent.update).toHaveBeenCalledWith({
        where: { stripeEventId: 'evt_error123' },
        data: {
          processed: true,
          processedAt: expect.any(Date),
          error: 'Processing failed: invalid data',
        },
      });
    });
  });

  // =========================================================================
  // getStripeSubscription
  // =========================================================================
  describe('getStripeSubscription', () => {
    it('should retrieve subscription from Stripe', async () => {
      const mockSubscription = {
        id: 'sub_retrieve123',
        status: 'active',
        customer: 'cus_123',
      };
      mockSubscriptionsRetrieve.mockResolvedValue(mockSubscription);

      const result = await service.getStripeSubscription('sub_retrieve123');

      expect(result).toEqual(mockSubscription);
      expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_retrieve123');
    });

    it('should throw error when subscription not found', async () => {
      mockSubscriptionsRetrieve.mockRejectedValue(new Error('No such subscription'));

      await expect(service.getStripeSubscription('sub_nonexistent')).rejects.toThrow(
        'Failed to retrieve subscription'
      );
    });

    it('should log error on retrieval failure', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const error = new Error('Stripe API error');
      mockSubscriptionsRetrieve.mockRejectedValue(error);

      await expect(service.getStripeSubscription('sub_fail123')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        { error, subscriptionId: 'sub_fail123' },
        'Failed to retrieve subscription'
      );
    });
  });

  // =========================================================================
  // cancelStripeSubscription
  // =========================================================================
  describe('cancelStripeSubscription', () => {
    it('should cancel subscription at period end by default', async () => {
      const mockSubscription = {
        id: 'sub_cancel123',
        status: 'active',
        cancel_at_period_end: true,
      };
      mockSubscriptionsUpdate.mockResolvedValue(mockSubscription);

      const result = await service.cancelStripeSubscription('sub_cancel123');

      expect(result).toEqual(mockSubscription);
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_cancel123', {
        cancel_at_period_end: true,
      });
      expect(mockSubscriptionsCancel).not.toHaveBeenCalled();
    });

    it('should cancel subscription immediately when requested', async () => {
      const mockSubscription = {
        id: 'sub_immediate123',
        status: 'canceled',
      };
      mockSubscriptionsCancel.mockResolvedValue(mockSubscription);

      const result = await service.cancelStripeSubscription('sub_immediate123', true);

      expect(result).toEqual(mockSubscription);
      expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_immediate123');
      expect(mockSubscriptionsUpdate).not.toHaveBeenCalled();
    });

    it('should throw error when cancellation fails', async () => {
      mockSubscriptionsUpdate.mockRejectedValue(new Error('Cannot cancel'));

      await expect(service.cancelStripeSubscription('sub_error123')).rejects.toThrow(
        'Failed to cancel subscription'
      );
    });

    it('should throw error when immediate cancellation fails', async () => {
      mockSubscriptionsCancel.mockRejectedValue(new Error('Immediate cancel failed'));

      await expect(service.cancelStripeSubscription('sub_error123', true)).rejects.toThrow(
        'Failed to cancel subscription'
      );
    });

    it('should log error on cancellation failure', async () => {
      const { logger } = await import('../../../../src/lib/logger.js');
      const error = new Error('Cancel error');
      mockSubscriptionsUpdate.mockRejectedValue(error);

      await expect(service.cancelStripeSubscription('sub_log123')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        { error, subscriptionId: 'sub_log123' },
        'Failed to cancel subscription'
      );
    });
  });

  // =========================================================================
  // Edge Cases and Error Handling
  // =========================================================================
  describe('Edge Cases and Error Handling', () => {
    it('should handle empty email for customer creation', async () => {
      mockCustomersCreate.mockResolvedValue({ id: 'cus_empty' });

      const result = await service.createCustomer('');

      expect(result).toBe('cus_empty');
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: '',
        metadata: { accountId: '' },
      });
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      networkError.name = 'NetworkError';
      mockCheckoutSessionsCreate.mockRejectedValue(networkError);
      mockPrismaAccount.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_network',
        email: 'network@test.com',
      });

      await expect(service.createCheckoutSession('acc_network', 'PRO')).rejects.toThrow(
        'Failed to create checkout session'
      );
    });

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).type = 'StripeRateLimitError';
      mockCustomersCreate.mockRejectedValue(rateLimitError);

      await expect(service.createCustomer('ratelimit@test.com')).rejects.toThrow(
        'Failed to create Stripe customer'
      );
    });
  });
});
