// Admin Jobs Service - Job Queue Management for Admin Panel

import { prisma } from '../../lib/db.js';
import { queueService } from '../../services/queue/queue.service.js';
import type {
  AdminJobListItem,
  PaginationParams,
  PaginatedResponse,
} from '../types/admin.types.js';

/**
 * Admin Jobs Service
 * Manages screenshot and PDF jobs from the admin panel
 */
export class AdminJobsService {
  /**
   * List all jobs with pagination
   */
  async listJobs(
    params: PaginationParams & {
      type?: 'screenshot' | 'pdf' | 'all';
      status?: string;
      accountId?: string;
      search?: string;
    }
  ): Promise<PaginatedResponse<AdminJobListItem>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', type = 'all', status, accountId, search } = params;
    const skip = (page - 1) * limit;

    const jobs: AdminJobListItem[] = [];
    let total = 0;

    // Build where clauses
    const screenshotWhere: any = {};
    const pdfWhere: any = {};

    if (status) {
      screenshotWhere.status = status;
      pdfWhere.status = status;
    }

    if (accountId) {
      screenshotWhere.accountId = accountId;
      pdfWhere.accountId = accountId;
    }

    if (search) {
      screenshotWhere.url = { contains: search, mode: 'insensitive' };
      pdfWhere.url = { contains: search, mode: 'insensitive' };
    }

    // Get screenshots if needed
    if (type === 'all' || type === 'screenshot') {
      const screenshotCount = await prisma.screenshot.count({ where: screenshotWhere });
      const screenshots = await prisma.screenshot.findMany({
        where: screenshotWhere,
        skip: type === 'screenshot' ? skip : 0,
        take: type === 'screenshot' ? limit : Math.floor(limit / 2),
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          accountId: true,
          url: true,
          status: true,
          createdAt: true,
          completedAt: true,
          error: true,
        },
      });

      jobs.push(
        ...screenshots.map((s) => ({
          id: s.id,
          type: 'screenshot' as const,
          status: s.status,
          accountId: s.accountId,
          url: s.url,
          createdAt: s.createdAt,
          completedAt: s.completedAt,
          error: s.error,
        }))
      );

