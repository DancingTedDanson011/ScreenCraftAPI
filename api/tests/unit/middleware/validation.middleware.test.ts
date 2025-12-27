import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z, ZodError } from 'zod';
import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { ErrorCode, HttpStatus } from '../../../src/types/api.types.js';

// Import the middleware after mocking
const { validateRequest, safeValidate } = await import(
  '../../../src/middleware/validation.middleware.js'
);

// Mock request factory
function createMockRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    id: 'test-request-id-12345',
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  } as unknown as FastifyRequest;
}

// Mock reply factory
function createMockReply(): FastifyReply {
  const reply = {
    code: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    sent: false,
  };
  return reply as unknown as FastifyReply;
}

// Mock done callback factory
function createMockDone(): HookHandlerDoneFunction {
  return vi.fn() as unknown as HookHandlerDoneFunction;
}

describe('Validation Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('validateRequest', () => {
    describe('body validation', () => {
      const bodySchema = z.object({
        url: z.string().url(),
        format: z.enum(['png', 'jpeg', 'webp']),
        width: z.number().int().min(100).max(4000).optional(),
        height: z.number().int().min(100).max(4000).optional(),
      });

      it('should validate valid request body and call done()', async () => {
        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'png',
            width: 1920,
            height: 1080,
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).toHaveBeenCalled();
        expect(reply.code).not.toHaveBeenCalled();
        expect(reply.send).not.toHaveBeenCalled();
        expect((request as any).body).toEqual({
          url: 'https://example.com',
          format: 'png',
          width: 1920,
          height: 1080,
        });
      });

      it('should validate minimal valid request body', async () => {
        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'jpeg',
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).toHaveBeenCalled();
        expect((request as any).body.url).toBe('https://example.com');
        expect((request as any).body.format).toBe('jpeg');
      });

      it('should reject invalid URL and return 400 error', async () => {
        const request = createMockRequest({
          body: {
            url: 'not-a-valid-url',
            format: 'png',
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: ErrorCode.VALIDATION_ERROR,
              message: 'Request validation failed',
              details: expect.objectContaining({
                errors: expect.arrayContaining([
                  expect.objectContaining({
                    path: 'url',
                    message: expect.stringContaining('Invalid'),
                  }),
                ]),
              }),
            }),
            meta: expect.objectContaining({
              timestamp: '2025-01-15T10:00:00.000Z',
              requestId: 'test-request-id-12345',
              version: 'v1',
            }),
          })
        );
      });

      it('should reject invalid format enum value', async () => {
        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'gif', // Invalid enum
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: ErrorCode.VALIDATION_ERROR,
              details: expect.objectContaining({
                errors: expect.arrayContaining([
                  expect.objectContaining({
                    path: 'format',
                  }),
                ]),
              }),
            }),
          })
        );
      });

      it('should reject width below minimum', async () => {
        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'png',
            width: 50, // Below minimum 100
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              details: expect.objectContaining({
                errors: expect.arrayContaining([
                  expect.objectContaining({
                    path: 'width',
                    message: expect.stringContaining('100'),
                  }),
                ]),
              }),
            }),
          })
        );
      });

      it('should reject width above maximum', async () => {
        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'png',
            width: 5000, // Above maximum 4000
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });

      it('should reject non-integer width', async () => {
        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            format: 'png',
            width: 1920.5, // Non-integer
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });

      it('should collect multiple validation errors', async () => {
        const request = createMockRequest({
          body: {
            url: 'invalid-url',
            format: 'invalid-format',
            width: 50,
            height: 5000,
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.send).toHaveBeenCalled();

        const sentResponse = (reply.send as any).mock.calls[0][0];
        expect(sentResponse.error.details.errors.length).toBeGreaterThanOrEqual(2);
      });

      it('should reject missing required fields', async () => {
        const request = createMockRequest({
          body: {
            // Missing url and format
            width: 1920,
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });

      it('should reject empty body', async () => {
        const request = createMockRequest({
          body: {},
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });

      it('should reject null body', async () => {
        const request = createMockRequest({
          body: null,
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });

      it('should reject undefined body', async () => {
        const request = createMockRequest({
          body: undefined,
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(bodySchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });

      it('should replace request body with validated data', async () => {
        const schemaWithDefaults = z.object({
          name: z.string().default('default-name'),
          count: z.number().default(0),
        });

        const request = createMockRequest({
          body: {},
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(schemaWithDefaults, 'body');
        await middleware(request, reply, done);

        expect(done).toHaveBeenCalled();
        expect((request as any).body).toEqual({
          name: 'default-name',
          count: 0,
        });
      });

      it('should strip unknown fields when schema uses strict', async () => {
        const strictSchema = z
          .object({
            url: z.string().url(),
          })
          .strict();

        const request = createMockRequest({
          body: {
            url: 'https://example.com',
            extra: 'should-be-rejected',
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(strictSchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });
    });

    describe('params validation', () => {
      const paramsSchema = z.object({
        id: z.string().uuid(),
      });

      it('should validate valid UUID params', async () => {
        const request = createMockRequest({
          params: {
            id: '550e8400-e29b-41d4-a716-446655440000',
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(paramsSchema, 'params');
        await middleware(request, reply, done);

        expect(done).toHaveBeenCalled();
        expect(reply.code).not.toHaveBeenCalled();
      });

      it('should reject invalid UUID params', async () => {
        const request = createMockRequest({
          params: {
            id: 'not-a-uuid',
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(paramsSchema, 'params');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: ErrorCode.VALIDATION_ERROR,
              details: expect.objectContaining({
                errors: expect.arrayContaining([
                  expect.objectContaining({
                    path: 'id',
                    message: expect.stringContaining('uuid'),
                  }),
                ]),
              }),
            }),
          })
        );
      });

      it('should reject empty params', async () => {
        const request = createMockRequest({
          params: {},
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(paramsSchema, 'params');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });
    });

    describe('query validation', () => {
      const querySchema = z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        sort: z.enum(['asc', 'desc']).default('desc'),
        search: z.string().optional(),
      });

      it('should validate and coerce valid query params', async () => {
        const request = createMockRequest({
          query: {
            page: '5',
            limit: '50',
            sort: 'asc',
            search: 'test-search',
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(querySchema, 'query');
        await middleware(request, reply, done);

        expect(done).toHaveBeenCalled();
        expect((request as any).query).toEqual({
          page: 5,
          limit: 50,
          sort: 'asc',
          search: 'test-search',
        });
      });

      it('should apply defaults for missing optional query params', async () => {
        const request = createMockRequest({
          query: {},
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(querySchema, 'query');
        await middleware(request, reply, done);

        expect(done).toHaveBeenCalled();
        expect((request as any).query).toEqual({
          page: 1,
          limit: 20,
          sort: 'desc',
        });
      });

      it('should reject page below minimum', async () => {
        const request = createMockRequest({
          query: {
            page: '0',
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(querySchema, 'query');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });

      it('should reject limit above maximum', async () => {
        const request = createMockRequest({
          query: {
            limit: '200',
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(querySchema, 'query');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });

      it('should reject invalid sort value', async () => {
        const request = createMockRequest({
          query: {
            sort: 'invalid',
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(querySchema, 'query');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });

      it('should reject non-numeric page', async () => {
        const request = createMockRequest({
          query: {
            page: 'abc',
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(querySchema, 'query');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      });
    });

    describe('default target', () => {
      it('should default to body validation when target not specified', async () => {
        const schema = z.object({
          name: z.string(),
        });

        const request = createMockRequest({
          body: {
            name: 'test-name',
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(schema);
        await middleware(request, reply, done);

        expect(done).toHaveBeenCalled();
        expect((request as any).body).toEqual({
          name: 'test-name',
        });
      });
    });

    describe('error handling', () => {
      it('should handle non-Zod errors with 500 status', async () => {
        // Create a schema that throws a non-Zod error
        const errorSchema = z.object({
          value: z.string(),
        });

        // Mock parseAsync to throw a non-Zod error
        const originalParseAsync = errorSchema.parseAsync;
        errorSchema.parseAsync = vi.fn().mockRejectedValue(new Error('Unexpected error'));

        const request = createMockRequest({
          body: { value: 'test' },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(errorSchema, 'body');
        await middleware(request, reply, done);

        expect(done).not.toHaveBeenCalled();
        expect(reply.code).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(reply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: ErrorCode.INTERNAL_SERVER_ERROR,
              message: 'Validation error',
            }),
            meta: expect.objectContaining({
              timestamp: expect.any(String),
              requestId: 'test-request-id-12345',
              version: 'v1',
            }),
          })
        );

        // Restore
        errorSchema.parseAsync = originalParseAsync;
      });

      it('should include proper error codes in ZodError details', async () => {
        const schema = z.object({
          email: z.string().email(),
          age: z.number().int().positive(),
        });

        const request = createMockRequest({
          body: {
            email: 'not-an-email',
            age: -5,
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(schema, 'body');
        await middleware(request, reply, done);

        expect(reply.send).toHaveBeenCalled();
        const response = (reply.send as any).mock.calls[0][0];

        expect(response.error.details.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'email',
              code: expect.any(String),
            }),
            expect.objectContaining({
              path: 'age',
              code: expect.any(String),
            }),
          ])
        );
      });

      it('should handle nested object validation errors with proper path', async () => {
        const nestedSchema = z.object({
          user: z.object({
            profile: z.object({
              name: z.string().min(1),
            }),
          }),
        });

        const request = createMockRequest({
          body: {
            user: {
              profile: {
                name: '',
              },
            },
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(nestedSchema, 'body');
        await middleware(request, reply, done);

        expect(reply.send).toHaveBeenCalled();
        const response = (reply.send as any).mock.calls[0][0];

        expect(response.error.details.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'user.profile.name',
            }),
          ])
        );
      });

      it('should handle array validation errors with proper path', async () => {
        const arraySchema = z.object({
          items: z.array(z.string().min(1)),
        });

        const request = createMockRequest({
          body: {
            items: ['valid', '', 'also-valid'],
          },
        });
        const reply = createMockReply();
        const done = createMockDone();

        const middleware = validateRequest(arraySchema, 'body');
        await middleware(request, reply, done);

        expect(reply.send).toHaveBeenCalled();
        const response = (reply.send as any).mock.calls[0][0];

        expect(response.error.details.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'items.1',
            }),
          ])
        );
      });
    });
  });

  describe('safeValidate', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
    });

    it('should return success with validated data for valid input', async () => {
      const data = { name: 'John', age: 30 };

      const result = await safeValidate(testSchema, data);

      expect(result).toEqual({
        success: true,
        data: { name: 'John', age: 30 },
      });
    });

    it('should return failure with ZodError for invalid input', async () => {
      const data = { name: '', age: -5 };

      const result = await safeValidate(testSchema, data);

      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(ZodError);
    });

    it('should return failure for missing required fields', async () => {
      const data = { name: 'John' }; // Missing age

      const result = await safeValidate(testSchema, data);

      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(ZodError);
    });

    it('should return failure for wrong type', async () => {
      const data = { name: 'John', age: 'thirty' };

      const result = await safeValidate(testSchema, data);

      expect(result.success).toBe(false);
    });

    it('should return success with defaults applied', async () => {
      const schemaWithDefaults = z.object({
        name: z.string().default('Anonymous'),
        active: z.boolean().default(true),
      });

      const data = {};

      const result = await safeValidate(schemaWithDefaults, data);

      expect(result).toEqual({
        success: true,
        data: { name: 'Anonymous', active: true },
      });
    });

    it('should return success with transformed data', async () => {
      const schemaWithTransform = z.object({
        email: z.string().toLowerCase(),
        tags: z.string().transform((s) => s.split(',')),
      });

      const data = { email: 'TEST@EXAMPLE.COM', tags: 'a,b,c' };

      const result = await safeValidate(schemaWithTransform, data);

      expect(result).toEqual({
        success: true,
        data: { email: 'test@example.com', tags: ['a', 'b', 'c'] },
      });
    });

    it('should throw non-ZodError exceptions', async () => {
      const errorSchema = z.object({
        value: z.string(),
      });

      // Mock parseAsync to throw a non-Zod error
      const originalParseAsync = errorSchema.parseAsync;
      errorSchema.parseAsync = vi.fn().mockRejectedValue(new TypeError('Type error'));

      await expect(safeValidate(errorSchema, { value: 'test' })).rejects.toThrow(TypeError);

      // Restore
      errorSchema.parseAsync = originalParseAsync;
    });

    it('should work with complex nested schemas', async () => {
      const complexSchema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
        settings: z
          .object({
            notifications: z.boolean(),
          })
          .optional(),
        tags: z.array(z.string()).min(1),
      });

      const validData = {
        user: { name: 'John', email: 'john@example.com' },
        tags: ['tag1'],
      };

      const result = await safeValidate(complexSchema, validData);

      expect(result.success).toBe(true);
      expect((result as any).data).toEqual(validData);
    });

    it('should return specific error messages in ZodError', async () => {
      const data = { name: '', age: 0 };

      const result = await safeValidate(testSchema, data);

      expect(result.success).toBe(false);
      const zodError = (result as any).error as ZodError;
      expect(zodError.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle null input', async () => {
      const result = await safeValidate(testSchema, null);

      expect(result.success).toBe(false);
    });

    it('should handle undefined input', async () => {
      const result = await safeValidate(testSchema, undefined);

      expect(result.success).toBe(false);
    });

    it('should handle array input when object expected', async () => {
      const result = await safeValidate(testSchema, ['not', 'an', 'object']);

      expect(result.success).toBe(false);
    });

    it('should handle primitive input when object expected', async () => {
      const result = await safeValidate(testSchema, 'string-instead-of-object');

      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle async validation in schema', async () => {
      const asyncSchema = z.object({
        value: z.string().refine(async (val) => {
          // Simulate async validation
          await new Promise((resolve) => setTimeout(resolve, 10));
          return val.length > 0;
        }, 'Value must not be empty'),
      });

      const request = createMockRequest({
        body: { value: 'valid' },
      });
      const reply = createMockReply();
      const done = createMockDone();

      vi.useRealTimers(); // Need real timers for async refinement

      const middleware = validateRequest(asyncSchema, 'body');
      await middleware(request, reply, done);

      expect(done).toHaveBeenCalled();
    });

    it('should handle schema with custom error messages', async () => {
      const customMessageSchema = z.object({
        password: z
          .string()
          .min(8, 'Password must be at least 8 characters')
          .regex(/[A-Z]/, 'Password must contain uppercase letter'),
      });

      const request = createMockRequest({
        body: { password: 'short' },
      });
      const reply = createMockReply();
      const done = createMockDone();

      const middleware = validateRequest(customMessageSchema, 'body');
      await middleware(request, reply, done);

      expect(reply.send).toHaveBeenCalled();
      const response = (reply.send as any).mock.calls[0][0];

      expect(response.error.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Password must be at least 8 characters',
          }),
        ])
      );
    });

    it('should handle union types', async () => {
      const unionSchema = z.object({
        value: z.union([z.string(), z.number()]),
      });

      const request = createMockRequest({
        body: { value: true }, // Boolean is not in union
      });
      const reply = createMockReply();
      const done = createMockDone();

      const middleware = validateRequest(unionSchema, 'body');
      await middleware(request, reply, done);

      expect(done).not.toHaveBeenCalled();
      expect(reply.code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('should handle discriminated unions', async () => {
      const discriminatedSchema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('text'), content: z.string() }),
        z.object({ type: z.literal('image'), url: z.string().url() }),
      ]);

      const validRequest = createMockRequest({
        body: { type: 'text', content: 'Hello' },
      });
      const reply = createMockReply();
      const done = createMockDone();

      const middleware = validateRequest(discriminatedSchema, 'body');
      await middleware(validRequest, reply, done);

      expect(done).toHaveBeenCalled();
    });

    it('should handle very large objects', async () => {
      const largeSchema = z.object({
        items: z.array(z.string()).max(1000),
      });

      const request = createMockRequest({
        body: {
          items: Array(500).fill('item'),
        },
      });
      const reply = createMockReply();
      const done = createMockDone();

      const middleware = validateRequest(largeSchema, 'body');
      await middleware(request, reply, done);

      expect(done).toHaveBeenCalled();
    });

    it('should handle special characters in string validation', async () => {
      const specialCharSchema = z.object({
        name: z.string(),
      });

      const request = createMockRequest({
        body: {
          name: '<script>alert("xss")</script>',
        },
      });
      const reply = createMockReply();
      const done = createMockDone();

      const middleware = validateRequest(specialCharSchema, 'body');
      await middleware(request, reply, done);

      // Zod doesn't sanitize by default, just validates
      expect(done).toHaveBeenCalled();
      expect((request as any).body.name).toBe('<script>alert("xss")</script>');
    });
  });
});
