/**
 * Cookie Validation Schema
 * L-01: Strict cookie validation to prevent header injection attacks
 *
 * RFC 6265 compliant cookie name/value validation to prevent:
 * - Header injection attacks via newlines
 * - Cookie smuggling via invalid characters
 */

import { z } from 'zod';

// RFC 6265 cookie-name: token (no CTLs, separators, or whitespace)
// Valid characters: alphanumeric and !#$%&'*+-.^_`|~
const COOKIE_NAME_REGEX = /^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/;

// Cookie values must not contain control characters or semicolons
// No newlines, carriage returns, or null bytes
const COOKIE_VALUE_REGEX = /^[^\x00-\x1F\x7F;]*$/;

// Path must not contain control characters
const COOKIE_PATH_REGEX = /^[^\x00-\x1F\x7F]*$/;

export const strictCookieNameSchema = z.string()
  .min(1, 'Cookie name cannot be empty')
  .max(256, 'Cookie name too long')
  .regex(COOKIE_NAME_REGEX, 'Invalid cookie name: must contain only valid token characters');

export const strictCookieValueSchema = z.string()
  .max(4096, 'Cookie value too long')
  .regex(COOKIE_VALUE_REGEX, 'Invalid cookie value: cannot contain control characters or semicolons');

/**
 * Strict cookie schema with validated name/value
 * Prevents header injection and cookie smuggling attacks
 */
export const strictCookieSchema = z.object({
  name: strictCookieNameSchema,
  value: strictCookieValueSchema,
  domain: z.string().max(253).optional(),
  path: z.string()
    .max(1024)
    .regex(COOKIE_PATH_REGEX, 'Invalid path: cannot contain control characters')
    .optional(),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
});

export type StrictCookie = z.infer<typeof strictCookieSchema>;
