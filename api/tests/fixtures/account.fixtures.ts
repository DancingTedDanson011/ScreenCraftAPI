import { faker } from '@faker-js/faker';

/**
 * Account fixtures for testing
 */
export const accountFixtures = {
  /**
   * Valid minimal account
   */
  validMinimal: () => ({
    email: faker.internet.email(),
  }),

  /**
   * Valid full account
   */
  validFull: () => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
    plan: 'pro' as const,
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Free tier account
   */
  freeTier: () => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    stripeCustomerId: null,
    plan: 'free' as const,
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Pro tier account
   */
  proTier: () => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
    plan: 'pro' as const,
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Enterprise tier account
   */
  enterpriseTier: () => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
    plan: 'enterprise' as const,
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Account with no Stripe customer
   */
  noStripe: () => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    stripeCustomerId: null,
    plan: 'free' as const,
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Invalid account - missing email
   */
  invalidMissingEmail: () => ({
    name: faker.person.fullName(),
  }),

  /**
   * Invalid account - invalid email format
   */
  invalidEmailFormat: () => ({
    email: 'not-an-email',
    name: faker.person.fullName(),
  }),

  /**
   * Generate random account
   */
  random: () => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.datatype.boolean() ? faker.person.fullName() : null,
    stripeCustomerId: faker.datatype.boolean()
      ? `cus_${faker.string.alphanumeric(14)}`
      : null,
    plan: faker.helpers.arrayElement(['free', 'pro', 'enterprise']) as
      | 'free'
      | 'pro'
      | 'enterprise',
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Batch of random accounts
   */
  batch: (count = 5) => {
    return Array.from({ length: count }, () => accountFixtures.random());
  },
};

/**
 * API key fixtures for testing
 */
export const apiKeyFixtures = {
  /**
   * Valid API key
   */
  valid: (accountId?: string) => ({
    id: faker.string.uuid(),
    key: `sk_live_${faker.string.alphanumeric(32)}`,
    name: 'Production API Key',
    accountId: accountId || faker.string.uuid(),
    isActive: true,
    lastUsedAt: faker.date.recent(),
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Test API key
   */
  test: (accountId?: string) => ({
    id: faker.string.uuid(),
    key: `sk_test_${faker.string.alphanumeric(32)}`,
    name: 'Test API Key',
    accountId: accountId || faker.string.uuid(),
    isActive: true,
    lastUsedAt: null,
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Inactive API key
   */
  inactive: (accountId?: string) => ({
    id: faker.string.uuid(),
    key: `sk_live_${faker.string.alphanumeric(32)}`,
    name: 'Deactivated Key',
    accountId: accountId || faker.string.uuid(),
    isActive: false,
    lastUsedAt: faker.date.past(),
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Revoked API key
   */
  revoked: (accountId?: string) => ({
    id: faker.string.uuid(),
    key: `sk_live_${faker.string.alphanumeric(32)}`,
    name: 'Revoked Key',
    accountId: accountId || faker.string.uuid(),
    isActive: false,
    revokedAt: faker.date.recent(),
    lastUsedAt: faker.date.past(),
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Generate random API key
   */
  random: (accountId?: string) => ({
    id: faker.string.uuid(),
    key: `sk_${faker.helpers.arrayElement(['live', 'test'])}_${faker.string.alphanumeric(32)}`,
    name: faker.commerce.productName() + ' Key',
    accountId: accountId || faker.string.uuid(),
    isActive: faker.datatype.boolean(),
    lastUsedAt: faker.datatype.boolean() ? faker.date.recent() : null,
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Batch of API keys for an account
   */
  batch: (accountId: string, count = 3) => {
    return Array.from({ length: count }, () => apiKeyFixtures.random(accountId));
  },
};

/**
 * Usage record fixtures for testing
 */
export const usageFixtures = {
  /**
   * Screenshot usage record
   */
  screenshot: (accountId?: string) => ({
    id: faker.string.uuid(),
    accountId: accountId || faker.string.uuid(),
    type: 'screenshot' as const,
    credits: 1,
    metadata: {
      url: faker.internet.url(),
      format: 'png',
      width: 1920,
      height: 1080,
    },
    createdAt: new Date(),
  }),

  /**
   * PDF usage record
   */
  pdf: (accountId?: string) => ({
    id: faker.string.uuid(),
    accountId: accountId || faker.string.uuid(),
    type: 'pdf' as const,
    credits: 2,
    metadata: {
      url: faker.internet.url(),
      pages: faker.number.int({ min: 1, max: 20 }),
    },
    createdAt: new Date(),
  }),

  /**
   * Generate daily usage summary
   */
  dailySummary: (accountId?: string, date?: Date) => {
    const targetDate = date || new Date();
    return {
      accountId: accountId || faker.string.uuid(),
      date: targetDate.toISOString().split('T')[0],
      screenshots: faker.number.int({ min: 0, max: 100 }),
      pdfs: faker.number.int({ min: 0, max: 50 }),
      totalCredits: faker.number.int({ min: 0, max: 200 }),
    };
  },

  /**
   * Generate monthly usage data
   */
  monthlySummary: (accountId?: string, month?: Date) => {
    const targetMonth = month || new Date();
    const daysInMonth = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0
    ).getDate();

    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(
        targetMonth.getFullYear(),
        targetMonth.getMonth(),
        i + 1
      );
      return usageFixtures.dailySummary(accountId, date);
    });
  },
};

/**
 * Subscription fixtures for testing
 */
export const subscriptionFixtures = {
  /**
   * Active subscription
   */
  active: (accountId?: string) => ({
    id: faker.string.uuid(),
    accountId: accountId || faker.string.uuid(),
    stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
    stripePriceId: `price_${faker.string.alphanumeric(14)}`,
    status: 'active' as const,
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Canceled subscription (still active until period end)
   */
  canceling: (accountId?: string) => ({
    id: faker.string.uuid(),
    accountId: accountId || faker.string.uuid(),
    stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
    stripePriceId: `price_${faker.string.alphanumeric(14)}`,
    status: 'active' as const,
    currentPeriodStart: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: true,
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Expired subscription
   */
  expired: (accountId?: string) => ({
    id: faker.string.uuid(),
    accountId: accountId || faker.string.uuid(),
    stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
    stripePriceId: `price_${faker.string.alphanumeric(14)}`,
    status: 'canceled' as const,
    currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: true,
    canceledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),

  /**
   * Trial subscription
   */
  trial: (accountId?: string) => ({
    id: faker.string.uuid(),
    accountId: accountId || faker.string.uuid(),
    stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
    stripePriceId: `price_${faker.string.alphanumeric(14)}`,
    status: 'trialing' as const,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  /**
   * Past due subscription
   */
  pastDue: (accountId?: string) => ({
    id: faker.string.uuid(),
    accountId: accountId || faker.string.uuid(),
    stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
    stripePriceId: `price_${faker.string.alphanumeric(14)}`,
    status: 'past_due' as const,
    currentPeriodStart: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    createdAt: faker.date.past(),
    updatedAt: new Date(),
  }),
};
