import { z } from 'zod';

// Newsletter Subscription Schema
export const newsletterSubscribeSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  source: z.string().max(50).optional(),
});

// Newsletter Confirmation Schema
export const newsletterConfirmSchema = z.object({
  token: z.string().uuid('Invalid token'),
});

// Newsletter Unsubscribe Schema
export const newsletterUnsubscribeSchema = z.object({
  token: z.string().uuid('Invalid token'),
});

// Contact Form Subject Enum
export const contactSubjectEnum = z.enum([
  'general',
  'support',
  'sales',
  'partnership',
  'other',
]);

// Contact Form Submission Schema
export const contactSubmitSchema = z.object({
  name: z.string().min(2, 'Name too short').max(100),
  email: z.string().email('Invalid email').max(255),
  subject: contactSubjectEnum,
  message: z.string().min(10, 'Message too short').max(5000),
  website: z.string().max(0).optional(), // Honeypot field - should be empty
});

// Feedback Category Enum
export const feedbackCategoryEnum = z.enum([
  'bug',
  'feature',
  'improvement',
  'other',
]);

// Feedback Submission Schema
export const feedbackSubmitSchema = z.object({
  rating: z.number().int().min(1).max(5),
  category: feedbackCategoryEnum,
  message: z.string().max(2000).optional(),
  page: z.string().max(255).optional(),
});

// Type Exports
export type NewsletterSubscribe = z.infer<typeof newsletterSubscribeSchema>;
export type NewsletterConfirm = z.infer<typeof newsletterConfirmSchema>;
export type NewsletterUnsubscribe = z.infer<typeof newsletterUnsubscribeSchema>;
export type ContactSubject = z.infer<typeof contactSubjectEnum>;
export type ContactSubmit = z.infer<typeof contactSubmitSchema>;
export type FeedbackCategory = z.infer<typeof feedbackCategoryEnum>;
export type FeedbackSubmit = z.infer<typeof feedbackSubmitSchema>;
