import crypto from 'crypto';
import { prisma } from '../../lib/db';
import type { Screenshot, ScreenshotStatus, Prisma } from '@prisma/client';

// ============================================
// PRIVACY HELPER FUNCTIONS
// ============================================

/**
 * Hash a URL for privacy-safe analytics and deduplication.
 * We store the hash instead of the full URL to enable analytics
 * without exposing potentially sensitive URL parameters.
 */
export function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex');
}

/**
 * Extract domain from URL for aggregated usage statistics.
 * Only the hostname is stored, allowing usage analytics per domain
 * without storing full URL paths or query parameters.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Default expiration time for screenshots in hours.
 * Files older than this will be eligible for cleanup.
 */
const DEFAULT_EXPIRATION_HOURS = 24;

/**
 * Calculate expiration date based on default retention period.
 */
export function calculateExpiresAt(hoursFromNow: number = DEFAULT_EXPIRATION_HOURS): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hoursFromNow);
  return expiresAt;
}

// ============================================
// REPOSITORY INTERFACES
// ============================================

export interface CreateScreenshotData {
  accountId: string;
  url: string;
  format: 'PNG' | 'JPEG' | 'WEBP';
  fullPage?: boolean;
  quality?: number;
  viewport?: Prisma.InputJsonValue;
  clip?: Prisma.InputJsonValue;
  waitOptions?: Prisma.InputJsonValue;
  // PRIVACY: headers and cookies are intentionally NOT stored in the database.
  // They are used only during the Playwright capture and then discarded.
  // This prevents sensitive data (auth tokens, session cookies) from being persisted.
  userAgent?: string;
  blockResources?: Prisma.InputJsonValue;
  omitBackground?: boolean;
  encoding?: string;
  metadata?: Prisma.InputJsonValue;
  webhookUrl?: string;
  // Privacy-safe analytics fields
  urlHash?: string;
  urlDomain?: string;
  expiresAt?: Date;
}

export interface UpdateScreenshotStatusData {
  status: ScreenshotStatus;
  downloadUrl?: string;
  storageKey?: string;
  fileSize?: number;
  error?: string;
  completedAt?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  status?: ScreenshotStatus;
  sortBy?: 'createdAt' | 'completedAt';
  sortOrder?: 'asc' | 'desc';
}

export class ScreenshotRepository {
  /**
   * Create a new screenshot job
   *
   * PRIVACY NOTE: This method intentionally does NOT accept or store
   * headers or cookies. These sensitive values are used only during
   * the Playwright capture process and are never persisted.
   */
  async create(data: CreateScreenshotData): Promise<Screenshot> {
    return prisma.screenshot.create({
      data: {
        accountId: data.accountId,
        url: data.url,
        format: data.format,
        fullPage: data.fullPage ?? false,
        quality: data.quality,
        viewport: data.viewport,
        clip: data.clip,
        waitOptions: data.waitOptions,
        // PRIVACY: headers and cookies are NOT stored - see CreateScreenshotData interface
        userAgent: data.userAgent,
        blockResources: data.blockResources,
        omitBackground: data.omitBackground ?? false,
        encoding: data.encoding ?? 'binary',
        metadata: data.metadata,
        webhookUrl: data.webhookUrl,
        status: 'PENDING',
        // Privacy-safe analytics fields
        urlHash: data.urlHash ?? hashUrl(data.url),
        urlDomain: data.urlDomain ?? extractDomain(data.url),
        expiresAt: data.expiresAt ?? calculateExpiresAt(),
      },
    });
  }

  /**
   * Find screenshot by ID
   * @deprecated Use findByIdAndAccountId for secure access
   */
  async findById(id: string): Promise<Screenshot | null> {
    return prisma.screenshot.findUnique({
      where: { id },
    });
  }

  /**
   * Find screenshot by ID with ownership verification (BOLA protection)
   * Returns null if screenshot doesn't exist OR doesn't belong to account
   */
  async findByIdAndAccountId(id: string, accountId: string): Promise<Screenshot | null> {
    return prisma.screenshot.findFirst({
      where: { id, accountId },
    });
  }

  /**
   * Find all screenshots for a specific account with pagination
   */
  async findByAccountId(
    accountId: string,
    options: PaginationOptions
  ): Promise<{ data: Screenshot[]; total: number }> {
    const { page, limit, status, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ScreenshotWhereInput = {
      accountId,
      ...(status && { status }),
    };

    const [data, total] = await prisma.$transaction([
      prisma.screenshot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.screenshot.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Update screenshot status and related fields
   */
  async updateStatus(id: string, updateData: UpdateScreenshotStatusData): Promise<Screenshot> {
    return prisma.screenshot.update({
      where: { id },
      data: {
        status: updateData.status,
        downloadUrl: updateData.downloadUrl,
        storageKey: updateData.storageKey,
        fileSize: updateData.fileSize,
        error: updateData.error,
        completedAt: updateData.completedAt,
      },
    });
  }

  /**
   * Update screenshot with processing result
   */
  async markAsProcessing(id: string): Promise<Screenshot> {
    return this.updateStatus(id, {
      status: 'PROCESSING',
    });
  }

  /**
   * Mark screenshot as completed
   */
  async markAsCompleted(
    id: string,
    downloadUrl: string,
    storageKey: string,
    fileSize: number
  ): Promise<Screenshot> {
    return this.updateStatus(id, {
      status: 'COMPLETED',
      downloadUrl,
      storageKey,
      fileSize,
      completedAt: new Date(),
    });
  }

  /**
   * Mark screenshot as failed
   */
  async markAsFailed(id: string, error: string): Promise<Screenshot> {
    return this.updateStatus(id, {
      status: 'FAILED',
      error,
      completedAt: new Date(),
    });
  }

  /**
   * Delete screenshot with ownership verification (BOLA protection)
   * Returns true if deleted, false if not found or unauthorized
   */
  async deleteByIdAndAccountId(id: string, accountId: string): Promise<boolean> {
    const result = await prisma.screenshot.deleteMany({
      where: { id, accountId },
    });
    return result.count > 0;
  }

  /**
   * Delete screenshot by ID only (for internal/admin use)
   * @deprecated Use deleteByIdAndAccountId for user-facing operations
   */
  async delete(id: string): Promise<void> {
    await prisma.screenshot.delete({
      where: { id },
    });
  }

  /**
   * Count screenshots by status for an account
   */
  async countByStatus(accountId: string, status: ScreenshotStatus): Promise<number> {
    return prisma.screenshot.count({
      where: {
        accountId,
        status,
      },
    });
  }

  /**
   * Find pending screenshots for processing (queue worker)
   */
  async findPending(limit: number = 10): Promise<Screenshot[]> {
    return prisma.screenshot.findMany({
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
   * Cleanup old completed/failed screenshots
   */
  async cleanupOld(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.screenshot.deleteMany({
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
export const screenshotRepository = new ScreenshotRepository();
