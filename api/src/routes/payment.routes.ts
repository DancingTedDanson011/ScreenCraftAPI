import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { paymentController } from '../controllers/payment.controller.js';

/**
 * Payment Routes Plugin
 * Registers all payment and subscription-related endpoints
 */
export async function paymentRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Create Checkout Session
  fastify.post(
    '/checkout',
    {
      schema: {
        description: 'Create a Stripe checkout session for subscription',
        tags: ['payment'],
        body: {
          type: 'object',
          required: ['tier'],
          properties: {
            tier: {
              type: 'string',
              enum: ['PRO', 'BUSINESS', 'ENTERPRISE'],
              description: 'Subscription tier to purchase',
            },
          },
        },
        response: {
          200: {
            description: 'Checkout session created successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  url: { type: 'string', description: 'Stripe checkout URL' },
                  sessionId: { type: 'string', description: 'Checkout session ID' },
                },
              },
            },
          },
          400: {
            description: 'Bad request - invalid tier or existing subscription',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          401: {
            description: 'Unauthorized - missing or invalid API key',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    paymentController.createCheckout.bind(paymentController)
  );

  // Create Customer Portal Session
  fastify.get(
    '/portal',
    {
      schema: {
        description: 'Create a Stripe customer portal session for subscription management',
        tags: ['payment'],
        response: {
          200: {
            description: 'Portal session created successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  url: { type: 'string', description: 'Stripe customer portal URL' },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    paymentController.createPortal.bind(paymentController)
  );

  // Get Current Subscription
  fastify.get(
    '/subscription',
    {
      schema: {
        description: 'Get current subscription details',
        tags: ['payment'],
        response: {
          200: {
            description: 'Subscription retrieved successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: ['object', 'null'],
                properties: {
                  id: { type: 'string' },
                  tier: { type: 'string' },
                  status: { type: 'string' },
                  currentPeriodStart: { type: 'string', format: 'date-time' },
                  currentPeriodEnd: { type: 'string', format: 'date-time' },
                  cancelAtPeriodEnd: { type: 'boolean' },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    paymentController.getSubscription.bind(paymentController)
  );

  // Cancel Subscription
  fastify.post(
    '/subscription/cancel',
    {
      schema: {
        description: 'Cancel current subscription',
        tags: ['payment'],
        body: {
          type: 'object',
          properties: {
            immediately: {
              type: 'boolean',
              default: false,
              description: 'Cancel immediately or at period end',
            },
          },
        },
        response: {
          200: {
            description: 'Subscription canceled successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    paymentController.cancelSubscription.bind(paymentController)
  );

  // Stripe Webhook Handler
  // Note: This endpoint should NOT use authentication middleware
  // It needs to accept raw body for signature verification
  fastify.post(
    '/webhooks/stripe',
    {
      config: {
        rawBody: true, // Enable raw body parsing for webhook signature verification
      },
      schema: {
        description: 'Stripe webhook endpoint for subscription events',
        tags: ['payment', 'webhooks'],
        headers: {
          type: 'object',
          properties: {
            'stripe-signature': {
              type: 'string',
              description: 'Stripe webhook signature for verification',
            },
          },
          required: ['stripe-signature'],
        },
        response: {
          200: {
            description: 'Webhook processed successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              received: { type: 'boolean' },
            },
          },
          400: {
            description: 'Bad request - invalid signature or payload',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    paymentController.handleWebhook.bind(paymentController)
  );
}

// Export default for auto-loading
export default paymentRoutes;
