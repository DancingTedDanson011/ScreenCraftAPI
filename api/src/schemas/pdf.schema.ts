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

// PDF Margin Schema
export const pdfMarginSchema = z.object({
  top: z.string().regex(/^\d+(px|in|cm|mm)$/).optional(),
  right: z.string().regex(/^\d+(px|in|cm|mm)$/).optional(),
  bottom: z.string().regex(/^\d+(px|in|cm|mm)$/).optional(),
  left: z.string().regex(/^\d+(px|in|cm|mm)$/).optional(),
});

// PDF Format Schema
export const pdfFormatSchema = z.enum([
  'Letter', 'Legal', 'Tabloid', 'Ledger',
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'
]);

// Header/Footer Template Schema
export const templateSchema = z.object({
  header: z.string().optional(),
  footer: z.string().optional(),
});

// PDF Request from URL
export const pdfFromUrlRequestSchema = z.object({
  url: ssrfSafeUrl,
  format: pdfFormatSchema.default('A4'),
  landscape: z.boolean().default(false),
  printBackground: z.boolean().default(true),
  margin: pdfMarginSchema.optional(),
  displayHeaderFooter: z.boolean().default(false),
  headerTemplate: z.string().optional(),
  footerTemplate: z.string().optional(),
  pageRanges: z.string().optional(),
  preferCSSPageSize: z.boolean().default(false),
  width: z.string().regex(/^\d+(px|in|cm|mm)$/).optional(),
  height: z.string().regex(/^\d+(px|in|cm|mm)$/).optional(),
  scale: z.number().min(0.1).max(2).default(1),
  waitOptions: z.object({
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).default('load'),
    timeout: z.number().int().min(1000).max(60000).default(30000),
    delay: z.number().int().min(0).max(10000).optional(),
  }).optional(),
  headers: z.record(z.string()).optional(),
  // L-01: Use strict cookie validation to prevent header injection
  cookies: z.array(strictCookieSchema).optional(),
  userAgent: z.string().optional(),
  async: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

// PDF Request from HTML
export const pdfFromHtmlRequestSchema = z.object({
  html: z.string().min(1, 'HTML content cannot be empty'),
  format: pdfFormatSchema.default('A4'),
  landscape: z.boolean().default(false),
  printBackground: z.boolean().default(true),
  margin: pdfMarginSchema.optional(),
  displayHeaderFooter: z.boolean().default(false),
  headerTemplate: z.string().optional(),
  footerTemplate: z.string().optional(),
  pageRanges: z.string().optional(),
  preferCSSPageSize: z.boolean().default(false),
  width: z.string().regex(/^\d+(px|in|cm|mm)$/).optional(),
  height: z.string().regex(/^\d+(px|in|cm|mm)$/).optional(),
  scale: z.number().min(0.1).max(2).default(1),
  async: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

// Combined PDF Request Schema (union of URL and HTML)
export const pdfRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('url'),
  }).merge(pdfFromUrlRequestSchema.omit({ async: true, webhookUrl: true, metadata: true })),
  z.object({
    type: z.literal('html'),
  }).merge(pdfFromHtmlRequestSchema.omit({ async: true, webhookUrl: true, metadata: true })),
]).and(z.object({
  async: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
}));

// PDF Response Schema
export const pdfResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  type: z.enum(['url', 'html']),
  format: pdfFormatSchema,
  fileSize: z.number().int().optional(),
  pages: z.number().int().optional(),
  downloadUrl: z.string().url().optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  completedAt: z.date().optional(),
});

// Get PDF Schema
export const getPdfParamsSchema = z.object({
  id: z.string().uuid('Invalid PDF ID'),
});

// List PDFs Query Schema
export const listPdfsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  type: z.enum(['url', 'html']).optional(),
  sortBy: z.enum(['createdAt', 'completedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Type Exports
export type PdfFromUrlRequest = z.infer<typeof pdfFromUrlRequestSchema>;
export type PdfFromHtmlRequest = z.infer<typeof pdfFromHtmlRequestSchema>;
export type PdfRequest = z.infer<typeof pdfRequestSchema>;
export type PdfResponse = z.infer<typeof pdfResponseSchema>;
export type GetPdfParams = z.infer<typeof getPdfParamsSchema>;
export type ListPdfsQuery = z.infer<typeof listPdfsQuerySchema>;
export type PdfMargin = z.infer<typeof pdfMarginSchema>;
export type PdfFormat = z.infer<typeof pdfFormatSchema>;
