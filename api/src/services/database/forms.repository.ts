import { prisma } from '../../lib/db';
import { randomUUID } from 'crypto';
import { anonymizeIp } from '../../utils/pii-sanitizer.js';

// Type aliases for Prisma models
type NewsletterSubscriber = {
  id: string;
  email: string;
  status: 'PENDING' | 'CONFIRMED' | 'UNSUBSCRIBED';
  confirmToken: string | null;
  confirmedAt: Date | null;
  unsubscribeToken: string;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ipAddress: string | null;
  userAgent: string | null;
  status: 'NEW' | 'READ' | 'REPLIED' | 'SPAM' | 'ARCHIVED';
  repliedAt: Date | null;
  createdAt: Date;
};

type Feedback = {
  id: string;
  accountId: string;
  rating: number;
  category: 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'OTHER';
  message: string | null;
  page: string | null;
  createdAt: Date;
};

type SubscriberStatus = 'PENDING' | 'CONFIRMED' | 'UNSUBSCRIBED';
type ContactStatus = 'NEW' | 'READ' | 'REPLIED' | 'SPAM' | 'ARCHIVED';
type FeedbackCategory = 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'OTHER';

// Types for repository operations
export interface CreateSubscriberData {
  email: string;
  source?: string;
}

export interface CreateContactData {
  name: string;
  email: string;
  subject: string;
  message: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateFeedbackData {
  accountId: string;
  rating: number;
  category: FeedbackCategory;
  message?: string;
  page?: string;
}

export interface SubscriberListOptions {
  page?: number;
  limit?: number;
  status?: SubscriberStatus;
}

export interface ContactListOptions {
  page?: number;
  limit?: number;
  status?: ContactStatus;
}

export class FormsRepository {
  // ==========================================
  // NEWSLETTER SUBSCRIBER OPERATIONS
  // ==========================================

  /**
   * Create a new newsletter subscriber with pending status
   */
  async createSubscriber(data: CreateSubscriberData): Promise<NewsletterSubscriber> {
    const confirmToken = randomUUID();

    return prisma.newsletterSubscriber.create({
      data: {
        email: data.email.toLowerCase().trim(),
        source: data.source,
        confirmToken,
        status: 'PENDING',
      },
    });
  }

