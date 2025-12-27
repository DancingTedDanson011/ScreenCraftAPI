import { vi } from 'vitest';

/**
 * Mock Resend email response
 */
export interface MockEmailResponse {
  id: string;
  from: string;
  to: string[];
  created_at: string;
}

/**
 * Create a mock email send response
 */
export function createMockEmailResponse(overrides: Partial<MockEmailResponse> = {}): MockEmailResponse {
  return {
    id: `email_${Math.random().toString(36).substring(2, 15)}`,
    from: 'ScreenCraft <noreply@screencraft.dev>',
    to: ['test@example.com'],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock Resend email send function
 */
export function createMockEmailSend() {
  return vi.fn().mockResolvedValue({
    data: createMockEmailResponse(),
    error: null,
  });
}

/**
 * Create a mock Resend client
 */
export function createMockResendClient(sendFn = createMockEmailSend()) {
  return {
    emails: {
      send: sendFn,
    },
    apiKeys: {
      create: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    },
    domains: {
      create: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      verify: vi.fn(),
    },
    contacts: {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    audiences: {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    },
    batch: {
      send: vi.fn(),
    },
  };
}

/**
 * Create mock Resend error
 */
export function createMockResendError(
  message = 'Failed to send email',
  name = 'validation_error',
  statusCode = 422
) {
  const error = new Error(message);
  (error as any).name = name;
  (error as any).statusCode = statusCode;
  return error;
}

/**
 * Mock Resend API errors
 */
export const MockResendErrors = {
  invalidApiKey: () => createMockResendError('Invalid API Key', 'invalid_api_key', 401),
  missingFrom: () => createMockResendError('Missing required field: from', 'validation_error', 422),
  missingTo: () => createMockResendError('Missing required field: to', 'validation_error', 422),
  invalidEmail: () => createMockResendError('Invalid email address', 'validation_error', 422),
  rateLimitExceeded: () => createMockResendError('Rate limit exceeded', 'rate_limit_exceeded', 429),
  serverError: () => createMockResendError('Internal server error', 'internal_server_error', 500),
  networkError: () => {
    const error = new Error('Network error: Unable to reach Resend API');
    (error as any).code = 'ENOTFOUND';
    return error;
  },
  timeout: () => {
    const error = new Error('Request timeout');
    (error as any).code = 'ETIMEDOUT';
    return error;
  },
};

/**
 * Create test email data
 */
export const testEmailData = {
  validRecipient: 'user@example.com',
  validName: 'Test User',
  validSubject: 'Test Subject',
  validMessage: 'This is a test message.',
  confirmUrl: 'https://screencraft.dev/confirm?token=abc123',
  unsubscribeUrl: 'https://screencraft.dev/unsubscribe?token=xyz789',
  contactSubmission: {
    name: 'John Doe',
    email: 'john@example.com',
    subject: 'API Question',
    message: 'I have a question about your API pricing.',
  },
  xssAttemptName: '<script>alert("xss")</script>',
  xssAttemptMessage: '<img src="x" onerror="alert(1)">',
  specialCharName: "O'Brien & Sons",
  unicodeName: 'Muller Hans',
  longMessage: 'A'.repeat(10000),
};
