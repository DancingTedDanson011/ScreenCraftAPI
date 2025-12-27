import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock crypto module for UUID generation
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid-12345678'),
}));

// Create comprehensive Prisma mock
const mockPrisma = {
  newsletterSubscriber: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  contactSubmission: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  feedback: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
};

// Mock the prisma import
vi.mock('../../../../src/lib/db', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
const { FormsRepository } = await import(
  '../../../../src/services/database/forms.repository.js'
);

// Test data factories
const createMockSubscriber = (overrides = {}) => ({
  id: 'sub-123',
  email: 'subscriber@example.com',
  status: 'PENDING' as const,
  confirmToken: 'token-12345',
  confirmedAt: null,
  unsubscribeToken: 'unsub-token-12345',
  source: 'website',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

const createMockContact = (overrides = {}) => ({
  id: 'contact-123',
  name: 'John Doe',
  email: 'john@example.com',
  subject: 'Inquiry',
  message: 'Hello, I have a question.',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  status: 'NEW' as const,
  repliedAt: null,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

const createMockFeedback = (overrides = {}) => ({
  id: 'feedback-123',
  accountId: 'acc-123',
  rating: 5,
  category: 'FEATURE' as const,
  message: 'Great service!',
  page: '/dashboard',
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

describe('FormsRepository', () => {
  let repository: InstanceType<typeof FormsRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new FormsRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================
  // NEWSLETTER SUBSCRIBER OPERATIONS
  // ===========================================
  describe('Newsletter Subscriber Operations', () => {
    // createSubscriber
    describe('createSubscriber', () => {
      it('should create subscriber with pending status', async () => {
        const mockSubscriber = createMockSubscriber();
        mockPrisma.newsletterSubscriber.create.mockResolvedValue(mockSubscriber);

        const result = await repository.createSubscriber({
          email: 'new@example.com',
          source: 'landing-page',
        });

        expect(result).toEqual(mockSubscriber);
        expect(mockPrisma.newsletterSubscriber.create).toHaveBeenCalledWith({
          data: {
            email: 'new@example.com',
            source: 'landing-page',
            confirmToken: expect.any(String),
            status: 'PENDING',
          },
        });
      });

      it('should normalize email to lowercase and trim', async () => {
        const mockSubscriber = createMockSubscriber();
        mockPrisma.newsletterSubscriber.create.mockResolvedValue(mockSubscriber);

        await repository.createSubscriber({
          email: '  TEST@EXAMPLE.COM  ',
        });

        expect(mockPrisma.newsletterSubscriber.create).toHaveBeenCalledWith({
          data: {
            email: 'test@example.com',
            source: undefined,
            confirmToken: expect.any(String),
            status: 'PENDING',
          },
        });
      });

      it('should create subscriber without source', async () => {
        const mockSubscriber = createMockSubscriber({ source: null });
        mockPrisma.newsletterSubscriber.create.mockResolvedValue(mockSubscriber);

        await repository.createSubscriber({ email: 'test@example.com' });

        expect(mockPrisma.newsletterSubscriber.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            source: undefined,
          }),
        });
      });
    });

    // findSubscriberByEmail
    describe('findSubscriberByEmail', () => {
      it('should find subscriber by email', async () => {
        const mockSubscriber = createMockSubscriber();
        mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue(mockSubscriber);

        const result = await repository.findSubscriberByEmail('test@example.com');

        expect(result).toEqual(mockSubscriber);
        expect(mockPrisma.newsletterSubscriber.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.com' },
        });
      });

      it('should normalize email before searching', async () => {
        mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue(null);

        await repository.findSubscriberByEmail('  TEST@EXAMPLE.COM  ');

        expect(mockPrisma.newsletterSubscriber.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.com' },
        });
      });

      it('should return null when subscriber not found', async () => {
        mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue(null);

        const result = await repository.findSubscriberByEmail('notfound@example.com');

        expect(result).toBeNull();
      });
    });

    // findSubscriberByConfirmToken
    describe('findSubscriberByConfirmToken', () => {
      it('should find subscriber by confirm token', async () => {
        const mockSubscriber = createMockSubscriber();
        mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue(mockSubscriber);

        const result = await repository.findSubscriberByConfirmToken('token-12345');

        expect(result).toEqual(mockSubscriber);
        expect(mockPrisma.newsletterSubscriber.findUnique).toHaveBeenCalledWith({
          where: { confirmToken: 'token-12345' },
        });
      });

      it('should return null for invalid token', async () => {
        mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue(null);

        const result = await repository.findSubscriberByConfirmToken('invalid');

        expect(result).toBeNull();
      });
    });

    // findSubscriberByUnsubscribeToken
    describe('findSubscriberByUnsubscribeToken', () => {
      it('should find subscriber by unsubscribe token', async () => {
        const mockSubscriber = createMockSubscriber();
        mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue(mockSubscriber);

        const result = await repository.findSubscriberByUnsubscribeToken('unsub-token');

        expect(result).toEqual(mockSubscriber);
        expect(mockPrisma.newsletterSubscriber.findUnique).toHaveBeenCalledWith({
          where: { unsubscribeToken: 'unsub-token' },
        });
      });

      it('should return null for invalid unsubscribe token', async () => {
        mockPrisma.newsletterSubscriber.findUnique.mockResolvedValue(null);

        const result = await repository.findSubscriberByUnsubscribeToken('invalid');

        expect(result).toBeNull();
      });
    });

    // confirmSubscriber
    describe('confirmSubscriber', () => {
      it('should confirm subscriber and invalidate token', async () => {
        const confirmedSubscriber = createMockSubscriber({
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          confirmToken: null,
        });
        mockPrisma.newsletterSubscriber.update.mockResolvedValue(confirmedSubscriber);

        const result = await repository.confirmSubscriber('sub-123');

        expect(result.status).toBe('CONFIRMED');
        expect(mockPrisma.newsletterSubscriber.update).toHaveBeenCalledWith({
          where: { id: 'sub-123' },
          data: {
            status: 'CONFIRMED',
            confirmedAt: expect.any(Date),
            confirmToken: null,
          },
        });
      });
    });

    // unsubscribeSubscriber
    describe('unsubscribeSubscriber', () => {
      it('should unsubscribe subscriber', async () => {
        const unsubscribed = createMockSubscriber({ status: 'UNSUBSCRIBED' });
        mockPrisma.newsletterSubscriber.update.mockResolvedValue(unsubscribed);

        const result = await repository.unsubscribeSubscriber('sub-123');

        expect(result.status).toBe('UNSUBSCRIBED');
        expect(mockPrisma.newsletterSubscriber.update).toHaveBeenCalledWith({
          where: { id: 'sub-123' },
          data: { status: 'UNSUBSCRIBED' },
        });
      });
    });

    // listSubscribers
    describe('listSubscribers', () => {
      it('should list subscribers with default pagination', async () => {
        const subscribers = [createMockSubscriber()];
        mockPrisma.newsletterSubscriber.findMany.mockResolvedValue(subscribers);
        mockPrisma.newsletterSubscriber.count.mockResolvedValue(1);

        const result = await repository.listSubscribers();

        expect(result.subscribers).toEqual(subscribers);
        expect(result.total).toBe(1);
        expect(mockPrisma.newsletterSubscriber.findMany).toHaveBeenCalledWith({
          where: {},
          skip: 0,
          take: 50,
          orderBy: { createdAt: 'desc' },
        });
      });

      it('should list subscribers with custom pagination', async () => {
        mockPrisma.newsletterSubscriber.findMany.mockResolvedValue([]);
        mockPrisma.newsletterSubscriber.count.mockResolvedValue(100);

        await repository.listSubscribers({ page: 3, limit: 20 });

        expect(mockPrisma.newsletterSubscriber.findMany).toHaveBeenCalledWith({
          where: {},
          skip: 40, // (3-1) * 20
          take: 20,
          orderBy: { createdAt: 'desc' },
        });
      });

      it('should filter by status', async () => {
        mockPrisma.newsletterSubscriber.findMany.mockResolvedValue([]);
        mockPrisma.newsletterSubscriber.count.mockResolvedValue(0);

        await repository.listSubscribers({ status: 'CONFIRMED' });

        expect(mockPrisma.newsletterSubscriber.findMany).toHaveBeenCalledWith({
          where: { status: 'CONFIRMED' },
          skip: 0,
          take: 50,
          orderBy: { createdAt: 'desc' },
        });
      });
    });

    // getSubscriberStats
    describe('getSubscriberStats', () => {
      it('should return subscriber statistics', async () => {
        mockPrisma.newsletterSubscriber.count
          .mockResolvedValueOnce(100) // total
          .mockResolvedValueOnce(20) // pending
          .mockResolvedValueOnce(70) // confirmed
          .mockResolvedValueOnce(10); // unsubscribed

        const result = await repository.getSubscriberStats();

        expect(result).toEqual({
          total: 100,
          pending: 20,
          confirmed: 70,
          unsubscribed: 10,
        });
      });

      it('should return zeros when no subscribers', async () => {
        mockPrisma.newsletterSubscriber.count.mockResolvedValue(0);

        const result = await repository.getSubscriberStats();

        expect(result).toEqual({
          total: 0,
          pending: 0,
          confirmed: 0,
          unsubscribed: 0,
        });
      });
    });
  });

  // ===========================================
  // CONTACT SUBMISSION OPERATIONS
  // ===========================================
  describe('Contact Submission Operations', () => {
    // createContactSubmission
    describe('createContactSubmission', () => {
      it('should create contact submission with all fields', async () => {
        const mockContact = createMockContact();
        mockPrisma.contactSubmission.create.mockResolvedValue(mockContact);

        const result = await repository.createContactSubmission({
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Inquiry',
          message: 'Hello!',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        });

        expect(result).toEqual(mockContact);
        expect(mockPrisma.contactSubmission.create).toHaveBeenCalledWith({
          data: {
            name: 'John Doe',
            email: 'john@example.com',
            subject: 'Inquiry',
            message: 'Hello!',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            status: 'NEW',
          },
        });
      });

      it('should normalize email to lowercase', async () => {
        const mockContact = createMockContact();
        mockPrisma.contactSubmission.create.mockResolvedValue(mockContact);

        await repository.createContactSubmission({
          name: 'John',
          email: '  JOHN@EXAMPLE.COM  ',
          subject: 'Test',
          message: 'Test message',
        });

        expect(mockPrisma.contactSubmission.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            email: 'john@example.com',
          }),
        });
      });

      it('should create contact without optional fields', async () => {
        const mockContact = createMockContact({
          ipAddress: null,
          userAgent: null,
        });
        mockPrisma.contactSubmission.create.mockResolvedValue(mockContact);

        await repository.createContactSubmission({
          name: 'John',
          email: 'john@example.com',
          subject: 'Test',
          message: 'Test message',
        });

        expect(mockPrisma.contactSubmission.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            ipAddress: undefined,
            userAgent: undefined,
          }),
        });
      });
    });

    // findContactById
    describe('findContactById', () => {
      it('should find contact by ID', async () => {
        const mockContact = createMockContact();
        mockPrisma.contactSubmission.findUnique.mockResolvedValue(mockContact);

        const result = await repository.findContactById('contact-123');

        expect(result).toEqual(mockContact);
        expect(mockPrisma.contactSubmission.findUnique).toHaveBeenCalledWith({
          where: { id: 'contact-123' },
        });
      });

      it('should return null when contact not found', async () => {
        mockPrisma.contactSubmission.findUnique.mockResolvedValue(null);

        const result = await repository.findContactById('nonexistent');

        expect(result).toBeNull();
      });
    });

    // updateContactStatus
    describe('updateContactStatus', () => {
      it('should update contact status', async () => {
        const updatedContact = createMockContact({ status: 'READ' });
        mockPrisma.contactSubmission.update.mockResolvedValue(updatedContact);

        const result = await repository.updateContactStatus('contact-123', 'READ');

        expect(result.status).toBe('READ');
        expect(mockPrisma.contactSubmission.update).toHaveBeenCalledWith({
          where: { id: 'contact-123' },
          data: { status: 'READ' },
        });
      });

      it('should update status with repliedAt date', async () => {
        const repliedAt = new Date();
        const updatedContact = createMockContact({
          status: 'REPLIED',
          repliedAt,
        });
        mockPrisma.contactSubmission.update.mockResolvedValue(updatedContact);

        const result = await repository.updateContactStatus(
          'contact-123',
          'REPLIED',
          repliedAt
        );

        expect(result.status).toBe('REPLIED');
        expect(mockPrisma.contactSubmission.update).toHaveBeenCalledWith({
          where: { id: 'contact-123' },
          data: { status: 'REPLIED', repliedAt },
        });
      });

      it('should update to SPAM status', async () => {
        const spamContact = createMockContact({ status: 'SPAM' });
        mockPrisma.contactSubmission.update.mockResolvedValue(spamContact);

        const result = await repository.updateContactStatus('contact-123', 'SPAM');

        expect(result.status).toBe('SPAM');
      });

      it('should update to ARCHIVED status', async () => {
        const archivedContact = createMockContact({ status: 'ARCHIVED' });
        mockPrisma.contactSubmission.update.mockResolvedValue(archivedContact);

        const result = await repository.updateContactStatus('contact-123', 'ARCHIVED');

        expect(result.status).toBe('ARCHIVED');
      });
    });

    // listContactSubmissions
    describe('listContactSubmissions', () => {
      it('should list contacts with default pagination', async () => {
        const contacts = [createMockContact()];
        mockPrisma.contactSubmission.findMany.mockResolvedValue(contacts);
        mockPrisma.contactSubmission.count.mockResolvedValue(1);

        const result = await repository.listContactSubmissions();

        expect(result.submissions).toEqual(contacts);
        expect(result.total).toBe(1);
        expect(mockPrisma.contactSubmission.findMany).toHaveBeenCalledWith({
          where: {},
          skip: 0,
          take: 50,
          orderBy: { createdAt: 'desc' },
        });
      });

      it('should filter by status', async () => {
        mockPrisma.contactSubmission.findMany.mockResolvedValue([]);
        mockPrisma.contactSubmission.count.mockResolvedValue(0);

        await repository.listContactSubmissions({ status: 'NEW' });

        expect(mockPrisma.contactSubmission.findMany).toHaveBeenCalledWith({
          where: { status: 'NEW' },
          skip: 0,
          take: 50,
          orderBy: { createdAt: 'desc' },
        });
      });

      it('should apply custom pagination', async () => {
        mockPrisma.contactSubmission.findMany.mockResolvedValue([]);
        mockPrisma.contactSubmission.count.mockResolvedValue(50);

        await repository.listContactSubmissions({ page: 2, limit: 25 });

        expect(mockPrisma.contactSubmission.findMany).toHaveBeenCalledWith({
          where: {},
          skip: 25,
          take: 25,
          orderBy: { createdAt: 'desc' },
        });
      });
    });

    // getContactStats
    describe('getContactStats', () => {
      it('should return contact statistics', async () => {
        mockPrisma.contactSubmission.count
          .mockResolvedValueOnce(100) // total
          .mockResolvedValueOnce(30) // new
          .mockResolvedValueOnce(25) // read
          .mockResolvedValueOnce(20) // replied
          .mockResolvedValueOnce(15) // spam
          .mockResolvedValueOnce(10); // archived

        const result = await repository.getContactStats();

        expect(result).toEqual({
          total: 100,
          new: 30,
          read: 25,
          replied: 20,
          spam: 15,
          archived: 10,
        });
      });

      it('should return zeros when no contacts', async () => {
        mockPrisma.contactSubmission.count.mockResolvedValue(0);

        const result = await repository.getContactStats();

        expect(result).toEqual({
          total: 0,
          new: 0,
          read: 0,
          replied: 0,
          spam: 0,
          archived: 0,
        });
      });
    });
  });

  // ===========================================
  // FEEDBACK OPERATIONS
  // ===========================================
  describe('Feedback Operations', () => {
    // createFeedback
    describe('createFeedback', () => {
      it('should create feedback with all fields', async () => {
        const mockFeedback = createMockFeedback();
        mockPrisma.feedback.create.mockResolvedValue(mockFeedback);

        const result = await repository.createFeedback({
          accountId: 'acc-123',
          rating: 5,
          category: 'FEATURE',
          message: 'Great service!',
          page: '/dashboard',
        });

        expect(result).toEqual(mockFeedback);
        expect(mockPrisma.feedback.create).toHaveBeenCalledWith({
          data: {
            accountId: 'acc-123',
            rating: 5,
            category: 'FEATURE',
            message: 'Great service!',
            page: '/dashboard',
          },
        });
      });

      it('should create feedback without optional fields', async () => {
        const mockFeedback = createMockFeedback({
          message: null,
          page: null,
        });
        mockPrisma.feedback.create.mockResolvedValue(mockFeedback);

        await repository.createFeedback({
          accountId: 'acc-123',
          rating: 4,
          category: 'BUG',
        });

        expect(mockPrisma.feedback.create).toHaveBeenCalledWith({
          data: {
            accountId: 'acc-123',
            rating: 4,
            category: 'BUG',
            message: undefined,
            page: undefined,
          },
        });
      });

      it('should handle different categories', async () => {
        const categories = ['BUG', 'FEATURE', 'IMPROVEMENT', 'OTHER'] as const;

        for (const category of categories) {
          const mockFeedback = createMockFeedback({ category });
          mockPrisma.feedback.create.mockResolvedValue(mockFeedback);

          await repository.createFeedback({
            accountId: 'acc-123',
            rating: 3,
            category,
          });

          expect(mockPrisma.feedback.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ category }),
          });
        }
      });
    });

    // findFeedbackById
    describe('findFeedbackById', () => {
      it('should find feedback by ID', async () => {
        const mockFeedback = createMockFeedback();
        mockPrisma.feedback.findUnique.mockResolvedValue(mockFeedback);

        const result = await repository.findFeedbackById('feedback-123');

        expect(result).toEqual(mockFeedback);
        expect(mockPrisma.feedback.findUnique).toHaveBeenCalledWith({
          where: { id: 'feedback-123' },
        });
      });

      it('should return null when feedback not found', async () => {
        mockPrisma.feedback.findUnique.mockResolvedValue(null);

        const result = await repository.findFeedbackById('nonexistent');

        expect(result).toBeNull();
      });
    });

    // listAccountFeedback
    describe('listAccountFeedback', () => {
      it('should list feedback for account with default pagination', async () => {
        const feedback = [createMockFeedback()];
        mockPrisma.feedback.findMany.mockResolvedValue(feedback);
        mockPrisma.feedback.count.mockResolvedValue(1);

        const result = await repository.listAccountFeedback('acc-123');

        expect(result.feedback).toEqual(feedback);
        expect(result.total).toBe(1);
        expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
          where: { accountId: 'acc-123' },
          skip: 0,
          take: 50,
          orderBy: { createdAt: 'desc' },
        });
      });

      it('should apply custom pagination', async () => {
        mockPrisma.feedback.findMany.mockResolvedValue([]);
        mockPrisma.feedback.count.mockResolvedValue(100);

        await repository.listAccountFeedback('acc-123', { page: 3, limit: 10 });

        expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
          where: { accountId: 'acc-123' },
          skip: 20,
          take: 10,
          orderBy: { createdAt: 'desc' },
        });
      });
    });

    // listAllFeedback
    describe('listAllFeedback', () => {
      it('should list all feedback with account info', async () => {
        const feedback = [
          {
            ...createMockFeedback(),
            account: { id: 'acc-123', email: 'test@example.com' },
          },
        ];
        mockPrisma.feedback.findMany.mockResolvedValue(feedback);
        mockPrisma.feedback.count.mockResolvedValue(1);

        const result = await repository.listAllFeedback();

        expect(result.feedback).toEqual(feedback);
        expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
          where: {},
          skip: 0,
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            account: {
              select: { id: true, email: true },
            },
          },
        });
      });

      it('should filter by category', async () => {
        mockPrisma.feedback.findMany.mockResolvedValue([]);
        mockPrisma.feedback.count.mockResolvedValue(0);

        await repository.listAllFeedback({ category: 'BUG' });

        expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
          where: { category: 'BUG' },
          skip: 0,
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            account: {
              select: { id: true, email: true },
            },
          },
        });
      });

      it('should apply pagination', async () => {
        mockPrisma.feedback.findMany.mockResolvedValue([]);
        mockPrisma.feedback.count.mockResolvedValue(200);

        await repository.listAllFeedback({ page: 5, limit: 20 });

        expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
          where: {},
          skip: 80,
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            account: {
              select: { id: true, email: true },
            },
          },
        });
      });
    });

    // getFeedbackStats
    describe('getFeedbackStats', () => {
      it('should return comprehensive feedback statistics', async () => {
        mockPrisma.feedback.count.mockResolvedValue(100);
        mockPrisma.feedback.aggregate.mockResolvedValue({ _avg: { rating: 4.2 } });
        mockPrisma.feedback.groupBy
          .mockResolvedValueOnce([
            { category: 'FEATURE', _count: { category: 40 } },
            { category: 'BUG', _count: { category: 30 } },
            { category: 'IMPROVEMENT', _count: { category: 20 } },
            { category: 'OTHER', _count: { category: 10 } },
          ])
          .mockResolvedValueOnce([
            { rating: 5, _count: { rating: 50 } },
            { rating: 4, _count: { rating: 30 } },
            { rating: 3, _count: { rating: 15 } },
            { rating: 2, _count: { rating: 3 } },
            { rating: 1, _count: { rating: 2 } },
          ]);

        const result = await repository.getFeedbackStats();

        expect(result).toEqual({
          total: 100,
          averageRating: 4.2,
          byCategory: {
            FEATURE: 40,
            BUG: 30,
            IMPROVEMENT: 20,
            OTHER: 10,
          },
          byRating: {
            5: 50,
            4: 30,
            3: 15,
            2: 3,
            1: 2,
          },
        });
      });

      it('should handle null average rating', async () => {
        mockPrisma.feedback.count.mockResolvedValue(0);
        mockPrisma.feedback.aggregate.mockResolvedValue({ _avg: { rating: null } });
        mockPrisma.feedback.groupBy.mockResolvedValue([]);

        const result = await repository.getFeedbackStats();

        expect(result.averageRating).toBe(0);
      });

      it('should handle empty category and rating groups', async () => {
        mockPrisma.feedback.count.mockResolvedValue(0);
        mockPrisma.feedback.aggregate.mockResolvedValue({ _avg: { rating: null } });
        mockPrisma.feedback.groupBy.mockResolvedValue([]);

        const result = await repository.getFeedbackStats();

        expect(result.byCategory).toEqual({});
        expect(result.byRating).toEqual({});
      });
    });
  });

  // ===========================================
  // ERROR HANDLING
  // ===========================================
  describe('Error Handling', () => {
    it('should propagate database errors from createSubscriber', async () => {
      mockPrisma.newsletterSubscriber.create.mockRejectedValue(
        new Error('Unique constraint violation')
      );

      await expect(
        repository.createSubscriber({ email: 'dup@example.com' })
      ).rejects.toThrow('Unique constraint violation');
    });

    it('should propagate database errors from createContactSubmission', async () => {
      mockPrisma.contactSubmission.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        repository.createContactSubmission({
          name: 'John',
          email: 'john@example.com',
          subject: 'Test',
          message: 'Test',
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate database errors from createFeedback', async () => {
      mockPrisma.feedback.create.mockRejectedValue(
        new Error('Foreign key constraint failed')
      );

      await expect(
        repository.createFeedback({
          accountId: 'invalid',
          rating: 5,
          category: 'FEATURE',
        })
      ).rejects.toThrow('Foreign key constraint failed');
    });

    it('should propagate database errors from confirmSubscriber', async () => {
      mockPrisma.newsletterSubscriber.update.mockRejectedValue(
        new Error('Record not found')
      );

      await expect(repository.confirmSubscriber('invalid')).rejects.toThrow(
        'Record not found'
      );
    });

    it('should propagate database errors from updateContactStatus', async () => {
      mockPrisma.contactSubmission.update.mockRejectedValue(
        new Error('Record not found')
      );

      await expect(
        repository.updateContactStatus('invalid', 'READ')
      ).rejects.toThrow('Record not found');
    });

    it('should propagate database errors from getSubscriberStats', async () => {
      mockPrisma.newsletterSubscriber.count.mockRejectedValue(
        new Error('Query timeout')
      );

      await expect(repository.getSubscriberStats()).rejects.toThrow(
        'Query timeout'
      );
    });

    it('should propagate database errors from getFeedbackStats', async () => {
      mockPrisma.feedback.count.mockRejectedValue(
        new Error('Connection refused')
      );

      await expect(repository.getFeedbackStats()).rejects.toThrow(
        'Connection refused'
      );
    });
  });

  // ===========================================
  // EDGE CASES
  // ===========================================
  describe('Edge Cases', () => {
    it('should handle empty email string', async () => {
      const mockSubscriber = createMockSubscriber({ email: '' });
      mockPrisma.newsletterSubscriber.create.mockResolvedValue(mockSubscriber);

      await repository.createSubscriber({ email: '' });

      expect(mockPrisma.newsletterSubscriber.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: '',
        }),
      });
    });

    it('should handle very long messages', async () => {
      const longMessage = 'a'.repeat(10000);
      const mockContact = createMockContact({ message: longMessage });
      mockPrisma.contactSubmission.create.mockResolvedValue(mockContact);

      await repository.createContactSubmission({
        name: 'John',
        email: 'john@example.com',
        subject: 'Test',
        message: longMessage,
      });

      expect(mockPrisma.contactSubmission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: longMessage,
        }),
      });
    });

    it('should handle ratings at boundary values', async () => {
      for (const rating of [1, 5]) {
        const mockFeedback = createMockFeedback({ rating });
        mockPrisma.feedback.create.mockResolvedValue(mockFeedback);

        await repository.createFeedback({
          accountId: 'acc-123',
          rating,
          category: 'FEATURE',
        });

        expect(mockPrisma.feedback.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ rating }),
        });
      }
    });

    it('should handle page 1 correctly in pagination', async () => {
      mockPrisma.newsletterSubscriber.findMany.mockResolvedValue([]);
      mockPrisma.newsletterSubscriber.count.mockResolvedValue(0);

      await repository.listSubscribers({ page: 1, limit: 10 });

      expect(mockPrisma.newsletterSubscriber.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle special characters in email', async () => {
      const specialEmail = "test+special'chars@example.com";
      const mockSubscriber = createMockSubscriber({ email: specialEmail });
      mockPrisma.newsletterSubscriber.create.mockResolvedValue(mockSubscriber);

      await repository.createSubscriber({ email: specialEmail });

      expect(mockPrisma.newsletterSubscriber.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: specialEmail,
        }),
      });
    });

    it('should handle Unicode in names and messages', async () => {
      const mockContact = createMockContact({
        name: 'Hans Mueller',
        message: 'Testing Unicode',
      });
      mockPrisma.contactSubmission.create.mockResolvedValue(mockContact);

      await repository.createContactSubmission({
        name: 'Hans Mueller',
        email: 'test@example.com',
        subject: 'Unicode Test',
        message: 'Testing Unicode',
      });

      expect(mockPrisma.contactSubmission.create).toHaveBeenCalled();
    });
  });
});