  /**
   * Find subscriber by email address
   */
  async findSubscriberByEmail(email: string): Promise<NewsletterSubscriber | null> {
    return prisma.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  /**
   * Find subscriber by confirmation token
   */
  async findSubscriberByConfirmToken(token: string): Promise<NewsletterSubscriber | null> {
    return prisma.newsletterSubscriber.findUnique({
      where: { confirmToken: token },
    });
  }

  /**
   * Find subscriber by unsubscribe token
   */
  async findSubscriberByUnsubscribeToken(token: string): Promise<NewsletterSubscriber | null> {
    return prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: token },
    });
  }

  /**
   * Confirm a subscriber (set status to CONFIRMED)
   */
  async confirmSubscriber(id: string): Promise<NewsletterSubscriber> {
    return prisma.newsletterSubscriber.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmToken: null, // Invalidate the confirmation token
      },
    });
  }

  /**
   * Unsubscribe a subscriber
   */
  async unsubscribeSubscriber(id: string): Promise<NewsletterSubscriber> {
    return prisma.newsletterSubscriber.update({
      where: { id },
      data: {
        status: 'UNSUBSCRIBED',
      },
    });
  }

  /**
   * List all subscribers with optional filters
   */
  async listSubscribers(options: SubscriberListOptions = {}): Promise<{
    subscribers: NewsletterSubscriber[];
    total: number;
  }> {
    const { page = 1, limit = 50, status } = options;
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [subscribers, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.newsletterSubscriber.count({ where }),
    ]);

    return { subscribers, total };
  }

  /**
   * Get subscriber statistics
   */
  async getSubscriberStats(): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    unsubscribed: number;
  }> {
    const [total, pending, confirmed, unsubscribed] = await Promise.all([
      prisma.newsletterSubscriber.count(),
      prisma.newsletterSubscriber.count({ where: { status: 'PENDING' } }),
      prisma.newsletterSubscriber.count({ where: { status: 'CONFIRMED' } }),
      prisma.newsletterSubscriber.count({ where: { status: 'UNSUBSCRIBED' } }),
    ]);

    return { total, pending, confirmed, unsubscribed };
  }

  // ==========================================
  // CONTACT SUBMISSION OPERATIONS
  // ==========================================

  /**
   * Create a new contact form submission
   * M-14: IP addresses are anonymized before storage for GDPR compliance
   */
  async createContactSubmission(data: CreateContactData): Promise<ContactSubmission> {
    return prisma.contactSubmission.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase().trim(),
        subject: data.subject,
        message: data.message,
        // M-14: Anonymize IP address before storing (GDPR compliance)
        ipAddress: anonymizeIp(data.ipAddress),
        userAgent: data.userAgent,
        status: 'NEW',
      },
    });
  }

  /**
   * Find contact submission by ID
   */
  async findContactById(id: string): Promise<ContactSubmission | null> {
    return prisma.contactSubmission.findUnique({
      where: { id },
    });
  }

  /**
   * Update contact submission status
   */
  async updateContactStatus(
    id: string,
    status: ContactStatus,
    repliedAt?: Date
  ): Promise<ContactSubmission> {
    return prisma.contactSubmission.update({
      where: { id },
      data: {
        status,
        ...(repliedAt && { repliedAt }),
      },
    });
  }

  /**
   * List contact submissions with optional filters
   */
  async listContactSubmissions(options: ContactListOptions = {}): Promise<{
    submissions: ContactSubmission[];
    total: number;
  }> {
    const { page = 1, limit = 50, status } = options;
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [submissions, total] = await Promise.all([
      prisma.contactSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contactSubmission.count({ where }),
    ]);

    return { submissions, total };
  }

  /**
   * Get contact submission statistics
   */
  async getContactStats(): Promise<{
    total: number;
    new: number;
    read: number;
    replied: number;
    spam: number;
    archived: number;
  }> {
    const [total, newCount, read, replied, spam, archived] = await Promise.all([
      prisma.contactSubmission.count(),
      prisma.contactSubmission.count({ where: { status: 'NEW' } }),
      prisma.contactSubmission.count({ where: { status: 'READ' } }),
      prisma.contactSubmission.count({ where: { status: 'REPLIED' } }),
      prisma.contactSubmission.count({ where: { status: 'SPAM' } }),
      prisma.contactSubmission.count({ where: { status: 'ARCHIVED' } }),
    ]);

    return { total, new: newCount, read, replied, spam, archived };
  }

  // ==========================================
  // FEEDBACK OPERATIONS
  // ==========================================

  /**
   * Create a new feedback entry
   */
  async createFeedback(data: CreateFeedbackData): Promise<Feedback> {
    return prisma.feedback.create({
      data: {
        accountId: data.accountId,
        rating: data.rating,
        category: data.category,
        message: data.message,
        page: data.page,
      },
    });
  }

  /**
   * Find feedback by ID
   */
  async findFeedbackById(id: string): Promise<Feedback | null> {
    return prisma.feedback.findUnique({
      where: { id },
    });
  }

  /**
   * List feedback for an account
   */
  async listAccountFeedback(
    accountId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    feedback: Feedback[];
    total: number;
  }> {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const [feedback, total] = await Promise.all([
      prisma.feedback.findMany({
        where: { accountId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.feedback.count({ where: { accountId } }),
    ]);

    return { feedback, total };
  }

  /**
   * List all feedback with optional category filter
   */
  async listAllFeedback(options: {
    page?: number;
    limit?: number;
    category?: FeedbackCategory;
  } = {}): Promise<{
    feedback: Feedback[];
    total: number;
  }> {
    const { page = 1, limit = 50, category } = options;
    const skip = (page - 1) * limit;

    const where = category ? { category } : {};

    const [feedback, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: {
            select: { id: true, email: true },
          },
        },
      }),
      prisma.feedback.count({ where }),
    ]);

    return { feedback, total };
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(): Promise<{
    total: number;
    averageRating: number;
    byCategory: Record<string, number>;
    byRating: Record<number, number>;
  }> {
    const [total, feedback, categoryGroups, ratingGroups] = await Promise.all([
      prisma.feedback.count(),
      prisma.feedback.aggregate({
        _avg: { rating: true },
      }),
      prisma.feedback.groupBy({
        by: ['category'],
        _count: { category: true },
      }),
      prisma.feedback.groupBy({
        by: ['rating'],
        _count: { rating: true },
      }),
    ]);

    const byCategory: Record<string, number> = {};
    for (const item of categoryGroups) {
      byCategory[item.category] = item._count.category;
    }

    const byRating: Record<number, number> = {};
    for (const item of ratingGroups) {
      byRating[item.rating] = item._count.rating;
    }

    return {
      total,
      averageRating: feedback._avg.rating ?? 0,
      byCategory,
      byRating,
    };
  }
}

// Export singleton instance
export const formsRepository = new FormsRepository();
