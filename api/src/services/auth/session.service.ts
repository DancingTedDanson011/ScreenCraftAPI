// Session Service - Secure Session Management

import crypto from 'node:crypto';
import { prisma } from '../../lib/db.js';

export class SessionService {
  /**
   * Hash session token using SHA256 for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate a cryptographically secure session token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new session for a user
   */
  async createSession(userId: string, userAgent?: string, ipAddress?: string) {
    const sessionToken = this.generateToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.session.create({
      data: {
        userId,
        sessionToken: this.hashToken(sessionToken),
        expires,
        userAgent,
        ipAddress,
      },
    });

    return { sessionToken, expires };
  }

  /**
   * Validate a session token and return user data if valid
   * Auto-extends session if close to expiry
   */
  async validateSession(token: string) {
    const hashedToken = this.hashToken(token);

    const session = await prisma.session.findUnique({
      where: { sessionToken: hashedToken },
      include: {
        user: {
          include: { account: true },
        },
      },
    });

    // Session not found or expired
    if (!session || session.expires < new Date()) {
      if (session) {
        // Clean up expired session
        await prisma.session.delete({
          where: { id: session.id },
        }).catch(() => {}); // Ignore errors
      }
      return null;
    }

    // Auto-extend session if less than 24 hours remaining
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (session.expires.getTime() - Date.now() < oneDayMs) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        },
      });
    }

    return session;
  }

  /**
   * Invalidate a specific session
   */
  async invalidateSession(token: string) {
    const hashedToken = this.hashToken(token);

    await prisma.session.deleteMany({
      where: { sessionToken: hashedToken },
    });
  }

  /**
   * Invalidate all sessions for a user (logout everywhere)
   */
  async invalidateAllUserSessions(userId: string) {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string) {
    return prisma.session.findMany({
      where: {
        userId,
        expires: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expires: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Invalidate a specific session by ID
   */
  async invalidateSessionById(sessionId: string, userId: string) {
    await prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });
  }

  /**
   * Clean up expired sessions (for scheduled job)
   */
  async cleanupExpiredSessions() {
    const result = await prisma.session.deleteMany({
      where: {
        expires: { lt: new Date() },
      },
    });

    return result.count;
  }

  /**
   * Check if a session is about to expire (within 1 day)
   */
  isSessionNearExpiry(expiresAt: Date): boolean {
    const oneDayMs = 24 * 60 * 60 * 1000;
    return expiresAt.getTime() - Date.now() < oneDayMs;
  }
}

export const sessionService = new SessionService();
