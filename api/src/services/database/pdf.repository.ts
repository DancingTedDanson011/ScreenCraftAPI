import { prisma } from '../../lib/db';
import type { Pdf, PdfStatus, PdfType, Prisma } from '@prisma/client';

export interface CreatePdfData {
  accountId: string;
  type: 'URL' | 'HTML';
  url?: string;
  html?: string;
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
  headers?: Prisma.InputJsonValue;
  cookies?: Prisma.InputJsonValue;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
  webhookUrl?: string;
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
   */
  async create(data: CreatePdfData): Promise<Pdf> {
    return prisma.pdf.create({
      data: {
        accountId: data.accountId,
        type: data.type,
        url: data.url,
        html: data.html,
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
        headers: data.headers,
        cookies: data.cookies,
        userAgent: data.userAgent,
        metadata: data.metadata,
        webhookUrl: data.webhookUrl,
        status: 'PENDING',
      },
    });
  }

  /**
   * Find PDF by ID
   */
  async findById(id: string): Promise<Pdf | null> {
    return prisma.pdf.findUnique({
      where: { id },
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
   * Delete PDF
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
