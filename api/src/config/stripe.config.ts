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

  // Credit allocations per tier
  credits: {
    FREE: 100,
    PRO: 1000,
    BUSINESS: 5000,
    ENTERPRISE: 25000,
  },

  // Pricing amounts (for display purposes)
  amounts: {
    FREE: 0,
    PRO: 2900, // $29.00 in cents
    BUSINESS: 9900, // $99.00 in cents
    ENTERPRISE: 49900, // $499.00 in cents
  },
} as const;

// Validate Stripe configuration
export function validateStripeConfig(): void {
  if (!STRIPE_CONFIG.secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
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

// Helper to get credits for tier
export function getCreditsForTier(tier: string): number {
  return STRIPE_CONFIG.credits[tier as keyof typeof STRIPE_CONFIG.credits] || 0;
}
