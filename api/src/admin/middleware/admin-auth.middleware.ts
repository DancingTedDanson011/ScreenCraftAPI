// Admin Auth Middleware - JWT Authentication for Admin Terminal

import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/db.js';
import type { AdminInfo, AdminJwtPayload } from '../types/admin.types.js';
import { AdminRole } from '@prisma/client';
import { anonymizeIp } from '../../utils/pii-sanitizer.js';

// Extend Fastify Request to include admin info
declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminInfo;
  }
}

/**
 * Get admin JWT secret from environment
 */
function getAdminJwtSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Admin Auth Middleware
 * Validates JWT token and attaches admin info to request
 */
export async function adminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Admin authentication required',
      code: 'MISSING_AUTH_HEADER',
    });
  }

  // Extract token from "Bearer <token>"
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid authorization header format',
      code: 'INVALID_AUTH_FORMAT',
    });
  }

  try {
    // M-07: Verify JWT token with explicit algorithm to prevent algorithm confusion attacks
    const decoded = jwt.verify(token, getAdminJwtSecret(), {
      algorithms: ['HS256'],
    }) as AdminJwtPayload;

    // M-02: Check if token is in active sessions (blacklist check)
    // This ensures logged-out tokens are immediately invalidated
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);

    const activeSession = await prisma.adminSession.findFirst({
      where: {
        token: tokenHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!activeSession) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Session has been invalidated',
        code: 'SESSION_INVALIDATED',
      });
    }

    // Verify admin still exists and is active
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!adminUser) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Admin user not found',
        code: 'ADMIN_NOT_FOUND',
      });
    }

    if (!adminUser.isActive) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Admin account is deactivated',
        code: 'ADMIN_DEACTIVATED',
      });
    }

    // Attach admin info to request
    request.admin = {
      adminId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
    }

    request.log.error(error, 'Admin auth error');
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication failed',
      code: 'AUTH_FAILED',
    });
  }
}

/**
 * Role-based access control middleware factory
 * @param allowedRoles - Array of roles that can access the route
 */
export function requireRole(...allowedRoles: AdminRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.admin) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Admin authentication required',
        code: 'NOT_AUTHENTICATED',
      });
    }

    if (!allowedRoles.includes(request.admin.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `This action requires one of these roles: ${allowedRoles.join(', ')}`,
        code: 'INSUFFICIENT_ROLE',
      });
    }
  };
}

/**
 * Admin login handler
 */
export async function adminLogin(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  token: string;
  admin: AdminInfo;
  expiresAt: Date;
}> {
  // Find admin user
  const adminUser = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!adminUser) {
    throw new Error('Invalid credentials');
  }

  if (!adminUser.isActive) {
    throw new Error('Account is deactivated');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, adminUser.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // Generate JWT token (expires in 8 hours)
  const expiresIn = 8 * 60 * 60; // 8 hours in seconds
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const payload: AdminJwtPayload = {
    adminId: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
  };

  // M-07: Explicitly specify algorithm to prevent algorithm confusion attacks
  const token = jwt.sign(payload, getAdminJwtSecret(), {
    expiresIn,
    algorithm: 'HS256',
  });

  // Create session record with unique token identifier
  // Use a hash of the full token to ensure uniqueness
  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);

  // M-14: Anonymize IP address before storing (GDPR compliance)
  await prisma.adminSession.create({
    data: {
      adminId: adminUser.id,
      token: tokenHash,
      ipAddress: anonymizeIp(ipAddress) || 'unknown',
      userAgent: userAgent,
      expiresAt,
    },
  });

  // Update last login
  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    token,
    admin: {
      adminId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
    },
    expiresAt,
  };
}

/**
 * Admin logout handler
 */
export async function adminLogout(token: string): Promise<void> {
  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);

  await prisma.adminSession.deleteMany({
    where: { token: tokenHash },
  });
}

/**
 * Validate admin token from WebSocket query parameter
 */
export async function validateAdminToken(token: string): Promise<AdminInfo | null> {
  try {
    // M-07: Explicit algorithm verification
    const decoded = jwt.verify(token, getAdminJwtSecret(), {
      algorithms: ['HS256'],
    }) as AdminJwtPayload;

    // M-02: Check if token is in active sessions
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);

    const activeSession = await prisma.adminSession.findFirst({
      where: {
        token: tokenHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!activeSession) {
      return null; // Token has been logged out
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: decoded.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!adminUser || !adminUser.isActive) {
      return null;
    }

    return {
      adminId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
    };
  } catch {
    return null;
  }
}

/**
 * Hash password for admin user creation
 */
export async function hashAdminPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Create audit log entry
 * M-14/L-03: IP addresses are anonymized and PII is sanitized before storage
 */
export async function createAuditLog(
  adminId: string | null,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      adminId,
      action,
      targetType,
      targetId,
      details: details || null,
      // M-14: Anonymize IP address before storing (GDPR compliance)
      ipAddress: anonymizeIp(ipAddress),
    },
  });
}
