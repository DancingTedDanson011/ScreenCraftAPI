// Stripe Configuration
// Price IDs für Subscription Tiers

export const STRIPE_CONFIG = {
  // Stripe API Keys
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',

  // Public Configuration
  currency: 'usd',
  successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/billing/success',
  cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/billing/cancel',

  // Price IDs for each tier (replace with your actual Stripe Price IDs)
  prices: {
    FREE: null, // Free tier has no price
    PRO: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
    BUSINESS: process.env.STRIPE_PRICE_BUSINESS || 'price_business_monthly',
    ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_monthly',
  },

  // Monthly request limits per tier (1 request = 1 screenshot OR 1 PDF)
  requests: {
    FREE: 250,
    PRO: 5000,
    BUSINESS: 20000,
    ENTERPRISE: 75000,
  },

  // Pricing amounts (for display purposes)
  amounts: {
    FREE: 0,
    PRO: 1900, // $19.00 in cents
    BUSINESS: 4900, // $49.00 in cents
    ENTERPRISE: 9900, // $99.00 in cents
  },
} as const;

// Check if Stripe is configured (returns boolean instead of throwing)
export function isStripeConfigured(): boolean {
  return !!STRIPE_CONFIG.secretKey;
}

// Validate Stripe configuration (logs warning instead of throwing)
export function validateStripeConfig(): void {
  if (!STRIPE_CONFIG.secretKey) {
    console.warn('STRIPE_SECRET_KEY is not configured - payment features will be disabled');
    return;
  }

  if (!STRIPE_CONFIG.webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET is not configured - webhooks will not be verified');
  }
}

// Helper to get price ID for tier
export function getPriceIdForTier(tier: string): string | null {
  const priceId = STRIPE_CONFIG.prices[tier as keyof typeof STRIPE_CONFIG.prices];

  if (!priceId && tier !== 'FREE') {
    throw new Error(`No Stripe price ID configured for tier: ${tier}`);
  }

  return priceId;
}

// Helper to get monthly request limit for tier
export function getRequestsForTier(tier: string): number {
  return STRIPE_CONFIG.requests[tier as keyof typeof STRIPE_CONFIG.requests] || 0;
}
