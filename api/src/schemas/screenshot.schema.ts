import { z } from 'zod';
import { strictCookieSchema } from './cookie.schema.js';

// SSRF-safe URL validator - blocks internal/private addresses
const ssrfSafeUrl = z.string().url('Invalid URL format').refine((url) => {
  try {
    const parsed = new URL(url);

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost variants
    if (hostname === 'localhost' || hostname === '::1') {
      return false;
    }

    // Check if IP address
    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
      const [, a, b, c, d] = ipMatch.map(Number);
      // Block private ranges
      if (a === 10) return false; // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
      if (a === 192 && b === 168) return false; // 192.168.0.0/16
      if (a === 127) return false; // 127.0.0.0/8
      if (a === 169 && b === 254) return false; // 169.254.0.0/16 (link-local + metadata)
      if (a === 0) return false; // 0.0.0.0/8
    }

    return true;
  } catch {
    return false;
  }
}, { message: 'URL not allowed: internal or private addresses are blocked' });

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

// Scroll Position Schema - for capturing at specific scroll positions
export const scrollPositionSchema = z.object({
  y: z.number().int().min(0).max(50000).describe('Vertical scroll position in pixels'),
  behavior: z.enum(['instant', 'smooth']).default('instant').describe('Scroll animation behavior'),
});

// Wait Options Schema
export const waitOptionsSchema = z.object({
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).default('load'),
  timeout: z.number().int().min(1000).max(60000).default(30000),
  delay: z.number().int().min(0).max(10000).optional(),
  selector: z.string().optional(),
});

// Screenshot Request Schema (base)
const screenshotRequestBaseSchema = z.object({
  url: ssrfSafeUrl,
  viewport: viewportSchema.optional(),
  fullPage: z.boolean().default(false),
  format: z.enum(['png', 'jpeg', 'webp']).default('png'),
  quality: z.number().int().min(1).max(100).optional(),
  clip: clipSchema.optional(),
  scrollPosition: scrollPositionSchema.optional(),
  omitBackground: z.boolean().default(false),
  encoding: z.enum(['base64', 'binary']).default('binary'),
  waitOptions: waitOptionsSchema.optional(),
  headers: z.record(z.string()).optional(),
  // L-01: Use strict cookie validation to prevent header injection
  cookies: z.array(strictCookieSchema).optional(),
  userAgent: z.string().optional(),
  blockResources: z.array(z.enum(['image', 'stylesheet', 'font', 'script', 'media'])).optional(),
  // Cookie consent auto-acceptance
  acceptCookies: z.boolean().default(true).describe('Automatically accept cookie consent banners'),
  cookieAcceptTimeout: z.number().int().min(0).max(10000).default(2500).describe('Timeout in ms to wait for cookie banner'),
  async: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

// Screenshot Request Schema with validation refinements
export const screenshotRequestSchema = screenshotRequestBaseSchema.refine(
  (data) => {
    // scrollPosition and fullPage are mutually exclusive
    if (data.fullPage && data.scrollPosition) {
      return false;
    }
    return true;
  },
  {
    message: 'Cannot use scrollPosition with fullPage. Use either fullPage for entire page capture, or scrollPosition to capture at a specific scroll level.',
    path: ['scrollPosition'],
  }
);

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
export type ScrollPosition = z.infer<typeof scrollPositionSchema>;
