import { z } from 'zod';
import { strictCookieSchema } from './cookie.schema.js';

// Viewport Schema
export const viewportSchema = z.object({
  width: z.number().int().min(320).max(3840).default(1920),
  height: z.number().int().min(240).max(2160).default(1080),
  deviceScaleFactor: z.number().min(1).max(3).optional(),
  isMobile: z.boolean().optional(),
  hasTouch: z.boolean().optional(),
  isLandscape: z.boolean().optional(),
});

// Clip/Crop Schema
export const clipSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

// Wait Options Schema
export const waitOptionsSchema = z.object({
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).default('load'),
  timeout: z.number().int().min(1000).max(60000).default(30000),
  delay: z.number().int().min(0).max(10000).optional(),
  selector: z.string().optional(),
});

// Screenshot Request Schema
export const screenshotRequestSchema = z.object({
  url: z.string().url('Invalid URL format'),
  viewport: viewportSchema.optional(),
  fullPage: z.boolean().default(false),
  format: z.enum(['png', 'jpeg', 'webp']).default('png'),
  quality: z.number().int().min(1).max(100).optional(),
  clip: clipSchema.optional(),
  omitBackground: z.boolean().default(false),
  encoding: z.enum(['base64', 'binary']).default('binary'),
  waitOptions: waitOptionsSchema.optional(),
  headers: z.record(z.string()).optional(),
  // L-01: Use strict cookie validation to prevent header injection
  cookies: z.array(strictCookieSchema).optional(),
  userAgent: z.string().optional(),
  blockResources: z.array(z.enum(['image', 'stylesheet', 'font', 'script', 'media'])).optional(),
  async: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

// Screenshot Response Schema
export const screenshotResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  url: z.string().url(),
  format: z.enum(['png', 'jpeg', 'webp']),
  fileSize: z.number().int().optional(),
  downloadUrl: z.string().url().optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  completedAt: z.date().optional(),
});

// Get Screenshot Schema
export const getScreenshotParamsSchema = z.object({
  id: z.string().uuid('Invalid screenshot ID'),
});

// List Screenshots Query Schema
export const listScreenshotsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  sortBy: z.enum(['createdAt', 'completedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Type Exports
export type ScreenshotRequest = z.infer<typeof screenshotRequestSchema>;
export type ScreenshotResponse = z.infer<typeof screenshotResponseSchema>;
export type GetScreenshotParams = z.infer<typeof getScreenshotParamsSchema>;
export type ListScreenshotsQuery = z.infer<typeof listScreenshotsQuerySchema>;
export type Viewport = z.infer<typeof viewportSchema>;
export type Clip = z.infer<typeof clipSchema>;
export type WaitOptions = z.infer<typeof waitOptionsSchema>;
