import { FastifyReply } from 'fastify';
import { ApiResponse, ErrorCode, HttpStatus } from '../types/api.types';

/**
 * Success Response Helper
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode: HttpStatus = HttpStatus.OK,
  meta?: Record<string, any>
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (reply.request as any).id,
      version: 'v1',
      ...meta,
    },
  };

  reply.code(statusCode).send(response);
}

/**
 * Error Response Helper
 */
export function sendError(
  reply: FastifyReply,
  code: ErrorCode,
  message: string,
  statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  details?: Record<string, any>
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (reply.request as any).id,
      version: 'v1',
    },
  };

  reply.code(statusCode).send(response);
}

/**
 * Not Found Response
 */
export function sendNotFound(
  reply: FastifyReply,
  resource: string,
  id?: string
): void {
  sendError(
    reply,
    ErrorCode.NOT_FOUND,
    id ? `${resource} with ID ${id} not found` : `${resource} not found`,
    HttpStatus.NOT_FOUND
  );
}

/**
 * Validation Error Response
 */
export function sendValidationError(
  reply: FastifyReply,
  errors: Record<string, any>
): void {
  sendError(
    reply,
    ErrorCode.VALIDATION_ERROR,
    'Request validation failed',
    HttpStatus.BAD_REQUEST,
    { errors }
  );
}

/**
 * Rate Limit Error Response
 */
export function sendRateLimitError(
  reply: FastifyReply,
  retryAfter?: number
): void {
  sendError(
    reply,
    ErrorCode.RATE_LIMIT_EXCEEDED,
    'Rate limit exceeded. Please try again later.',
    HttpStatus.TOO_MANY_REQUESTS,
    retryAfter ? { retryAfter } : undefined
  );
}

/**
 * Created Response (201)
 */
export function sendCreated<T>(
  reply: FastifyReply,
  data: T,
  meta?: Record<string, any>
): void {
  sendSuccess(reply, data, HttpStatus.CREATED, meta);
}

/**
 * Accepted Response (202)
 */
export function sendAccepted<T>(
  reply: FastifyReply,
  data: T,
  meta?: Record<string, any>
): void {
  sendSuccess(reply, data, HttpStatus.ACCEPTED, meta);
}

/**
 * No Content Response (204)
 */
export function sendNoContent(reply: FastifyReply): void {
  reply.code(HttpStatus.NO_CONTENT).send();
}
