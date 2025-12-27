import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyReply } from 'fastify';
import { ErrorCode, HttpStatus } from '../../../src/types/api.types.js';
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendValidationError,
  sendRateLimitError,
  sendCreated,
  sendAccepted,
  sendNoContent,
} from '../../../src/utils/response.helper.js';

// Mock reply factory
function createMockReply(requestId = 'test-request-id-12345'): FastifyReply {
  const reply = {
    code: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    sent: false,
    request: {
      id: requestId,
    },
  };
  return reply as unknown as FastifyReply;
}

describe('Response Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('sendSuccess', () => {
    it('should send success response with default status code 200', () => {
      const reply = createMockReply();
      const data = { id: 1, name: 'Test' };

      sendSuccess(reply, data);

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.OK);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: { id: 1, name: 'Test' },
        meta: {
          timestamp: '2025-01-15T10:00:00.000Z',
          requestId: 'test-request-id-12345',
          version: 'v1',
        },
      });
    });

    it('should send success response with custom status code', () => {
      const reply = createMockReply();
      const data = { message: 'Resource created' };

      sendSuccess(reply, data, HttpStatus.CREATED);

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { message: 'Resource created' },
        })
      );
    });

    it('should include additional meta properties when provided', () => {
      const reply = createMockReply();
      const data = { items: [1, 2, 3] };
      const meta = {
        pagination: {
          page: 1,
          limit: 10,
          total: 100,
        },
        processingTime: 42,
      };

      sendSuccess(reply, data, HttpStatus.OK, meta);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: { items: [1, 2, 3] },
        meta: {
          timestamp: '2025-01-15T10:00:00.000Z',
          requestId: 'test-request-id-12345',
          version: 'v1',
          pagination: {
            page: 1,
            limit: 10,
            total: 100,
          },
          processingTime: 42,
        },
      });
    });

    it('should handle null data', () => {
      const reply = createMockReply();

      sendSuccess(reply, null);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: null,
        })
      );
    });

    it('should handle undefined data', () => {
      const reply = createMockReply();

      sendSuccess(reply, undefined);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: undefined,
        })
      );
    });

    it('should handle array data', () => {
      const reply = createMockReply();
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];

      sendSuccess(reply, data);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [{ id: 1 }, { id: 2 }, { id: 3 }],
        })
      );
    });

    it('should handle string data', () => {
      const reply = createMockReply();

      sendSuccess(reply, 'Simple string response');

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: 'Simple string response',
        })
      );
    });

    it('should handle number data', () => {
      const reply = createMockReply();

      sendSuccess(reply, 42);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: 42,
        })
      );
    });

    it('should handle boolean data', () => {
      const reply = createMockReply();

      sendSuccess(reply, true);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: true,
        })
      );
    });

    it('should use provided requestId from reply.request', () => {
      const reply = createMockReply('custom-request-id-abc123');
      const data = { result: 'ok' };

      sendSuccess(reply, data);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            requestId: 'custom-request-id-abc123',
          }),
        })
      );
    });

    it('should override default meta with custom meta', () => {
      const reply = createMockReply();
      const data = {};
      const customMeta = {
        version: 'v2', // Should override default v1
        customField: 'customValue',
      };

      sendSuccess(reply, data, HttpStatus.OK, customMeta);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            version: 'v2',
            customField: 'customValue',
          }),
        })
      );
    });

    it('should handle complex nested data', () => {
      const reply = createMockReply();
      const data = {
        user: {
          id: 1,
          profile: {
            name: 'John',
            settings: {
              theme: 'dark',
              notifications: true,
            },
          },
          tags: ['admin', 'active'],
        },
      };

      sendSuccess(reply, data);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: data,
        })
      );
    });
  });

  describe('sendError', () => {
    it('should send error response with default status code 500', () => {
      const reply = createMockReply();

      sendError(reply, ErrorCode.INTERNAL_SERVER_ERROR, 'Something went wrong');

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Something went wrong',
          details: undefined,
        },
        meta: {
          timestamp: '2025-01-15T10:00:00.000Z',
          requestId: 'test-request-id-12345',
          version: 'v1',
        },
      });
    });

    it('should send error response with custom status code', () => {
      const reply = createMockReply();

      sendError(
        reply,
        ErrorCode.VALIDATION_ERROR,
        'Invalid input',
        HttpStatus.BAD_REQUEST
      );

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid input',
          }),
        })
      );
    });

    it('should include error details when provided', () => {
      const reply = createMockReply();
      const details = {
        field: 'email',
        reason: 'Invalid email format',
        providedValue: 'not-an-email',
      };

      sendError(
        reply,
        ErrorCode.VALIDATION_ERROR,
        'Validation failed',
        HttpStatus.BAD_REQUEST,
        details
      );

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: {
              field: 'email',
              reason: 'Invalid email format',
              providedValue: 'not-an-email',
            },
          }),
        })
      );
    });

    it('should handle all error codes', () => {
      const errorCodes = Object.values(ErrorCode);

      for (const code of errorCodes) {
        const reply = createMockReply();
        sendError(reply, code, `Error with code ${code}`);

        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: code,
            }),
          })
        );
      }
    });

    it('should handle empty message', () => {
      const reply = createMockReply();

      sendError(reply, ErrorCode.INTERNAL_SERVER_ERROR, '');

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: '',
          }),
        })
      );
    });

    it('should handle empty details object', () => {
      const reply = createMockReply();

      sendError(
        reply,
        ErrorCode.VALIDATION_ERROR,
        'Error',
        HttpStatus.BAD_REQUEST,
        {}
      );

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: {},
          }),
        })
      );
    });

    it('should use requestId from reply.request', () => {
      const reply = createMockReply('error-request-id');

      sendError(reply, ErrorCode.NOT_FOUND, 'Not found', HttpStatus.NOT_FOUND);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            requestId: 'error-request-id',
          }),
        })
      );
    });
  });

  describe('sendNotFound', () => {
    it('should send not found error without id', () => {
      const reply = createMockReply();

      sendNotFound(reply, 'User');

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.NOT_FOUND,
            message: 'User not found',
          }),
        })
      );
    });

    it('should send not found error with id', () => {
      const reply = createMockReply();

      sendNotFound(reply, 'User', '123');

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'User with ID 123 not found',
          }),
        })
      );
    });

    it('should send not found error with UUID id', () => {
      const reply = createMockReply();
      const uuid = '550e8400-e29b-41d4-a716-446655440000';

      sendNotFound(reply, 'Screenshot', uuid);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: `Screenshot with ID ${uuid} not found`,
          }),
        })
      );
    });

    it('should handle different resource names', () => {
      const resources = ['Screenshot', 'PDF', 'ApiKey', 'Account', 'Job'];

      for (const resource of resources) {
        const reply = createMockReply();
        sendNotFound(reply, resource);

        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              message: `${resource} not found`,
            }),
          })
        );
      }
    });

    it('should handle empty resource name', () => {
      const reply = createMockReply();

      sendNotFound(reply, '');

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: ' not found',
          }),
        })
      );
    });

    it('should handle empty id', () => {
      const reply = createMockReply();

      sendNotFound(reply, 'User', '');

      // Empty string is falsy, so it should use the "not found" format without ID
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'User not found',
          }),
        })
      );
    });
  });

  describe('sendValidationError', () => {
    it('should send validation error with errors object', () => {
      const reply = createMockReply();
      const errors = {
        email: 'Invalid email format',
        password: 'Password too short',
      };

      sendValidationError(reply, errors);

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Request validation failed',
            details: {
              errors: {
                email: 'Invalid email format',
                password: 'Password too short',
              },
            },
          }),
        })
      );
    });

    it('should handle single error', () => {
      const reply = createMockReply();
      const errors = { url: 'Invalid URL' };

      sendValidationError(reply, errors);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: { errors: { url: 'Invalid URL' } },
          }),
        })
      );
    });

    it('should handle empty errors object', () => {
      const reply = createMockReply();

      sendValidationError(reply, {});

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: { errors: {} },
          }),
        })
      );
    });

    it('should handle nested error objects', () => {
      const reply = createMockReply();
      const errors = {
        user: {
          profile: {
            name: 'Name is required',
          },
        },
      };

      sendValidationError(reply, errors);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: { errors: errors },
          }),
        })
      );
    });

    it('should handle array of error messages', () => {
      const reply = createMockReply();
      const errors = {
        items: ['Item 1 invalid', 'Item 2 invalid'],
      };

      sendValidationError(reply, errors);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: { errors: errors },
          }),
        })
      );
    });
  });

  describe('sendRateLimitError', () => {
    it('should send rate limit error without retryAfter', () => {
      const reply = createMockReply();

      sendRateLimitError(reply);

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'Rate limit exceeded. Please try again later.',
            details: undefined,
          }),
        })
      );
    });

    it('should send rate limit error with retryAfter', () => {
      const reply = createMockReply();

      sendRateLimitError(reply, 60);

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: { retryAfter: 60 },
          }),
        })
      );
    });

    it('should handle retryAfter of 0', () => {
      const reply = createMockReply();

      sendRateLimitError(reply, 0);

      // 0 is falsy, so details should be undefined
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: undefined,
          }),
        })
      );
    });

    it('should handle large retryAfter value', () => {
      const reply = createMockReply();

      sendRateLimitError(reply, 3600);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: { retryAfter: 3600 },
          }),
        })
      );
    });
  });

  describe('sendCreated', () => {
    it('should send 201 Created response', () => {
      const reply = createMockReply();
      const data = { id: 'new-id', name: 'New Resource' };

      sendCreated(reply, data);

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { id: 'new-id', name: 'New Resource' },
        })
      );
    });

    it('should include meta when provided', () => {
      const reply = createMockReply();
      const data = { id: 'created-id' };
      const meta = { location: '/resources/created-id' };

      sendCreated(reply, data, meta);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            location: '/resources/created-id',
          }),
        })
      );
    });

    it('should handle complex created resource', () => {
      const reply = createMockReply();
      const data = {
        id: 'screenshot-123',
        url: 'https://example.com',
        status: 'pending',
        createdAt: '2025-01-15T10:00:00.000Z',
      };

      sendCreated(reply, data);

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: data,
        })
      );
    });
  });

  describe('sendAccepted', () => {
    it('should send 202 Accepted response', () => {
      const reply = createMockReply();
      const data = { jobId: 'job-123', status: 'processing' };

      sendAccepted(reply, data);

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { jobId: 'job-123', status: 'processing' },
        })
      );
    });

    it('should include meta when provided', () => {
      const reply = createMockReply();
      const data = { jobId: 'job-456' };
      const meta = { estimatedCompletion: 30 };

      sendAccepted(reply, data, meta);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            estimatedCompletion: 30,
          }),
        })
      );
    });

    it('should handle async job response', () => {
      const reply = createMockReply();
      const data = {
        jobId: 'screenshot-job-789',
        type: 'screenshot',
        status: 'queued',
        position: 3,
      };

      sendAccepted(reply, data);

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: data,
        })
      );
    });
  });

  describe('sendNoContent', () => {
    it('should send 204 No Content response', () => {
      const reply = createMockReply();

      sendNoContent(reply);

      expect(reply.code).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
      expect(reply.send).toHaveBeenCalledWith();
    });

    it('should not include body in response', () => {
      const reply = createMockReply();

      sendNoContent(reply);

      expect(reply.send).toHaveBeenCalledWith();
      expect(reply.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('timestamp handling', () => {
    it('should include current timestamp in success response', () => {
      const reply = createMockReply();

      sendSuccess(reply, {});

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            timestamp: '2025-01-15T10:00:00.000Z',
          }),
        })
      );
    });

    it('should include current timestamp in error response', () => {
      const reply = createMockReply();

      sendError(reply, ErrorCode.INTERNAL_SERVER_ERROR, 'Error');

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            timestamp: '2025-01-15T10:00:00.000Z',
          }),
        })
      );
    });

    it('should update timestamp when time changes', () => {
      const reply1 = createMockReply();
      sendSuccess(reply1, {});

      // Advance time by 1 hour
      vi.setSystemTime(new Date('2025-01-15T11:00:00.000Z'));

      const reply2 = createMockReply();
      sendSuccess(reply2, {});

      expect(reply1.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            timestamp: '2025-01-15T10:00:00.000Z',
          }),
        })
      );

      expect(reply2.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            timestamp: '2025-01-15T11:00:00.000Z',
          }),
        })
      );
    });
  });

  describe('version consistency', () => {
    it('should always include version v1 in success response', () => {
      const reply = createMockReply();

      sendSuccess(reply, {});

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            version: 'v1',
          }),
        })
      );
    });

    it('should always include version v1 in error response', () => {
      const reply = createMockReply();

      sendError(reply, ErrorCode.INTERNAL_SERVER_ERROR, 'Error');

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            version: 'v1',
          }),
        })
      );
    });
  });

  describe('type safety', () => {
    it('should maintain type safety for generic data', () => {
      interface UserData {
        id: number;
        name: string;
        email: string;
      }

      const reply = createMockReply();
      const userData: UserData = {
        id: 1,
        name: 'John',
        email: 'john@example.com',
      };

      // This should compile without errors
      sendSuccess<UserData>(reply, userData);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: userData,
        })
      );
    });

    it('should handle generic array types', () => {
      interface Item {
        id: number;
        value: string;
      }

      const reply = createMockReply();
      const items: Item[] = [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' },
      ];

      sendSuccess<Item[]>(reply, items);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: items,
        })
      );
    });
  });
});
