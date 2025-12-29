// Admin Messages Service - Contact Submissions Management for Admin Panel

import { prisma } from '../../lib/db.js';
import type {
  PaginationParams,
  PaginatedResponse,
} from '../types/admin.types.js';
import { ContactStatus } from '@prisma/client';
import { createSafeOrderBy, validatePagination } from '../utils/query-validator.js';

export interface ContactMessageListItem {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  ipAddress: string | null;
  userAgent: string | null;
  repliedAt: Date | null;
  createdAt: Date;
}

/**
 * Admin Messages Service
 * Manages contact submissions from the admin panel
 */
export class AdminMessagesService {
  /**
   * List all contact submissions with pagination
   */
  async listMessages(
    params: PaginationParams & {
      search?: string;
      status?: ContactStatus;
    }
  ): Promise<PaginatedResponse<ContactMessageListItem>> {
    const { sortBy, sortOrder, search, status } = params;

    // Validate pagination and sort parameters
    const { page, limit, skip } = validatePagination(params.page, params.limit, 100);
    const orderBy = createSafeOrderBy('contactSubmission', sortBy, sortOrder, 'createdAt');

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // Get total count
    const total = await prisma.contactSubmission.count({ where });

    // Get messages
    const messages = await prisma.contactSubmission.findMany({
      where,
      skip,
      take: limit,
      orderBy,
    });

    // Transform to response format
    const data: ContactMessageListItem[] = messages.map((msg) => ({
      id: msg.id,
      name: msg.name,
      email: msg.email,
      subject: msg.subject,
      message: msg.message,
      status: msg.status,
      ipAddress: msg.ipAddress,
      userAgent: msg.userAgent,
      repliedAt: msg.repliedAt,
      createdAt: msg.createdAt,
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
   * Get a single message by ID
   */
  async getMessage(id: string): Promise<ContactMessageListItem | null> {
    const message = await prisma.contactSubmission.findUnique({
      where: { id },
    });

    if (!message) return null;

    return {
      id: message.id,
      name: message.name,
      email: message.email,
      subject: message.subject,
      message: message.message,
      status: message.status,
      ipAddress: message.ipAddress,
      userAgent: message.userAgent,
      repliedAt: message.repliedAt,
      createdAt: message.createdAt,
    };
  }

  /**
   * Update message status
   */
  async updateStatus(id: string, status: ContactStatus, adminId: string): Promise<void> {
    const data: any = { status };

    if (status === 'REPLIED') {
      data.repliedAt = new Date();
    }

    await prisma.contactSubmission.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a message
   */
  async deleteMessage(id: string, adminId: string): Promise<void> {
    await prisma.contactSubmission.delete({
      where: { id },
    });
  }

  /**
   * Get message statistics
   */
  async getMessageStats(): Promise<{
    total: number;
    new: number;
    read: number;
    replied: number;
    spam: number;
    archived: number;
  }> {
    const [total, statusCounts] = await Promise.all([
      prisma.contactSubmission.count(),
      prisma.contactSubmission.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const stats = {
      total,
      new: 0,
      read: 0,
      replied: 0,
      spam: 0,
      archived: 0,
    };

    for (const item of statusCounts) {
      const key = item.status.toLowerCase() as keyof typeof stats;
      if (key in stats && key !== 'total') {
        stats[key] = item._count;
      }
    }

    return stats;
  }
}

export const adminMessagesService = new AdminMessagesService();
