import { prisma } from '../../lib/db';
import type { Pdf, PdfStatus, PdfType, Prisma } from '@prisma/client';
import crypto from 'crypto';

// ============================================
// PRIVACY CONFIGURATION
// ============================================

/**
 * Default retention period for PDF files (24 hours)
 * After this period, files should be cleaned up from storage
 */
const DEFAULT_RETENTION_HOURS = 24;

// ============================================
// PRIVACY HELPER FUNCTIONS
// ============================================

/**
 * Hash a URL for privacy-safe analytics
 * Allows deduplication without storing the actual URL
 */
function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex');
}

/**
 * Extract just the domain from a URL for usage statistics
 * This is privacy-safe as it doesn't expose the full path or query params
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Calculate expiration date based on retention hours
 */
function calculateExpiresAt(retentionHours: number = DEFAULT_RETENTION_HOURS): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + retentionHours);
  return expiresAt;
}

// ============================================
// DATA INTERFACES
// ============================================

/**
 * Data required to create a PDF job
 *
 * PRIVACY NOTE: The following fields are intentionally EXCLUDED and never stored:
 * - headers: May contain Authorization tokens, API keys, or session identifiers
 * - cookies: Contains session data, auth tokens, and tracking identifiers
 * - html: May contain invoices, reports, personal data, or other sensitive content
 *
 * These values are passed through for PDF generation but immediately discarded.
 */
export interface CreatePdfData {
  accountId: string;
  type: 'URL' | 'HTML';
  url?: string;
  // REMOVED: html - Privacy: Never stored, passed through only (may contain PII, invoices, reports)
  format: 'LETTER' | 'LEGAL' | 'TABLOID' | 'LEDGER' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
  landscape?: boolean;
  printBackground?: boolean;
  margin?: Prisma.InputJsonValue;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  pageRanges?: string;
  preferCSSPageSize?: boolean;
  width?: string;
  height?: string;
  scale?: number;
  waitOptions?: Prisma.InputJsonValue;
  // REMOVED: headers - Privacy: Never stored (may contain auth tokens)
  // REMOVED: cookies - Privacy: Never stored (sensitive session data)
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
  webhookUrl?: string;
  // Privacy options
  noStore?: boolean; // If true, don't create a database record at all
  retentionHours?: number; // Custom retention period (default: 24 hours)
}

export interface UpdatePdfStatusData {
  status: PdfStatus;
  downloadUrl?: string;
  storageKey?: string;
  fileSize?: number;
  pages?: number;
  error?: string;
  completedAt?: Date;
}

export interface PdfPaginationOptions {
  page: number;
  limit: number;
  status?: PdfStatus;
  type?: PdfType;
  sortBy?: 'createdAt' | 'completedAt';
  sortOrder?: 'asc' | 'desc';
}

export class PdfRepository {
  /**
   * Create a new PDF job
   *
   * PRIVACY: This method intentionally does NOT store:
   * - html: Passed through for generation only, never persisted
   * - headers: May contain auth tokens, never persisted
   * - cookies: Session data, never persisted
   *
   * For URL-based PDFs, we store only:
   * - urlHash: SHA256 hash for deduplication analytics
   * - urlDomain: Just the hostname for usage stats
   *
   * Files are set to expire after the retention period (default: 24 hours)
   */
  async create(data: CreatePdfData): Promise<Pdf> {
    // Calculate privacy-safe URL analytics (only for URL type)
    const urlHash = data.url ? hashUrl(data.url) : undefined;
    const urlDomain = data.url ? extractDomain(data.url) : undefined;

    // Calculate expiration time
    const expiresAt = calculateExpiresAt(data.retentionHours);

    return prisma.pdf.create({
      data: {
        accountId: data.accountId,
        type: data.type,
        url: data.url,
        // PRIVACY: html is intentionally NOT stored - it may contain invoices, reports, PII
        // PRIVACY: headers are intentionally NOT stored - may contain auth tokens
        // PRIVACY: cookies are intentionally NOT stored - sensitive session data
        format: data.format,
        landscape: data.landscape ?? false,
        printBackground: data.printBackground ?? true,
        margin: data.margin,
        displayHeaderFooter: data.displayHeaderFooter ?? false,
        headerTemplate: data.headerTemplate,
        footerTemplate: data.footerTemplate,
        pageRanges: data.pageRanges,
        preferCSSPageSize: data.preferCSSPageSize ?? false,
        width: data.width,
        height: data.height,
        scale: data.scale ?? 1.0,
        waitOptions: data.waitOptions,
        userAgent: data.userAgent,
        metadata: data.metadata,
        webhookUrl: data.webhookUrl,
        status: 'PENDING',
        // Privacy-safe analytics
        urlHash,
        urlDomain,
        // Retention controls
        expiresAt,
      },
    });
  }

