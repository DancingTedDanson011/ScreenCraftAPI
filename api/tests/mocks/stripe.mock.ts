import { vi } from 'vitest';

/**
 * Mock Stripe Customer
 */
export function createMockStripeCustomer(overrides = {}) {
  return {
    id: 'cus_test123',
    object: 'customer',
    email: 'test@example.com',
    name: 'Test Customer',
    metadata: {},
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    ...overrides,
  };
}

/**
 * Mock Stripe Subscription
 */
export function createMockStripeSubscription(overrides = {}) {
  return {
    id: 'sub_test123',
    object: 'subscription',
    customer: 'cus_test123',
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test123',
          price: {
            id: 'price_test123',
            product: 'prod_test123',
            unit_amount: 1999,
            currency: 'usd',
          },
        },
      ],
    },
    metadata: {},
    cancel_at_period_end: false,
    canceled_at: null,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    ...overrides,
  };
}

/**
 * Mock Stripe Invoice
 */
export function createMockStripeInvoice(overrides = {}) {
  return {
    id: 'in_test123',
    object: 'invoice',
    customer: 'cus_test123',
    subscription: 'sub_test123',
    status: 'paid',
    amount_due: 1999,
    amount_paid: 1999,
    currency: 'usd',
    created: Math.floor(Date.now() / 1000),
    hosted_invoice_url: 'https://invoice.stripe.com/test123',
    invoice_pdf: 'https://invoice.stripe.com/test123/pdf',
    livemode: false,
    ...overrides,
  };
}

/**
 * Mock Stripe Payment Intent
 */
export function createMockStripePaymentIntent(overrides = {}) {
  return {
    id: 'pi_test123',
    object: 'payment_intent',
    amount: 1999,
    currency: 'usd',
    status: 'succeeded',
    customer: 'cus_test123',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    ...overrides,
  };
}

/**
 * Mock Stripe Checkout Session
 */
export function createMockStripeCheckoutSession(overrides = {}) {
  return {
    id: 'cs_test123',
    object: 'checkout.session',
    customer: 'cus_test123',
    mode: 'subscription',
    payment_status: 'paid',
    status: 'complete',
    url: 'https://checkout.stripe.com/test123',
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
    subscription: 'sub_test123',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    ...overrides,
  };
}

/**
 * Mock Stripe Webhook Event
 */
export function createMockStripeWebhookEvent(type: string, data: any = {}) {
  return {
    id: 'evt_test123',
    object: 'event',
    type,
    data: {
      object: data,
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  };
}

/**
 * Create a mock Stripe client
 */
export function createMockStripeClient() {
  return {
    customers: {
      create: vi.fn().mockResolvedValue(createMockStripeCustomer()),
      retrieve: vi.fn().mockResolvedValue(createMockStripeCustomer()),
      update: vi.fn().mockResolvedValue(createMockStripeCustomer()),
      del: vi.fn().mockResolvedValue({ id: 'cus_test123', deleted: true }),
      list: vi.fn().mockResolvedValue({
        data: [createMockStripeCustomer()],
        has_more: false,
      }),
    },

    subscriptions: {
      create: vi.fn().mockResolvedValue(createMockStripeSubscription()),
      retrieve: vi.fn().mockResolvedValue(createMockStripeSubscription()),
      update: vi.fn().mockResolvedValue(createMockStripeSubscription()),
      cancel: vi.fn().mockResolvedValue({
        ...createMockStripeSubscription(),
        status: 'canceled',
      }),
      list: vi.fn().mockResolvedValue({
        data: [createMockStripeSubscription()],
        has_more: false,
      }),
    },

    invoices: {
      create: vi.fn().mockResolvedValue(createMockStripeInvoice()),
      retrieve: vi.fn().mockResolvedValue(createMockStripeInvoice()),
      pay: vi.fn().mockResolvedValue(createMockStripeInvoice()),
      list: vi.fn().mockResolvedValue({
        data: [createMockStripeInvoice()],
        has_more: false,
      }),
      upcoming: vi.fn().mockResolvedValue(createMockStripeInvoice()),
    },

    paymentIntents: {
      create: vi.fn().mockResolvedValue(createMockStripePaymentIntent()),
      retrieve: vi.fn().mockResolvedValue(createMockStripePaymentIntent()),
      update: vi.fn().mockResolvedValue(createMockStripePaymentIntent()),
      confirm: vi.fn().mockResolvedValue({
        ...createMockStripePaymentIntent(),
        status: 'succeeded',
      }),
      cancel: vi.fn().mockResolvedValue({
        ...createMockStripePaymentIntent(),
        status: 'canceled',
      }),
    },

    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue(createMockStripeCheckoutSession()),
        retrieve: vi.fn().mockResolvedValue(createMockStripeCheckoutSession()),
        list: vi.fn().mockResolvedValue({
          data: [createMockStripeCheckoutSession()],
          has_more: false,
        }),
      },
    },

    prices: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'price_test123',
        product: 'prod_test123',
        unit_amount: 1999,
        currency: 'usd',
      }),
      list: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'price_test123',
            product: 'prod_test123',
            unit_amount: 1999,
            currency: 'usd',
          },
        ],
        has_more: false,
      }),
    },

    products: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'prod_test123',
        name: 'Test Product',
        active: true,
      }),
      list: vi.fn().mockResolvedValue({
        data: [{ id: 'prod_test123', name: 'Test Product', active: true }],
        has_more: false,
      }),
    },

    webhooks: {
      constructEvent: vi.fn().mockImplementation(
        (payload: any, signature: string, secret: string) => {
          // Default implementation - can be overridden in tests
          return JSON.parse(payload);
        }
      ),
    },

    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'bps_test123',
          url: 'https://billing.stripe.com/session/test123',
        }),
      },
    },
  };
}

/**
 * Setup Stripe mock module
 */
export function setupStripeMock() {
  const mockClient = createMockStripeClient();

  vi.mock('stripe', () => ({
    default: vi.fn().mockImplementation(() => mockClient),
    Stripe: vi.fn().mockImplementation(() => mockClient),
  }));

  return mockClient;
}

/**
 * Create a valid Stripe webhook signature for testing
 * Note: This is a mock signature - not cryptographically valid
 */
export function createMockWebhookSignature(
  payload: string,
  timestamp = Math.floor(Date.now() / 1000)
): string {
  const fakeSignature = 'mock_signature_' + Buffer.from(payload).toString('base64').substring(0, 32);
  return `t=${timestamp},v1=${fakeSignature}`;
}

/**
 * Helper to create webhook request body for testing
 */
export function createWebhookPayload(eventType: string, data: any = {}) {
  const event = createMockStripeWebhookEvent(eventType, data);
  return {
    body: JSON.stringify(event),
    signature: createMockWebhookSignature(JSON.stringify(event)),
    event,
  };
}
