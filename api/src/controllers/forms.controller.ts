// Forms Controller - HTTP Request Handlers for Newsletter, Contact, and Feedback

import { FastifyRequest, FastifyReply } from 'fastify';
import { formsRepository } from '../services/database/forms.repository';
import { emailService } from '../services/email/email.service';
import {
  newsletterSubscribeSchema,
  contactSubmitSchema,
  feedbackSubmitSchema,
  type NewsletterSubscribe,
  type ContactSubmit,
  type FeedbackSubmit,
} from '../schemas/forms.schema';
import { z } from 'zod';

// Base URL for links in emails
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4321';

export class FormsController {
  // ==========================================
  // NEWSLETTER ENDPOINTS
  // ==========================================

  /**
   * Subscribe to newsletter
   * POST /v1/forms/newsletter/subscribe
   */
  async subscribeNewsletter(
    request: FastifyRequest<{ Body: NewsletterSubscribe }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Validate request body
      const data = newsletterSubscribeSchema.parse(request.body);

      // Check if email already exists
      const existing = await formsRepository.findSubscriberByEmail(data.email);

      if (existing) {
        if (existing.status === 'CONFIRMED') {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'ALREADY_SUBSCRIBED',
              message: 'This email is already subscribed to our newsletter',
            },
          });
        }

        // Resend confirmation email for pending subscribers
        if (existing.confirmToken) {
          const confirmUrl = `${FRONTEND_URL}/newsletter/confirm?token=${existing.confirmToken}`;
          await emailService.sendNewsletterConfirmation(data.email, confirmUrl);
        }

        return reply.code(200).send({
          success: true,
          message: 'Confirmation email resent. Please check your inbox.',
        });
      }

      // Create new subscriber
      const subscriber = await formsRepository.createSubscriber({
        email: data.email,
        source: data.source,
      });

      // Send confirmation email
      const confirmUrl = `${FRONTEND_URL}/newsletter/confirm?token=${subscriber.confirmToken}`;
      await emailService.sendNewsletterConfirmation(data.email, confirmUrl);

      return reply.code(201).send({
        success: true,
        message: 'Please check your email to confirm your subscription.',
      });
    } catch (error) {
      console.error('Newsletter subscription failed:', error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        });
      }

      return reply.code(500).send({
        success: false,
        error: {
          code: 'SUBSCRIPTION_FAILED',
          message: 'Failed to process subscription. Please try again later.',
        },
      });
    }
  }

  /**
   * Confirm newsletter subscription (double opt-in)
   * GET /v1/forms/newsletter/confirm/:token
   */
  async confirmNewsletter(
    request: FastifyRequest<{ Params: { token: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { token } = request.params;

      // Validate token format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(token)) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid confirmation token format',
          },
        });
      }

      // Find subscriber by confirmation token
      const subscriber = await formsRepository.findSubscriberByConfirmToken(token);

      if (!subscriber) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'TOKEN_NOT_FOUND',
            message: 'Invalid or expired confirmation token',
          },
        });
      }

      // Check if already confirmed
      if (subscriber.status === 'CONFIRMED') {
        return reply.redirect(`${FRONTEND_URL}/newsletter/already-confirmed`);
      }

      // Confirm the subscriber
      await formsRepository.confirmSubscriber(subscriber.id);

      // Send welcome email
      const unsubscribeUrl = `${FRONTEND_URL}/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}`;
      await emailService.sendNewsletterWelcome(subscriber.email, unsubscribeUrl);

      // Redirect to confirmation success page
      return reply.redirect(`${FRONTEND_URL}/newsletter/confirmed`);
    } catch (error) {
      console.error('Newsletter confirmation failed:', error);

      return reply.code(500).send({
        success: false,
        error: {
          code: 'CONFIRMATION_FAILED',
          message: 'Failed to confirm subscription. Please try again.',
        },
      });
    }
  }

  /**
   * Unsubscribe from newsletter
   * GET /v1/forms/newsletter/unsubscribe/:token
   */
  async unsubscribeNewsletter(
    request: FastifyRequest<{ Params: { token: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { token } = request.params;

      // Validate token format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(token)) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid unsubscribe token format',
          },
        });
      }

      // Find subscriber by unsubscribe token
      const subscriber = await formsRepository.findSubscriberByUnsubscribeToken(token);

      if (!subscriber) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'TOKEN_NOT_FOUND',
            message: 'Invalid unsubscribe token',
          },
        });
      }

      // Check if already unsubscribed
      if (subscriber.status === 'UNSUBSCRIBED') {
        return reply.redirect(`${FRONTEND_URL}/newsletter/already-unsubscribed`);
      }

      // Unsubscribe
      await formsRepository.unsubscribeSubscriber(subscriber.id);

      // Redirect to unsubscribe confirmation page
      return reply.redirect(`${FRONTEND_URL}/newsletter/unsubscribed`);
    } catch (error) {
      console.error('Newsletter unsubscribe failed:', error);

      return reply.code(500).send({
        success: false,
        error: {
          code: 'UNSUBSCRIBE_FAILED',
          message: 'Failed to unsubscribe. Please try again.',
        },
      });
    }
  }

  // ==========================================
  // CONTACT FORM ENDPOINTS
  // ==========================================

  /**
   * Submit contact form
   * POST /v1/forms/contact
   */
  async submitContact(
    request: FastifyRequest<{ Body: ContactSubmit }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Validate request body
      const data = contactSubmitSchema.parse(request.body);

      // Honeypot check - if website field is filled, it's likely a bot
      if (data.website && data.website.length > 0) {
        // Silent success for bots to avoid detection
        console.log('Honeypot triggered - likely bot submission');
        return reply.code(201).send({
          success: true,
          message: 'Message sent successfully.',
        });
      }

      // Create contact submission
      const submission = await formsRepository.createContactSubmission({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      // Send emails (non-blocking)
      Promise.all([
        emailService.sendContactAutoReply(data.email, data.name),
        emailService.sendContactNotification({
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
        }),
      ]).catch((error) => {
        console.error('Failed to send contact emails:', error);
      });

      return reply.code(201).send({
        success: true,
        message: 'Message sent successfully. We will get back to you soon.',
        data: {
          id: submission.id,
        },
      });
    } catch (error) {
      console.error('Contact form submission failed:', error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        });
      }

      return reply.code(500).send({
        success: false,
        error: {
          code: 'SUBMISSION_FAILED',
          message: 'Failed to submit message. Please try again later.',
        },
      });
    }
  }

  // ==========================================
  // FEEDBACK ENDPOINTS
  // ==========================================

  /**
   * Submit feedback (requires authentication)
   * POST /v1/forms/feedback
   */
  async submitFeedback(
    request: FastifyRequest<{ Body: FeedbackSubmit }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Validate request body
      const data = feedbackSubmitSchema.parse(request.body);

      // Get account ID from auth middleware
      const accountId = (request as any).account?.id || (request as any).accountId;

      if (!accountId) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required to submit feedback',
          },
        });
      }

      // Map category string to enum value
      const categoryMap: Record<string, 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'OTHER'> = {
        bug: 'BUG',
        feature: 'FEATURE',
        improvement: 'IMPROVEMENT',
        other: 'OTHER',
      };

      // Create feedback
      const feedback = await formsRepository.createFeedback({
        accountId,
        rating: data.rating,
        category: categoryMap[data.category] || 'OTHER',
        message: data.message,
        page: data.page,
      });

      return reply.code(201).send({
        success: true,
        message: 'Thank you for your feedback!',
        data: {
          id: feedback.id,
        },
      });
    } catch (error) {
      console.error('Feedback submission failed:', error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        });
      }

      return reply.code(500).send({
        success: false,
        error: {
          code: 'SUBMISSION_FAILED',
          message: 'Failed to submit feedback. Please try again later.',
        },
      });
    }
  }

  /**
   * Get feedback for current account (requires authentication)
   * GET /v1/forms/feedback
   */
  async getMyFeedback(
    request: FastifyRequest<{
      Querystring: { page?: number; limit?: number };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Get account ID from auth middleware
      const accountId = (request as any).account?.id || (request as any).accountId;

      if (!accountId) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const { page = 1, limit = 20 } = request.query;

      const { feedback, total } = await formsRepository.listAccountFeedback(accountId, {
        page,
        limit,
      });

      return reply.send({
        success: true,
        data: feedback,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Failed to get feedback:', error);

      return reply.code(500).send({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to retrieve feedback',
        },
      });
    }
  }
}

// Export singleton instance
export const formsController = new FormsController();
