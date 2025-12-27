import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { ApiResponse, ErrorCode, HttpStatus } from '../types/api.types';

/**
 * Zod Validation Middleware Factory
 * Validates request body, params, or query against a Zod schema
 */
export function validateRequest(
  schema: ZodSchema,
  target: 'body' | 'params' | 'query' = 'body'
) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ) => {
    try {
      const data = request[target];
      const validated = await schema.parseAsync(data);

      // Replace with validated data
      (request as any)[target] = validated;

      done();
    } catch (error) {
      if (error instanceof ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Request validation failed',
            details: {
              errors: error.errors.map((err) => ({
                path: err.path.join('.'),
                message: err.message,
                code: err.code,
              })),
            },
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
            version: 'v1',
          },
        };

        reply.code(HttpStatus.BAD_REQUEST).send(response);
        return;
      }

      // Unexpected error
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Validation error',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };

      reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send(response);
    }
  };
}

/**
 * Safe Validation (returns parsed data or null)
 */
export async function safeValidate<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; error: ZodError }> {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}