      if (type === 'screenshot') {
        total = screenshotCount;
      } else {
        total += screenshotCount;
      }
    }

    // Get PDFs if needed
    if (type === 'all' || type === 'pdf') {
      const pdfCount = await prisma.pdf.count({ where: pdfWhere });
      const pdfs = await prisma.pdf.findMany({
        where: pdfWhere,
        skip: type === 'pdf' ? skip : 0,
        take: type === 'pdf' ? limit : Math.floor(limit / 2),
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          accountId: true,
          url: true,
          status: true,
          createdAt: true,
          completedAt: true,
          error: true,
        },
      });

      jobs.push(
        ...pdfs.map((p) => ({
          id: p.id,
          type: 'pdf' as const,
          status: p.status,
          accountId: p.accountId,
          url: p.url,
          createdAt: p.createdAt,
          completedAt: p.completedAt,
          error: p.error,
        }))
      );

      if (type === 'pdf') {
        total = pdfCount;
      } else {
        total += pdfCount;
      }
    }

    // Sort combined results
    if (type === 'all') {
      jobs.sort((a, b) => {
        const aVal = a[sortBy as keyof AdminJobListItem];
        const bVal = b[sortBy as keyof AdminJobListItem];
        if (aVal instanceof Date && bVal instanceof Date) {
          return sortOrder === 'desc'
            ? bVal.getTime() - aVal.getTime()
            : aVal.getTime() - bVal.getTime();
        }
        return 0;
      });
    }

    return {
      data: jobs.slice(0, limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get job details
   */
  async getJob(jobId: string, type: 'screenshot' | 'pdf'): Promise<any | null> {
    if (type === 'screenshot') {
      return prisma.screenshot.findUnique({
        where: { id: jobId },
        include: {
          account: {
            select: {
              email: true,
              tier: true,
            },
          },
        },
      });
    } else {
      return prisma.pdf.findUnique({
        where: { id: jobId },
        include: {
          account: {
            select: {
              email: true,
              tier: true,
            },
          },
        },
      });
    }
  }

  /**
   * Cancel a pending or processing job
   */
  async cancelJob(jobId: string, type: 'screenshot' | 'pdf', adminId: string): Promise<void> {
    // Try to cancel in queue
    try {
      await queueService.cancelJob(type, jobId);
    } catch (error) {
      // Job might not be in queue, update database directly
    }

    // Update database status
    if (type === 'screenshot') {
      await prisma.screenshot.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: 'Cancelled by admin',
          completedAt: new Date(),
        },
      });
    } else {
      await prisma.pdf.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: 'Cancelled by admin',
          completedAt: new Date(),
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'CANCEL_JOB',
        targetType: type,
        targetId: jobId,
      },
    });
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string, type: 'screenshot' | 'pdf', adminId: string): Promise<string> {
    // Get original job data
    let originalJob: any;

    if (type === 'screenshot') {
      originalJob = await prisma.screenshot.findUnique({
        where: { id: jobId },
      });
    } else {
      originalJob = await prisma.pdf.findUnique({
        where: { id: jobId },
      });
    }

    if (!originalJob) {
      throw new Error('Job not found');
    }

    if (originalJob.status !== 'FAILED') {
      throw new Error('Only failed jobs can be retried');
    }

    // Try to retry in queue first
    try {
      await queueService.retryJob(type, jobId);

      // Update database status
      if (type === 'screenshot') {
        await prisma.screenshot.update({
          where: { id: jobId },
          data: {
            status: 'PENDING',
            error: null,
            completedAt: null,
          },
        });
      } else {
        await prisma.pdf.update({
          where: { id: jobId },
          data: {
            status: 'PENDING',
            error: null,
            completedAt: null,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          adminId,
          action: 'RETRY_JOB',
          targetType: type,
          targetId: jobId,
        },
      });

      return jobId;
    } catch (error) {
      throw new Error(`Failed to retry job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a job
   */
  async deleteJob(jobId: string, type: 'screenshot' | 'pdf', adminId: string): Promise<void> {
    if (type === 'screenshot') {
      await prisma.screenshot.delete({
        where: { id: jobId },
      });
    } else {
      await prisma.pdf.delete({
        where: { id: jobId },
      });
    }

    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'DELETE_JOB',
        targetType: type,
        targetId: jobId,
      },
    });
  }

  /**
   * Get job statistics
   */
  async getJobStats(): Promise<{
    screenshot: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      total: number;
    };
    pdf: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      total: number;
    };
  }> {
    const [
      screenshotPending,
      screenshotProcessing,
      screenshotCompleted,
      screenshotFailed,
      pdfPending,
      pdfProcessing,
      pdfCompleted,
      pdfFailed,
    ] = await Promise.all([
      prisma.screenshot.count({ where: { status: 'PENDING' } }),
      prisma.screenshot.count({ where: { status: 'PROCESSING' } }),
      prisma.screenshot.count({ where: { status: 'COMPLETED' } }),
      prisma.screenshot.count({ where: { status: 'FAILED' } }),
      prisma.pdf.count({ where: { status: 'PENDING' } }),
      prisma.pdf.count({ where: { status: 'PROCESSING' } }),
      prisma.pdf.count({ where: { status: 'COMPLETED' } }),
      prisma.pdf.count({ where: { status: 'FAILED' } }),
    ]);

    return {
      screenshot: {
        pending: screenshotPending,
        processing: screenshotProcessing,
        completed: screenshotCompleted,
        failed: screenshotFailed,
        total: screenshotPending + screenshotProcessing + screenshotCompleted + screenshotFailed,
      },
      pdf: {
        pending: pdfPending,
        processing: pdfProcessing,
        completed: pdfCompleted,
        failed: pdfFailed,
        total: pdfPending + pdfProcessing + pdfCompleted + pdfFailed,
      },
    };
  }

  /**
   * Clean old completed/failed jobs
   */
  async cleanOldJobs(olderThanDays: number, adminId: string): Promise<{ screenshots: number; pdfs: number }> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const [screenshotResult, pdfResult] = await Promise.all([
      prisma.screenshot.deleteMany({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          completedAt: { lt: cutoffDate },
        },
      }),
      prisma.pdf.deleteMany({
        where: {
          status: { in: ['COMPLETED', 'FAILED'] },
          completedAt: { lt: cutoffDate },
        },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'CLEAN_OLD_JOBS',
        details: {
          olderThanDays,
          deletedScreenshots: screenshotResult.count,
          deletedPdfs: pdfResult.count,
        },
      },
    });

    return {
      screenshots: screenshotResult.count,
      pdfs: pdfResult.count,
    };
  }
}

export const adminJobsService = new AdminJobsService();
