import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockEmailResponse,
  MockResendErrors,
  testEmailData,
} from '../../../mocks/resend.mock.js';

// Create the mock send function that we'll control in tests
const mockEmailSend = vi.fn();

// Create mock Resend class
class MockResend {
  emails = {
    send: mockEmailSend,
  };

  constructor(_apiKey: string) {
    // Constructor receives the API key but we don't need to use it in tests
  }
}

// Mock the Resend module before importing the service
vi.mock('resend', () => ({
  Resend: MockResend,
}));

// Import after mocking
const { EmailService, emailService } = await import(
  '../../../../src/services/email/email.service.js'
);

describe('EmailService', () => {
  let service: InstanceType<typeof EmailService>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to success state
    mockEmailSend.mockResolvedValue({
      data: createMockEmailResponse(),
      error: null,
    });
    service = new EmailService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create service with default configuration', () => {
      const service = new EmailService();
      expect(service).toBeInstanceOf(EmailService);
    });

    it('should use environment variables for configuration', () => {
      const originalApiKey = process.env.RESEND_API_KEY;
      const originalFrom = process.env.EMAIL_FROM;
      const originalAdmin = process.env.ADMIN_EMAIL;

      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.EMAIL_FROM = 'Test <test@example.com>';
      process.env.ADMIN_EMAIL = 'admin@test.com';

      const service = new EmailService();
      expect(service).toBeInstanceOf(EmailService);

      // Restore
      process.env.RESEND_API_KEY = originalApiKey;
      process.env.EMAIL_FROM = originalFrom;
      process.env.ADMIN_EMAIL = originalAdmin;
    });

    it('should use fallback values when environment variables are not set', () => {
      const originalApiKey = process.env.RESEND_API_KEY;
      const originalFrom = process.env.EMAIL_FROM;
      const originalAdmin = process.env.ADMIN_EMAIL;

      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_FROM;
      delete process.env.ADMIN_EMAIL;

      const service = new EmailService();
      expect(service).toBeInstanceOf(EmailService);

      // Restore
      process.env.RESEND_API_KEY = originalApiKey;
      process.env.EMAIL_FROM = originalFrom;
      process.env.ADMIN_EMAIL = originalAdmin;
    });
  });

  describe('sendNewsletterConfirmation', () => {
    it('should send newsletter confirmation email successfully', async () => {
      await service.sendNewsletterConfirmation(
        testEmailData.validRecipient,
        testEmailData.confirmUrl
      );

      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testEmailData.validRecipient,
          subject: 'Confirm your ScreenCraft Newsletter subscription',
        })
      );
    });

    it('should include confirmation URL in email body', async () => {
      await service.sendNewsletterConfirmation(
        testEmailData.validRecipient,
        testEmailData.confirmUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain(testEmailData.confirmUrl);
    });

    it('should include proper HTML structure', async () => {
      await service.sendNewsletterConfirmation(
        testEmailData.validRecipient,
        testEmailData.confirmUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('<!DOCTYPE html>');
      expect(callArgs.html).toContain('Confirm Subscription');
      expect(callArgs.html).toContain('Welcome to ScreenCraft');
    });

    it('should include unsubscribe information', async () => {
      await service.sendNewsletterConfirmation(
        testEmailData.validRecipient,
        testEmailData.confirmUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain("didn't subscribe");
      expect(callArgs.html).toContain('24 hours');
    });

    it('should use correct from email', async () => {
      await service.sendNewsletterConfirmation(
        testEmailData.validRecipient,
        testEmailData.confirmUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.from).toBeDefined();
    });

    it('should throw error when Resend API fails', async () => {
      mockEmailSend.mockRejectedValueOnce(MockResendErrors.serverError());

      await expect(
        service.sendNewsletterConfirmation(
          testEmailData.validRecipient,
          testEmailData.confirmUrl
        )
      ).rejects.toThrow('Failed to send confirmation email');
    });

    it('should throw error on rate limit exceeded', async () => {
      mockEmailSend.mockRejectedValueOnce(MockResendErrors.rateLimitExceeded());

      await expect(
        service.sendNewsletterConfirmation(
          testEmailData.validRecipient,
          testEmailData.confirmUrl
        )
      ).rejects.toThrow('Failed to send confirmation email');
    });

    it('should throw error on network failure', async () => {
      mockEmailSend.mockRejectedValueOnce(MockResendErrors.networkError());

      await expect(
        service.sendNewsletterConfirmation(
          testEmailData.validRecipient,
          testEmailData.confirmUrl
        )
      ).rejects.toThrow('Failed to send confirmation email');
    });

    it('should throw error on timeout', async () => {
      mockEmailSend.mockRejectedValueOnce(MockResendErrors.timeout());

      await expect(
        service.sendNewsletterConfirmation(
          testEmailData.validRecipient,
          testEmailData.confirmUrl
        )
      ).rejects.toThrow('Failed to send confirmation email');
    });
  });

  describe('sendNewsletterWelcome', () => {
    it('should send welcome email successfully', async () => {
      await service.sendNewsletterWelcome(
        testEmailData.validRecipient,
        testEmailData.unsubscribeUrl
      );

      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testEmailData.validRecipient,
          subject: 'Welcome to ScreenCraft Newsletter!',
        })
      );
    });

    it('should include unsubscribe URL in email body', async () => {
      await service.sendNewsletterWelcome(
        testEmailData.validRecipient,
        testEmailData.unsubscribeUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain(testEmailData.unsubscribeUrl);
    });

    it('should include proper welcome content', async () => {
      await service.sendNewsletterWelcome(
        testEmailData.validRecipient,
        testEmailData.unsubscribeUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain("You're In!");
      expect(callArgs.html).toContain('Weekly updates');
      expect(callArgs.html).toContain('Tips & tricks');
      expect(callArgs.html).toContain('Early access');
    });

    it('should include documentation link', async () => {
      await service.sendNewsletterWelcome(
        testEmailData.validRecipient,
        testEmailData.unsubscribeUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('https://screencraft.dev/docs');
    });

    it('should include exclusive offers mention', async () => {
      await service.sendNewsletterWelcome(
        testEmailData.validRecipient,
        testEmailData.unsubscribeUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('Exclusive offers');
    });

    it('should throw error when Resend API fails', async () => {
      mockEmailSend.mockRejectedValueOnce(MockResendErrors.serverError());

      await expect(
        service.sendNewsletterWelcome(
          testEmailData.validRecipient,
          testEmailData.unsubscribeUrl
        )
      ).rejects.toThrow('Failed to send welcome email');
    });

    it('should throw error on invalid API key', async () => {
      mockEmailSend.mockRejectedValueOnce(MockResendErrors.invalidApiKey());

      await expect(
        service.sendNewsletterWelcome(
          testEmailData.validRecipient,
          testEmailData.unsubscribeUrl
        )
      ).rejects.toThrow('Failed to send welcome email');
    });
  });

  describe('sendContactAutoReply', () => {
    it('should send auto-reply email successfully', async () => {
      await service.sendContactAutoReply(
        testEmailData.validRecipient,
        testEmailData.validName
      );

      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testEmailData.validRecipient,
          subject: 'We received your message - ScreenCraft',
        })
      );
    });

    it('should include personalized greeting with name', async () => {
      await service.sendContactAutoReply(
        testEmailData.validRecipient,
        testEmailData.validName
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain(`Hi ${testEmailData.validName}`);
    });

    it('should include helpful links', async () => {
      await service.sendContactAutoReply(
        testEmailData.validRecipient,
        testEmailData.validName
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('https://screencraft.dev/docs');
      expect(callArgs.html).toContain('https://screencraft.dev/faq');
      expect(callArgs.html).toContain('https://screencraft.dev/status');
    });

    it('should include response time expectation', async () => {
      await service.sendContactAutoReply(
        testEmailData.validRecipient,
        testEmailData.validName
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('24-48 hours');
    });

    it('should include automated response notice', async () => {
      await service.sendContactAutoReply(
        testEmailData.validRecipient,
        testEmailData.validName
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('automated response');
    });

    it('should escape HTML in name to prevent XSS', async () => {
      await service.sendContactAutoReply(
        testEmailData.validRecipient,
        testEmailData.xssAttemptName
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).not.toContain('<script>');
      expect(callArgs.html).toContain('&lt;script&gt;');
    });

    it('should handle special characters in name', async () => {
      await service.sendContactAutoReply(
        testEmailData.validRecipient,
        testEmailData.specialCharName
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('O&#39;Brien');
      expect(callArgs.html).toContain('&amp;');
    });

    it('should handle unicode characters in name', async () => {
      await service.sendContactAutoReply(
        testEmailData.validRecipient,
        testEmailData.unicodeName
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain(testEmailData.unicodeName);
    });

    it('should throw error when Resend API fails', async () => {
      mockEmailSend.mockRejectedValueOnce(MockResendErrors.serverError());

      await expect(
        service.sendContactAutoReply(
          testEmailData.validRecipient,
          testEmailData.validName
        )
      ).rejects.toThrow('Failed to send auto-reply email');
    });
  });

  describe('sendContactNotification', () => {
    it('should send notification email to admin successfully', async () => {
      await service.sendContactNotification(testEmailData.contactSubmission);

      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('[Contact Form]'),
        })
      );
    });

    it('should include submission details in subject', async () => {
      await service.sendContactNotification(testEmailData.contactSubmission);

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.subject).toContain(testEmailData.contactSubmission.subject);
      expect(callArgs.subject).toContain(testEmailData.contactSubmission.name);
    });

    it('should include all submission fields in body', async () => {
      await service.sendContactNotification(testEmailData.contactSubmission);

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain(testEmailData.contactSubmission.name);
      expect(callArgs.html).toContain(testEmailData.contactSubmission.email);
      expect(callArgs.html).toContain(testEmailData.contactSubmission.subject);
      expect(callArgs.html).toContain(testEmailData.contactSubmission.message);
    });

    it('should include reply mailto link', async () => {
      await service.sendContactNotification(testEmailData.contactSubmission);

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain(`mailto:${testEmailData.contactSubmission.email}`);
      expect(callArgs.html).toContain(`Reply to ${testEmailData.contactSubmission.name}`);
    });

    it('should send to admin email address', async () => {
      await service.sendContactNotification(testEmailData.contactSubmission);

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.to).toBeDefined();
    });

    it('should escape HTML in all submission fields to prevent XSS', async () => {
      const xssSubmission = {
        name: '<script>alert("name")</script>',
        email: 'test@example.com',
        subject: '<img src="x" onerror="alert(1)">',
        message: '<iframe src="evil.com"></iframe>',
      };

      await service.sendContactNotification(xssSubmission);

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).not.toContain('<script>');
      expect(callArgs.html).not.toContain('<iframe');
      expect(callArgs.html).toContain('&lt;script&gt;');
      expect(callArgs.html).toContain('&lt;iframe');
    });

    it('should handle special characters in submission', async () => {
      const specialSubmission = {
        name: "O'Brien & Partners",
        email: 'obrien@example.com',
        subject: 'Question about "Pricing" & Features',
        message: 'We need > 100 screenshots per day & want to know the pricing.',
      };

      await service.sendContactNotification(specialSubmission);

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('O&#39;Brien');
      expect(callArgs.html).toContain('&amp;');
      expect(callArgs.html).toContain('&quot;');
      expect(callArgs.html).toContain('&gt;');
    });

    it('should handle long message content', async () => {
      const longSubmission = {
        ...testEmailData.contactSubmission,
        message: testEmailData.longMessage,
      };

      await service.sendContactNotification(longSubmission);

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('A'.repeat(100)); // Should contain at least part of the message
    });

    it('should throw error when Resend API fails', async () => {
      mockEmailSend.mockRejectedValueOnce(MockResendErrors.serverError());

      await expect(
        service.sendContactNotification(testEmailData.contactSubmission)
      ).rejects.toThrow('Failed to send notification email');
    });

    it('should throw error on validation failure', async () => {
      mockEmailSend.mockRejectedValueOnce(MockResendErrors.missingTo());

      await expect(
        service.sendContactNotification(testEmailData.contactSubmission)
      ).rejects.toThrow('Failed to send notification email');
    });
  });

  describe('escapeHtml (private method via public methods)', () => {
    it('should escape ampersand character', async () => {
      await service.sendContactAutoReply(testEmailData.validRecipient, 'A & B');

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('A &amp; B');
    });

    it('should escape less than character', async () => {
      await service.sendContactAutoReply(testEmailData.validRecipient, 'A < B');

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('A &lt; B');
    });

    it('should escape greater than character', async () => {
      await service.sendContactAutoReply(testEmailData.validRecipient, 'A > B');

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('A &gt; B');
    });

    it('should escape double quote character', async () => {
      await service.sendContactAutoReply(testEmailData.validRecipient, 'Say "Hello"');

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('Say &quot;Hello&quot;');
    });

    it('should escape single quote character', async () => {
      await service.sendContactAutoReply(testEmailData.validRecipient, "It's working");

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('It&#39;s working');
    });

    it('should escape multiple special characters in sequence', async () => {
      await service.sendContactAutoReply(
        testEmailData.validRecipient,
        '<script>alert("xss")</script>'
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should handle empty string', async () => {
      await service.sendContactAutoReply(testEmailData.validRecipient, '');

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('Hi ');
    });

    it('should preserve normal text without special characters', async () => {
      const normalName = 'John Doe';
      await service.sendContactAutoReply(testEmailData.validRecipient, normalName);

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain(`Hi ${normalName}`);
    });
  });

  describe('email template structure', () => {
    it('should use consistent branding across all email types', async () => {
      // Test confirmation email
      await service.sendNewsletterConfirmation(
        testEmailData.validRecipient,
        testEmailData.confirmUrl
      );
      const confirmationHtml = mockEmailSend.mock.calls[0][0].html;

      mockEmailSend.mockClear();

      // Test welcome email
      await service.sendNewsletterWelcome(
        testEmailData.validRecipient,
        testEmailData.unsubscribeUrl
      );
      const welcomeHtml = mockEmailSend.mock.calls[0][0].html;

      mockEmailSend.mockClear();

      // Test auto-reply email
      await service.sendContactAutoReply(
        testEmailData.validRecipient,
        testEmailData.validName
      );
      const autoReplyHtml = mockEmailSend.mock.calls[0][0].html;

      // All should contain ScreenCraft branding
      expect(confirmationHtml).toContain('ScreenCraft');
      expect(welcomeHtml).toContain('ScreenCraft');
      expect(autoReplyHtml).toContain('ScreenCraft');

      // All should have proper HTML structure
      [confirmationHtml, welcomeHtml, autoReplyHtml].forEach((html) => {
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html>');
        expect(html).toContain('</html>');
        expect(html).toContain('<body');
        expect(html).toContain('</body>');
      });
    });

    it('should include viewport meta tag for mobile responsiveness', async () => {
      await service.sendNewsletterConfirmation(
        testEmailData.validRecipient,
        testEmailData.confirmUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('viewport');
      expect(callArgs.html).toContain('width=device-width');
    });

    it('should include proper charset declaration', async () => {
      await service.sendNewsletterConfirmation(
        testEmailData.validRecipient,
        testEmailData.confirmUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('charset="utf-8"');
    });

    it('should include consistent gradient styling', async () => {
      await service.sendNewsletterConfirmation(
        testEmailData.validRecipient,
        testEmailData.confirmUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('linear-gradient');
      expect(callArgs.html).toContain('#667eea');
      expect(callArgs.html).toContain('#764ba2');
    });

    it('should use inline styles for email client compatibility', async () => {
      await service.sendNewsletterConfirmation(
        testEmailData.validRecipient,
        testEmailData.confirmUrl
      );

      const callArgs = mockEmailSend.mock.calls[0][0];
      // Check for inline styles rather than external CSS
      expect(callArgs.html).toContain('style="');
      expect(callArgs.html).not.toContain('<link rel="stylesheet"');
    });
  });

  describe('error handling and logging', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should log error when newsletter confirmation fails', async () => {
      const error = MockResendErrors.serverError();
      mockEmailSend.mockRejectedValueOnce(error);

      await expect(
        service.sendNewsletterConfirmation(
          testEmailData.validRecipient,
          testEmailData.confirmUrl
        )
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send newsletter confirmation email:',
        error
      );
    });

    it('should log error when welcome email fails', async () => {
      const error = MockResendErrors.serverError();
      mockEmailSend.mockRejectedValueOnce(error);

      await expect(
        service.sendNewsletterWelcome(
          testEmailData.validRecipient,
          testEmailData.unsubscribeUrl
        )
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send newsletter welcome email:',
        error
      );
    });

    it('should log error when auto-reply fails', async () => {
      const error = MockResendErrors.serverError();
      mockEmailSend.mockRejectedValueOnce(error);

      await expect(
        service.sendContactAutoReply(
          testEmailData.validRecipient,
          testEmailData.validName
        )
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send contact auto-reply:',
        error
      );
    });

    it('should log error when notification fails', async () => {
      const error = MockResendErrors.serverError();
      mockEmailSend.mockRejectedValueOnce(error);

      await expect(
        service.sendContactNotification(testEmailData.contactSubmission)
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send contact notification:',
        error
      );
    });

    it('should preserve original error in console log', async () => {
      const specificError = new Error('Specific API error message');
      mockEmailSend.mockRejectedValueOnce(specificError);

      await expect(
        service.sendNewsletterConfirmation(
          testEmailData.validRecipient,
          testEmailData.confirmUrl
        )
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        specificError
      );
    });
  });

  describe('concurrent email sending', () => {
    it('should handle multiple concurrent email sends', async () => {
      const promises = [
        service.sendNewsletterConfirmation('user1@example.com', 'https://confirm1'),
        service.sendNewsletterConfirmation('user2@example.com', 'https://confirm2'),
        service.sendNewsletterConfirmation('user3@example.com', 'https://confirm3'),
      ];

      await Promise.all(promises);

      expect(mockEmailSend).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in concurrent sends', async () => {
      mockEmailSend
        .mockResolvedValueOnce({ data: createMockEmailResponse(), error: null })
        .mockRejectedValueOnce(MockResendErrors.serverError())
        .mockResolvedValueOnce({ data: createMockEmailResponse(), error: null });

      const results = await Promise.allSettled([
        service.sendNewsletterConfirmation('user1@example.com', 'https://confirm1'),
        service.sendNewsletterConfirmation('user2@example.com', 'https://confirm2'),
        service.sendNewsletterConfirmation('user3@example.com', 'https://confirm3'),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });

    it('should send different email types concurrently', async () => {
      const promises = [
        service.sendNewsletterConfirmation('user1@example.com', 'https://confirm'),
        service.sendNewsletterWelcome('user2@example.com', 'https://unsub'),
        service.sendContactAutoReply('user3@example.com', 'User 3'),
        service.sendContactNotification(testEmailData.contactSubmission),
      ];

      await Promise.all(promises);

      expect(mockEmailSend).toHaveBeenCalledTimes(4);
    });
  });

  describe('edge cases', () => {
    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(200) + '@example.com';

      await service.sendNewsletterConfirmation(longEmail, testEmailData.confirmUrl);

      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: longEmail,
        })
      );
    });

    it('should handle very long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000);

      await service.sendNewsletterConfirmation(testEmailData.validRecipient, longUrl);

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain(longUrl);
    });

    it('should handle URL with special characters', async () => {
      const specialUrl = 'https://example.com/confirm?token=abc123&user=test@example.com';

      await service.sendNewsletterConfirmation(testEmailData.validRecipient, specialUrl);

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain(specialUrl);
    });

    it('should handle empty message in contact submission', async () => {
      const emptyMessageSubmission = {
        ...testEmailData.contactSubmission,
        message: '',
      };

      await service.sendContactNotification(emptyMessageSubmission);

      expect(mockEmailSend).toHaveBeenCalledTimes(1);
    });

    it('should handle submission with whitespace-only fields', async () => {
      const whitespaceSubmission = {
        name: '   ',
        email: 'test@example.com',
        subject: '\t\n',
        message: '    ',
      };

      await service.sendContactNotification(whitespaceSubmission);

      expect(mockEmailSend).toHaveBeenCalledTimes(1);
    });

    it('should handle submission with newlines in message', async () => {
      const multilineSubmission = {
        ...testEmailData.contactSubmission,
        message: 'Line 1\nLine 2\nLine 3',
      };

      await service.sendContactNotification(multilineSubmission);

      const callArgs = mockEmailSend.mock.calls[0][0];
      expect(callArgs.html).toContain('Line 1\nLine 2\nLine 3');
    });
  });
});

