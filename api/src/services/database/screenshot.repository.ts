import { prisma } from '../../lib/db';
import type { Screenshot, ScreenshotStatus, Prisma } from '@prisma/client';

export interface CreateScreenshotData {
  accountId: string;
  url: string;
  format: 'PNG' | 'JPEG' | 'WEBP';
  fullPage?: boolean;
  quality?: number;
  viewport?: Prisma.InputJsonValue;
  clip?: Prisma.InputJsonValue;
  waitOptions?: Prisma.InputJsonValue;
  headers?: Prisma.InputJsonValue;
  cookies?: Prisma.InputJsonValue;
  userAgent?: string;
  blockResources?: Prisma.InputJsonValue;
  omitBackground?: boolean;
  encoding?: string;
  metadata?: Prisma.InputJsonValue;
  webhookUrl?: string;
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
        headers: data.headers,
        cookies: data.cookies,
        userAgent: data.userAgent,
        blockResources: data.blockResources,
        omitBackground: data.omitBackground ?? false,
        encoding: data.encoding ?? 'binary',
        metadata: data.metadata,
        webhookUrl: data.webhookUrl,
        status: 'PENDING',
      },
    });
  }

  /**
   * Find screenshot by ID
   */
  async findById(id: string): Promise<Screenshot | null> {
    return prisma.screenshot.findUnique({
      where: { id },
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
   * Delete screenshot
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
