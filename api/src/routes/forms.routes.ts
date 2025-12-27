import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { formsController } from '../controllers/forms.controller';

/**
 * Forms Routes Plugin
 * Registers all form-related endpoints (newsletter, contact, feedback)
 */
export async function formsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  // ==========================================
  // NEWSLETTER ROUTES (Public)
  // ==========================================

  // Subscribe to Newsletter
  fastify.post(
    '/newsletter/subscribe',
    {
      schema: {
        description: 'Subscribe to the newsletter with double opt-in',
        tags: ['forms', 'newsletter'],
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address to subscribe',
            },
            source: {
              type: 'string',
              maxLength: 50,
              description: 'Source of the subscription (e.g., homepage, footer)',
            },
          },
        },
        response: {
          201: {
            description: 'Subscription initiated - confirmation email sent',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          200: {
            description: 'Confirmation email resent for pending subscription',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          400: {
            description: 'Bad request - already subscribed or validation error',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    formsController.subscribeNewsletter.bind(formsController)
  );

  // Confirm Newsletter Subscription (Double Opt-in)
  fastify.get(
    '/newsletter/confirm/:token',
    {
      schema: {
        description: 'Confirm newsletter subscription via email link',
        tags: ['forms', 'newsletter'],
        params: {
          type: 'object',
          required: ['token'],
          properties: {
            token: {
              type: 'string',
              format: 'uuid',
              description: 'Confirmation token from email',
            },
          },
        },
        response: {
          302: {
            description: 'Redirect to confirmation success page',
          },
          400: {
            description: 'Invalid token format',
            type: 'object',
          },
          404: {
            description: 'Token not found or expired',
            type: 'object',
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    formsController.confirmNewsletter.bind(formsController)
  );

  // Unsubscribe from Newsletter
  fastify.get(
    '/newsletter/unsubscribe/:token',
    {
      schema: {
        description: 'Unsubscribe from newsletter via email link',
        tags: ['forms', 'newsletter'],
        params: {
          type: 'object',
          required: ['token'],
          properties: {
            token: {
              type: 'string',
              format: 'uuid',
              description: 'Unsubscribe token from email',
            },
          },
        },
        response: {
          302: {
            description: 'Redirect to unsubscribe success page',
          },
          400: {
            description: 'Invalid token format',
            type: 'object',
          },
          404: {
            description: 'Token not found',
            type: 'object',
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    formsController.unsubscribeNewsletter.bind(formsController)
  );

  // ==========================================
  // CONTACT FORM ROUTES (Public)
  // ==========================================

  // Submit Contact Form
  fastify.post(
    '/contact',
    {
      schema: {
        description: 'Submit contact form message',
        tags: ['forms', 'contact'],
        body: {
          type: 'object',
          required: ['name', 'email', 'subject', 'message'],
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              description: 'Sender name',
            },
            email: {
              type: 'string',
              format: 'email',
              maxLength: 255,
              description: 'Sender email address',
            },
            subject: {
              type: 'string',
              enum: ['general', 'support', 'sales', 'partnership', 'other'],
              description: 'Message subject category',
            },
            message: {
              type: 'string',
              minLength: 10,
              maxLength: 5000,
              description: 'Message content',
            },
            website: {
              type: 'string',
              maxLength: 0,
              description: 'Honeypot field - should be empty',
            },
          },
        },
        response: {
          201: {
            description: 'Contact form submitted successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  details: { type: 'array' },
                },
              },
            },
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    formsController.submitContact.bind(formsController)
  );

  // ==========================================
  // FEEDBACK ROUTES (Authenticated)
  // ==========================================

  // Submit Feedback
  fastify.post(
    '/feedback',
    {
      schema: {
        description: 'Submit feedback (requires authentication)',
        tags: ['forms', 'feedback'],
        security: [{ apiKey: [] }],
        body: {
          type: 'object',
          required: ['rating', 'category'],
          properties: {
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Rating from 1 to 5',
            },
            category: {
              type: 'string',
              enum: ['bug', 'feature', 'improvement', 'other'],
              description: 'Feedback category',
            },
            message: {
              type: 'string',
              maxLength: 2000,
              description: 'Optional feedback message',
            },
            page: {
              type: 'string',
              maxLength: 255,
              description: 'Page where feedback was submitted',
            },
          },
        },
        response: {
          201: {
            description: 'Feedback submitted successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            type: 'object',
          },
          401: {
            description: 'Unauthorized - authentication required',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    formsController.submitFeedback.bind(formsController)
  );

  // Get My Feedback
  fastify.get(
    '/feedback',
    {
      schema: {
        description: 'Get feedback submitted by current account (requires authentication)',
        tags: ['forms', 'feedback'],
        security: [{ apiKey: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description: 'Page number',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Items per page',
            },
          },
        },
        response: {
          200: {
            description: 'Feedback list retrieved successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    rating: { type: 'integer' },
                    category: { type: 'string' },
                    message: { type: ['string', 'null'] },
                    page: { type: ['string', 'null'] },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
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
    formsController.getMyFeedback.bind(formsController)
  );
}

// Export default for auto-loading
export default formsRoutes;