describe('emailService singleton', () => {
  it('should export a singleton instance', () => {
    expect(emailService).toBeInstanceOf(EmailService);
  });

  it('should be the same instance on multiple imports', async () => {
    const { emailService: instance1 } = await import(
      '../../../../src/services/email/email.service.js'
    );
    const { emailService: instance2 } = await import(
      '../../../../src/services/email/email.service.js'
    );

    expect(instance1).toBe(instance2);
  });
});

describe('ContactSubmissionData interface', () => {
  let service: InstanceType<typeof EmailService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailSend.mockResolvedValue({
      data: createMockEmailResponse(),
      error: null,
    });
    service = new EmailService();
  });

  it('should accept valid contact submission data', async () => {
    const submission = {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'Test message content',
    };

    await service.sendContactNotification(submission);

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
  });

  it('should handle minimal required fields', async () => {
    const submission = {
      name: '',
      email: '',
      subject: '',
      message: '',
    };

    await service.sendContactNotification(submission);

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
  });

  it('should handle international characters in submission', async () => {
    const internationalSubmission = {
      name: 'Hans Mueller',
      email: 'hans@example.de',
      subject: 'Frage zum API',
      message: 'Guten Tag, ich habe eine Frage.',
    };

    await service.sendContactNotification(internationalSubmission);

    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.html).toContain('Hans Mueller');
    expect(callArgs.html).toContain('Frage zum API');
  });

  it('should handle emoji in submission', async () => {
    const emojiSubmission = {
      name: 'Happy User',
      email: 'happy@example.com',
      subject: 'Great service!',
      message: 'Your service is amazing! Keep up the good work!',
    };

    await service.sendContactNotification(emojiSubmission);

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
  });
});
