// Admin Logs Service - Audit Log Management for Admin Panel

import { prisma } from '../../lib/db.js';
import type {
  AuditLogEntry,
  PaginationParams,
  PaginatedResponse,
} from '../types/admin.types.js';
import { createSafeOrderBy, validatePagination } from '../utils/query-validator.js';

/**
 * Admin Logs Service
 * Manages audit logs from the admin panel
 */
export class AdminLogsService {
  /**
   * List audit logs with pagination
   */
  async listAuditLogs(
    params: PaginationParams & {
      adminId?: string;
      accountId?: string;
      action?: string;
      targetType?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<PaginatedResponse<AuditLogEntry>> {
    const {
      sortBy,
      sortOrder,
      adminId,
      accountId,
      action,
      targetType,
      startDate,
      endDate,
    } = params;

    // M-03: Validate pagination and sort parameters
    const { page, limit, skip } = validatePagination(params.page, params.limit, 100);
    const orderBy = createSafeOrderBy('auditLog', sortBy, sortOrder, 'createdAt');

    // Build where clause
    const where: any = {};

    if (adminId) {
      where.adminId = adminId;
    }

    if (accountId) {
      where.accountId = accountId;
    }

    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    if (targetType) {
      where.targetType = targetType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    // Get total count
    const total = await prisma.auditLog.count({ where });

    // Get logs with admin info
    // M-03: Using validated orderBy to prevent injection
    const logs = await prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        admin: {
          select: {
            email: true,
          },
        },
      },
    });

    // Transform to response format
    const data: AuditLogEntry[] = logs.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      adminEmail: log.admin?.email || null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details as Record<string, any> | null,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get audit log details
   */
  async getAuditLog(logId: string): Promise<AuditLogEntry | null> {
    const log = await prisma.auditLog.findUnique({
      where: { id: logId },
      include: {
        admin: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!log) {
      return null;
    }

    return {
      id: log.id,
      adminId: log.adminId,
      adminEmail: log.admin?.email || null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details as Record<string, any> | null,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    };
  }

  /**
   * Get audit logs for a specific user
   */
  async getLogsForUser(accountId: string, limit: number = 50): Promise<AuditLogEntry[]> {
    const logs = await prisma.auditLog.findMany({
      where: { accountId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: {
            email: true,
          },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      adminEmail: log.admin?.email || null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details as Record<string, any> | null,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    }));
  }

  /**
   * Get action types for filtering
   */
  async getActionTypes(): Promise<string[]> {
    const actions = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });

    return actions.map((a) => a.action);
  }

  /**
   * Get target types for filtering
   */
  async getTargetTypes(): Promise<string[]> {
    const types = await prisma.auditLog.findMany({
      where: { targetType: { not: null } },
      select: { targetType: true },
      distinct: ['targetType'],
      orderBy: { targetType: 'asc' },
    });

    return types.map((t) => t.targetType!);
  }

  /**
   * Get audit log statistics
   */
  async getLogStats(hours: number = 24): Promise<{
    totalLogs: number;
    recentLogs: number;
    actionBreakdown: Record<string, number>;
    activeAdmins: number;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [totalLogs, recentLogs, actionGroups, activeAdmins] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: since } },
        _count: { action: true },
      }),
      prisma.auditLog.findMany({
        where: {
          createdAt: { gte: since },
          adminId: { not: null },
        },
        select: { adminId: true },
        distinct: ['adminId'],
      }),
    ]);

    const actionBreakdown: Record<string, number> = {};
    for (const group of actionGroups) {
      actionBreakdown[group.action] = group._count.action;
    }

    return {
      totalLogs,
      recentLogs,
      actionBreakdown,
      activeAdmins: activeAdmins.length,
    };
  }

  /**
   * Clean old audit logs
   */
  async cleanOldLogs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  /**
   * Export logs to JSON
   */
  async exportLogs(
    startDate: Date,
    endDate: Date,
    limit: number = 10000
  ): Promise<AuditLogEntry[]> {
    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: {
        admin: {
          select: {
            email: true,
          },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      adminEmail: log.admin?.email || null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details as Record<string, any> | null,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    }));
  }
}

export const adminLogsService = new AdminLogsService();
