// Payment Controller - HTTP Request Handlers

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { stripeService } from '../services/payment/stripe.service.js';
import { subscriptionService } from '../services/payment/subscription.service.js';
import { logger } from '../lib/logger.js';
import Stripe from 'stripe';

// Validation schemas
const createCheckoutSchema = z.object({
  tier: z.enum(['PRO', 'BUSINESS', 'ENTERPRISE']),
});

const cancelSubscriptionSchema = z.object({
  immediately: z.boolean().optional().default(false),
});

export class PaymentController {
  /**
   * Create checkout session
   * POST /v1/payment/checkout
   */
  async createCheckout(
    request: FastifyRequest<{
      Body: z.infer<typeof createCheckoutSchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Validate request body
      const { tier } = createCheckoutSchema.parse(request.body);

      // H-02: Get account ID from auth middleware using correct property
      const accountId = request.auth?.accountId;

      if (!accountId) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      // Check for existing active subscription
      const existingSubscription = await subscriptionService.getSubscription(accountId);

      if (existingSubscription) {
        return reply.code(400).send({
          success: false,
          error: 'Account already has an active subscription. Please cancel it first.',
        });
      }

      // Create checkout session
      const { url, sessionId } = await stripeService.createCheckoutSession(accountId, tier);

      logger.info({ accountId, tier, sessionId }, 'Checkout session created');

      return reply.send({
        success: true,
        data: {
          url,
          sessionId,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create checkout session');

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Failed to create checkout session',
      });
    }
  }

  /**
   * Create customer portal session
   * GET /v1/payment/portal
   */
  async createPortal(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // H-02: Get account ID from auth middleware using correct property
      const accountId = request.auth?.accountId;

      if (!accountId) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      // Get or create Stripe customer
      const customerId = await stripeService.getOrCreateCustomer(accountId);

      // Create portal session
      const { url } = await stripeService.createPortalSession(customerId);

      logger.info({ accountId, customerId }, 'Portal session created');

      return reply.send({
        success: true,
        data: {
          url,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create portal session');

      return reply.code(500).send({
        success: false,
        error: 'Failed to create portal session',
      });
    }
  }

  /**
   * Handle Stripe webhooks
   * POST /v1/payment/webhooks/stripe
   */
  async handleWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Get signature from headers
      const signature = request.headers['stripe-signature'];

      if (!signature || typeof signature !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Missing Stripe signature',
        });
      }

      // Get raw body
      const payload = request.rawBody;

      if (!payload) {
        return reply.code(400).send({
          success: false,
          error: 'Missing request body',
        });
      }

      // Verify and process webhook
      const event = await stripeService.handleWebhook(payload, signature);

      // Process event based on type
      try {
        await this.processWebhookEvent(event);

        // Mark as processed
        await stripeService.markWebhookProcessed(event.id);
      } catch (error) {
        // Mark as failed
        await stripeService.markWebhookProcessed(
          event.id,
          error instanceof Error ? error.message : 'Unknown error'
        );
        throw error;
      }

      return reply.send({
        success: true,
        received: true,
      });
    } catch (error) {
      logger.error({ error }, 'Webhook processing failed');

      return reply.code(400).send({
        success: false,
        error: 'Webhook processing failed',
      });
    }
  }

  /**
   * Get current subscription
   * GET /v1/payment/subscription
   */
  async getSubscription(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // H-02: Get account ID from auth middleware using correct property
      const accountId = request.auth?.accountId;

      if (!accountId) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const subscription = await subscriptionService.getSubscriptionWithSync(accountId);

      return reply.send({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get subscription');

      return reply.code(500).send({
        success: false,
        error: 'Failed to get subscription',
      });
    }
  }

  /**
   * Cancel subscription
   * POST /v1/payment/subscription/cancel
   */
  async cancelSubscription(
    request: FastifyRequest<{
      Body: z.infer<typeof cancelSubscriptionSchema>;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // H-02: Get account ID from auth middleware using correct property
      const accountId = request.auth?.accountId;

      if (!accountId) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const { immediately } = cancelSubscriptionSchema.parse(request.body);

      await subscriptionService.cancelSubscription(accountId, immediately);

      return reply.send({
        success: true,
        message: immediately
          ? 'Subscription canceled immediately'
          : 'Subscription will be canceled at the end of the billing period',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to cancel subscription');

      return reply.code(500).send({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to cancel subscription',
      });
    }
  }

  /**
   * Process webhook event
   * @param event - Stripe event
   */
  private async processWebhookEvent(event: Stripe.Event): Promise<void> {
    logger.info({ eventType: event.type, eventId: event.id }, 'Processing webhook event');

    switch (event.type) {
      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await subscriptionService.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'customer.subscription.deleted':
        await subscriptionService.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      // Invoice events
      case 'invoice.payment_succeeded':
        await subscriptionService.handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice
        );
        break;

      case 'invoice.payment_failed':
        await subscriptionService.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice
        );
        break;

      // Checkout session completed
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscription = await stripeService.getStripeSubscription(
            session.subscription as string
          );
          await subscriptionService.syncSubscription(subscription);
        }
        break;

      default:
        logger.info({ eventType: event.type }, 'Unhandled webhook event type');
    }
  }
}

export const paymentController = new PaymentController();
