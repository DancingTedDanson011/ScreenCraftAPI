// Admin Auth Middleware Unit Tests
// Tests JWT authentication, role-based access control, login/logout

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {
  adminAuthMiddleware,
  requireRole,
  adminLogin,
  adminLogout,
  validateAdminToken,
  hashAdminPassword,
  createAuditLog,
} from '../../../../src/admin/middleware/admin-auth.middleware.js';
import { AdminRole } from '@prisma/client';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
    TokenExpiredError: class TokenExpiredError extends Error {
      constructor() {
        super('Token expired');
        this.name = 'TokenExpiredError';
      }
    },
    JsonWebTokenError: class JsonWebTokenError extends Error {
      constructor() {
        super('Invalid token');
        this.name = 'JsonWebTokenError';
      }
    },
  },
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

// Mock Prisma client
vi.mock('../../../../src/lib/db.js', () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminSession: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Import mocked modules after vi.mock
import { prisma } from '../../../../src/lib/db.js';

// Set up environment variable for tests
const TEST_JWT_SECRET = 'test-admin-jwt-secret-key-12345';

describe('Admin Auth Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let sendMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set environment variable
    process.env.ADMIN_JWT_SECRET = TEST_JWT_SECRET;

    // Mock reply object
    sendMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnValue({ send: sendMock });

    mockReply = {
      status: statusMock,
      send: sendMock,
    };

    // Mock request object
    mockRequest = {
      headers: {},
      log: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      } as any,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ADMIN_JWT_SECRET;
  });

  // ============================================
  // adminAuthMiddleware Tests
  // ============================================
  describe('adminAuthMiddleware', () => {
    it('should return 401 when authorization header is missing', async () => {
      mockRequest.headers = {};

      await adminAuthMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Admin authentication required',
        code: 'MISSING_AUTH_HEADER',
      });
    });

    it('should return 401 when token is empty after stripping Bearer', async () => {
      mockRequest.headers = { authorization: 'Bearer ' };

      await adminAuthMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid authorization header format',
        code: 'INVALID_AUTH_FORMAT',
      });
    });

    it('should return 401 when admin user is not found', async () => {
      const validPayload = {
        adminId: 'admin-123',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN' as AdminRole,
      };

      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwt.verify).mockReturnValue(validPayload as any);
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);

      await adminAuthMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Admin user not found',
        code: 'ADMIN_NOT_FOUND',
      });
    });

    it('should return 401 when admin account is deactivated', async () => {
      const validPayload = {
        adminId: 'admin-123',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN' as AdminRole,
      };

      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwt.verify).mockReturnValue(validPayload as any);
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'SUPER_ADMIN' as AdminRole,
        isActive: false,
      } as any);

      await adminAuthMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Admin account is deactivated',
        code: 'ADMIN_DEACTIVATED',
      });
    });

    it('should attach admin info to request on successful auth', async () => {
      const validPayload = {
        adminId: 'admin-123',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN' as AdminRole,
      };

      const mockAdminUser = {
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'SUPER_ADMIN' as AdminRole,
        isActive: true,
      };

      mockRequest.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwt.verify).mockReturnValue(validPayload as any);
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(mockAdminUser as any);

      await adminAuthMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).admin).toEqual({
        adminId: 'admin-123',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'SUPER_ADMIN',
      });
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', async () => {
      mockRequest.headers = { authorization: 'Bearer expired-token' };
      vi.mocked(jwt.verify).mockImplementation(() => {
        const error = new jwt.TokenExpiredError();
        throw error;
      });

      await adminAuthMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
    });

    it('should return 401 when token is invalid', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      vi.mocked(jwt.verify).mockImplementation(() => {
        const error = new jwt.JsonWebTokenError();
        throw error;
      });

      await adminAuthMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
    });

    it('should return 401 on generic auth error', async () => {
      mockRequest.headers = { authorization: 'Bearer some-token' };
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Unknown error');
      });

      await adminAuthMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication failed',
        code: 'AUTH_FAILED',
      });
      expect(mockRequest.log!.error).toHaveBeenCalled();
    });

    it('should verify token with correct secret', async () => {
      mockRequest.headers = { authorization: 'Bearer test-token' };
      vi.mocked(jwt.verify).mockReturnValue({
        adminId: 'admin-123',
        email: 'admin@example.com',
        role: 'ADMIN' as AdminRole,
      } as any);
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Test',
        role: 'ADMIN' as AdminRole,
        isActive: true,
      } as any);

      await adminAuthMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(jwt.verify).toHaveBeenCalledWith('test-token', TEST_JWT_SECRET);
    });
  });

  // ============================================
  // requireRole Tests
  // ============================================
  describe('requireRole', () => {
    it('should return 401 when admin is not authenticated', async () => {
      const middleware = requireRole('SUPER_ADMIN' as AdminRole);
      mockRequest.admin = undefined;

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Admin authentication required',
        code: 'NOT_AUTHENTICATED',
      });
    });

    it('should return 403 when admin role is insufficient', async () => {
      const middleware = requireRole('SUPER_ADMIN' as AdminRole);
      (mockRequest as any).admin = {
        adminId: 'admin-123',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'VIEWER' as AdminRole,
      };

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'This action requires one of these roles: SUPER_ADMIN',
        code: 'INSUFFICIENT_ROLE',
      });
    });

    it('should allow access when admin has required role', async () => {
      const middleware = requireRole('ADMIN' as AdminRole);
      (mockRequest as any).admin = {
        adminId: 'admin-123',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'ADMIN' as AdminRole,
      };

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).not.toHaveBeenCalled();
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('should allow any of multiple allowed roles', async () => {
      const middleware = requireRole('ADMIN' as AdminRole, 'SUPER_ADMIN' as AdminRole);
      (mockRequest as any).admin = {
        adminId: 'admin-123',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'SUPER_ADMIN' as AdminRole,
      };

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should list all required roles in error message', async () => {
      const middleware = requireRole('ADMIN' as AdminRole, 'SUPER_ADMIN' as AdminRole);
      (mockRequest as any).admin = {
        adminId: 'admin-123',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'VIEWER' as AdminRole,
      };

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'This action requires one of these roles: ADMIN, SUPER_ADMIN',
        })
      );
    });
  });

  // ============================================
  // adminLogin Tests
  // ============================================
  describe('adminLogin', () => {
    const mockAdminUser = {
      id: 'admin-123',
      email: 'admin@example.com',
      name: 'Test Admin',
      role: 'ADMIN' as AdminRole,
      passwordHash: 'hashed-password',
      isActive: true,
    };

    beforeEach(() => {
      vi.mocked(jwt.sign).mockReturnValue('generated-jwt-token' as any);
    });

    it('should throw error when admin user not found', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);

      await expect(
        adminLogin('nonexistent@example.com', 'password')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error when account is deactivated', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
        ...mockAdminUser,
        isActive: false,
      } as any);

      await expect(
        adminLogin('admin@example.com', 'password')
      ).rejects.toThrow('Account is deactivated');
    });

    it('should throw error when password is invalid', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(mockAdminUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        adminLogin('admin@example.com', 'wrong-password')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should return token and admin info on successful login', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(mockAdminUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.adminSession.create).mockResolvedValue({} as any);
      vi.mocked(prisma.adminUser.update).mockResolvedValue({} as any);

      const result = await adminLogin('admin@example.com', 'correct-password');

      expect(result.token).toBe('generated-jwt-token');
      expect(result.admin).toEqual({
        adminId: 'admin-123',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'ADMIN',
      });
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should lookup admin by lowercase email', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(mockAdminUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.adminSession.create).mockResolvedValue({} as any);
      vi.mocked(prisma.adminUser.update).mockResolvedValue({} as any);

      await adminLogin('ADMIN@EXAMPLE.COM', 'password');

      expect(prisma.adminUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@example.com' },
        select: expect.any(Object),
      });
    });

    it('should create session record on login', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(mockAdminUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.adminSession.create).mockResolvedValue({} as any);
      vi.mocked(prisma.adminUser.update).mockResolvedValue({} as any);

      await adminLogin('admin@example.com', 'password', '192.168.1.1', 'Chrome/120');

      expect(prisma.adminSession.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-123',
          token: expect.any(String),
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/120',
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should update lastLoginAt on successful login', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(mockAdminUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.adminSession.create).mockResolvedValue({} as any);
      vi.mocked(prisma.adminUser.update).mockResolvedValue({} as any);

      await adminLogin('admin@example.com', 'password');

      expect(prisma.adminUser.update).toHaveBeenCalledWith({
        where: { id: 'admin-123' },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should sign JWT with correct payload and expiry', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(mockAdminUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.adminSession.create).mockResolvedValue({} as any);
      vi.mocked(prisma.adminUser.update).mockResolvedValue({} as any);

      await adminLogin('admin@example.com', 'password');

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          adminId: 'admin-123',
          email: 'admin@example.com',
          role: 'ADMIN',
        },
        TEST_JWT_SECRET,
        { expiresIn: 28800 } // 8 hours in seconds
      );
    });

    it('should default ipAddress to unknown when not provided', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(mockAdminUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.adminSession.create).mockResolvedValue({} as any);
      vi.mocked(prisma.adminUser.update).mockResolvedValue({} as any);

      await adminLogin('admin@example.com', 'password');

      expect(prisma.adminSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: 'unknown',
        }),
      });
    });
  });

  // ============================================
  // adminLogout Tests
  // ============================================
  describe('adminLogout', () => {
    it('should delete session by token prefix', async () => {
      const token = 'a'.repeat(100); // Token longer than 64 chars
      vi.mocked(prisma.adminSession.deleteMany).mockResolvedValue({ count: 1 });

      await adminLogout(token);

      expect(prisma.adminSession.deleteMany).toHaveBeenCalledWith({
        where: { token: 'a'.repeat(64) },
      });
    });

    it('should handle short tokens correctly', async () => {
      const shortToken = 'short-token';
      vi.mocked(prisma.adminSession.deleteMany).mockResolvedValue({ count: 1 });

      await adminLogout(shortToken);

      expect(prisma.adminSession.deleteMany).toHaveBeenCalledWith({
        where: { token: shortToken },
      });
    });
  });

  // ============================================
  // validateAdminToken Tests
  // ============================================
  describe('validateAdminToken', () => {
    it('should return admin info for valid token', async () => {
      const validPayload = {
        adminId: 'admin-123',
        email: 'admin@example.com',
        role: 'ADMIN' as AdminRole,
      };

      vi.mocked(jwt.verify).mockReturnValue(validPayload as any);
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'ADMIN' as AdminRole,
        isActive: true,
      } as any);

      const result = await validateAdminToken('valid-token');

      expect(result).toEqual({
        adminId: 'admin-123',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'ADMIN',
      });
    });

    it('should return null when token is invalid', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await validateAdminToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null when admin user not found', async () => {
      vi.mocked(jwt.verify).mockReturnValue({
        adminId: 'admin-123',
        email: 'admin@example.com',
        role: 'ADMIN',
      } as any);
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);

      const result = await validateAdminToken('valid-token');

      expect(result).toBeNull();
    });

    it('should return null when admin is not active', async () => {
      vi.mocked(jwt.verify).mockReturnValue({
        adminId: 'admin-123',
        email: 'admin@example.com',
        role: 'ADMIN',
      } as any);
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue({
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'ADMIN' as AdminRole,
        isActive: false,
      } as any);

      const result = await validateAdminToken('valid-token');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // hashAdminPassword Tests
  // ============================================
  describe('hashAdminPassword', () => {
    it('should hash password with salt rounds of 12', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);

      const result = await hashAdminPassword('my-password');

      expect(bcrypt.hash).toHaveBeenCalledWith('my-password', 12);
      expect(result).toBe('hashed-password');
    });
  });

  // ============================================
  // createAuditLog Tests
  // ============================================
  describe('createAuditLog', () => {
    it('should create audit log with all parameters', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await createAuditLog(
        'admin-123',
        'BAN_USER',
        'account',
        'user-456',
        { reason: 'TOS violation' },
        '192.168.1.1'
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-123',
          action: 'BAN_USER',
          targetType: 'account',
          targetId: 'user-456',
          details: { reason: 'TOS violation' },
          ipAddress: '192.168.1.1',
        },
      });
    });

    it('should create audit log with null adminId', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await createAuditLog(null, 'SYSTEM_ACTION');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: null,
          action: 'SYSTEM_ACTION',
          targetType: undefined,
          targetId: undefined,
          details: null,
          ipAddress: undefined,
        },
      });
    });

    it('should handle undefined details by setting to null', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await createAuditLog('admin-123', 'LOGIN', 'admin', 'admin-123');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: null,
        }),
      });
    });
  });

  // ============================================
  // Environment Variable Tests
  // ============================================
  describe('getAdminJwtSecret', () => {
    it('should return 401 when ADMIN_JWT_SECRET is not set', async () => {
      delete process.env.ADMIN_JWT_SECRET;

      mockRequest.headers = { authorization: 'Bearer test-token' };

      // When ADMIN_JWT_SECRET is not set, getAdminJwtSecret() throws an error
      // which is caught by the middleware and results in AUTH_FAILED response
      await adminAuthMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication failed',
        code: 'AUTH_FAILED',
      });
    });
  });
});