  /**
   * Find PDF by ID
   * @deprecated Use findByIdAndAccountId for secure access
   */
  async findById(id: string): Promise<Pdf | null> {
    return prisma.pdf.findUnique({
      where: { id },
    });
  }

  /**
   * Find PDF by ID with ownership verification (BOLA protection)
   * Returns null if PDF doesn't exist OR doesn't belong to account
   */
  async findByIdAndAccountId(id: string, accountId: string): Promise<Pdf | null> {
    return prisma.pdf.findFirst({
      where: { id, accountId },
    });
  }

  /**
   * Find all PDFs for a specific account with pagination
   */
  async findByAccountId(
    accountId: string,
    options: PdfPaginationOptions
  ): Promise<{ data: Pdf[]; total: number }> {
    const { page, limit, status, type, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.PdfWhereInput = {
      accountId,
      ...(status && { status }),
      ...(type && { type }),
    };

    const [data, total] = await prisma.$transaction([
      prisma.pdf.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.pdf.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Update PDF status and related fields
   */
  async updateStatus(id: string, updateData: UpdatePdfStatusData): Promise<Pdf> {
    return prisma.pdf.update({
      where: { id },
      data: {
        status: updateData.status,
        downloadUrl: updateData.downloadUrl,
        storageKey: updateData.storageKey,
        fileSize: updateData.fileSize,
        pages: updateData.pages,
        error: updateData.error,
        completedAt: updateData.completedAt,
      },
    });
  }

  /**
   * Mark PDF as processing
   */
  async markAsProcessing(id: string): Promise<Pdf> {
    return this.updateStatus(id, {
      status: 'PROCESSING',
    });
  }

  /**
   * Mark PDF as completed
   */
  async markAsCompleted(
    id: string,
    downloadUrl: string,
    storageKey: string,
    fileSize: number,
    pages: number
  ): Promise<Pdf> {
    return this.updateStatus(id, {
      status: 'COMPLETED',
      downloadUrl,
      storageKey,
      fileSize,
      pages,
      completedAt: new Date(),
    });
  }

  /**
   * Mark PDF as failed
   */
  async markAsFailed(id: string, error: string): Promise<Pdf> {
    return this.updateStatus(id, {
      status: 'FAILED',
      error,
      completedAt: new Date(),
    });
  }

  /**
   * Delete PDF with ownership verification (BOLA protection)
   * Returns true if deleted, false if not found or unauthorized
   */
  async deleteByIdAndAccountId(id: string, accountId: string): Promise<boolean> {
    const result = await prisma.pdf.deleteMany({
      where: { id, accountId },
    });
    return result.count > 0;
  }

  /**
   * Delete PDF by ID only (for internal/admin use)
   * @deprecated Use deleteByIdAndAccountId for user-facing operations
   */
  async delete(id: string): Promise<void> {
    await prisma.pdf.delete({
      where: { id },
    });
  }

  /**
   * Count PDFs by status for an account
   */
  async countByStatus(accountId: string, status: PdfStatus): Promise<number> {
    return prisma.pdf.count({
      where: {
        accountId,
        status,
      },
    });
  }

  /**
   * Find pending PDFs for processing (queue worker)
   */
  async findPending(limit: number = 10): Promise<Pdf[]> {
    return prisma.pdf.findMany({
      where: {
        status: 'PENDING',
      },
      take: limit,
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Cleanup old completed/failed PDFs
   */
  async cleanupOld(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.pdf.deleteMany({
      where: {
        status: {
          in: ['COMPLETED', 'FAILED'],
        },
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}

// Export singleton instance
export const pdfRepository = new PdfRepository();
