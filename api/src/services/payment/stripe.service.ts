// Stripe Service - Customer Management & Checkout Sessions

import Stripe from 'stripe';
import { STRIPE_CONFIG, getPriceIdForTier } from '../../config/stripe.config.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

// Lazy-initialized Stripe client (only created when needed)
let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    if (!STRIPE_CONFIG.secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured. Payment features are disabled.');
    }
    stripeClient = new Stripe(STRIPE_CONFIG.secretKey, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
  }
  return stripeClient;
}

export class StripeService {
  /**
   * Create a new Stripe customer
   * @param email - Customer email
   * @param accountId - Internal account ID for metadata
   * @returns Stripe customer ID
   */
  async createCustomer(email: string, accountId?: string): Promise<string> {
    try {
      const customer = await getStripeClient().customers.create({
        email,
        metadata: {
          accountId: accountId || '',
        },
      });

      logger.info({ customerId: customer.id, email }, 'Stripe customer created');
      return customer.id;
    } catch (error) {
      logger.error({ error, email }, 'Failed to create Stripe customer');
      throw new Error('Failed to create Stripe customer');
    }
  }

  /**
   * Get existing customer or create new one
   * @param accountId - Account ID
   * @returns Stripe customer ID
   */
  async getOrCreateCustomer(accountId: string): Promise<string> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { stripeCustomerId: true, email: true },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Return existing customer ID if available
    if (account.stripeCustomerId) {
      return account.stripeCustomerId;
    }

    // Create new customer
    const customerId = await this.createCustomer(account.email, accountId);

    // Save customer ID to database
    await prisma.account.update({
      where: { id: accountId },
      data: { stripeCustomerId: customerId },
    });

    return customerId;
  }

  /**
   * Create a checkout session for subscription
   * @param accountId - Account ID
   * @param tier - Subscription tier (PRO, BUSINESS, ENTERPRISE)
   * @returns Checkout session URL and session ID
   */
  async createCheckoutSession(
    accountId: string,
    tier: 'PRO' | 'BUSINESS' | 'ENTERPRISE'
  ): Promise<{ url: string; sessionId: string }> {
    try {
      // Get or create Stripe customer
      const customerId = await this.getOrCreateCustomer(accountId);

      // Get price ID for tier
      const priceId = getPriceIdForTier(tier);
      if (!priceId) {
        throw new Error(`No price configured for tier: ${tier}`);
      }

      // Create checkout session
      const session = await getStripeClient().checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${STRIPE_CONFIG.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: STRIPE_CONFIG.cancelUrl,
        metadata: {
          accountId,
          tier,
        },
        subscription_data: {
          metadata: {
            accountId,
            tier,
          },
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      });

      if (!session.url) {
        throw new Error('Failed to create checkout session URL');
      }

      logger.info({ accountId, tier, sessionId: session.id }, 'Checkout session created');

      return {
        url: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      logger.error({ error, accountId, tier }, 'Failed to create checkout session');
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Create a customer portal session for subscription management
   * @param customerId - Stripe customer ID
   * @returns Portal session URL
   */
  async createPortalSession(customerId: string): Promise<{ url: string }> {
    try {
      const session = await getStripeClient().billingPortal.sessions.create({
        customer: customerId,
        return_url: STRIPE_CONFIG.successUrl,
      });

      logger.info({ customerId, sessionId: session.id }, 'Portal session created');

      return {
        url: session.url,
      };
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to create portal session');
      throw new Error('Failed to create portal session');
    }
  }

  /**
   * Handle Stripe webhook events
   * @param payload - Raw webhook payload
   * @param signature - Stripe signature header
   * @returns Processed event
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<Stripe.Event> {
    try {
      // Verify webhook signature
      const event = getStripeClient().webhooks.constructEvent(
        payload,
        signature,
        STRIPE_CONFIG.webhookSecret
      );

      logger.info({ eventType: event.type, eventId: event.id }, 'Webhook received');

      // Check for duplicate events (idempotency)
      const existingEvent = await prisma.webhookEvent.findUnique({
        where: { stripeEventId: event.id },
      });

      if (existingEvent) {
        logger.info({ eventId: event.id }, 'Duplicate webhook event ignored');
        return event;
      }

      // Store webhook event for idempotency
      await prisma.webhookEvent.create({
        data: {
          stripeEventId: event.id,
          eventType: event.type,
          payload: event as unknown as Record<string, unknown>,
          processed: false,
        },
      });

      return event;
    } catch (error) {
      logger.error({ error }, 'Webhook signature verification failed');
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Mark webhook event as processed
   * @param eventId - Stripe event ID
   */
  async markWebhookProcessed(eventId: string, error?: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { stripeEventId: eventId },
      data: {
        processed: true,
        processedAt: new Date(),
        error,
      },
    });
  }

  /**
   * Retrieve subscription details from Stripe
   * @param subscriptionId - Stripe subscription ID
   * @returns Subscription object
   */
  async getStripeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await getStripeClient().subscriptions.retrieve(subscriptionId);
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to retrieve subscription');
      throw new Error('Failed to retrieve subscription');
    }
  }

  /**
   * Cancel a subscription in Stripe
   * @param subscriptionId - Stripe subscription ID
   * @param immediately - Cancel immediately or at period end
   */
  async cancelStripeSubscription(
    subscriptionId: string,
    immediately = false
  ): Promise<Stripe.Subscription> {
    try {
      if (immediately) {
        return await getStripeClient().subscriptions.cancel(subscriptionId);
      } else {
        return await getStripeClient().subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to cancel subscription');
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Get invoices/payments for a customer
   * @param customerId - Stripe customer ID
   * @param limit - Number of invoices to retrieve
   * @returns Array of invoice objects
   */
  async getInvoices(customerId: string, limit = 10): Promise<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    date: Date;
    invoiceUrl: string | null;
    invoicePdf: string | null;
    description: string | null;
  }[]> {
    try {
      const invoices = await getStripeClient().invoices.list({
        customer: customerId,
        limit,
      });

      return invoices.data.map((invoice) => ({
        id: invoice.id,
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency.toUpperCase(),
        status: invoice.status || 'unknown',
        date: new Date(invoice.created * 1000),
        invoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
        description: invoice.lines.data[0]?.description || null,
      }));
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to retrieve invoices');
      throw new Error('Failed to retrieve invoices');
    }
  }
}

export const stripeService = new StripeService();
