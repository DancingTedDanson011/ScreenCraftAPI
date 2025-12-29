// Password Auth Service - Email/Password Authentication

import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/db.js';
import { securityLogger } from '../security/security-logger.service.js';

const SALT_ROUNDS = 12;

export class PasswordService {
  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Register a new user with email/password
   */
  async register(email: string, password: string, name?: string) {
    // Check if email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Validate password strength
    this.validatePassword(password);

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user with account in transaction
    const user = await prisma.$transaction(async (tx) => {
      // Create Account first
      const newAccount = await tx.account.create({
        data: {
          email: email.toLowerCase(),
          tier: 'FREE',
          monthlyCredits: 100,
          usedCredits: 0,
        },
      });

      // Create User with password
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          name: name || null,
          passwordHash,
          accountId: newAccount.id,
        },
        include: { account: true },
      });

      return newUser;
    });

    return user;
  }

  /**
   * Login with email and password
   * H-16: Includes security audit logging
   */
  async login(email: string, password: string, context?: { ipAddress?: string; userAgent?: string }) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { account: true },
    });

    if (!user) {
      // H-16: Log failed login attempt
      await securityLogger.loginFailed({
        email: email.toLowerCase(),
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        additionalInfo: { reason: 'user_not_found' },
      });
      throw new Error('Invalid credentials');
    }

    // H-04: Check if user has a password set
    // Use generic error to prevent user enumeration (don't reveal auth method)
    if (!user.passwordHash) {
      // H-16: Log failed login attempt
      await securityLogger.loginFailed({
        email: email.toLowerCase(),
        userId: user.id,
        accountId: user.accountId || undefined,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        additionalInfo: { reason: 'no_password_set' },
      });
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      // H-16: Log failed login attempt
      await securityLogger.loginFailed({
        email: email.toLowerCase(),
        userId: user.id,
        accountId: user.accountId || undefined,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        additionalInfo: { reason: 'invalid_password' },
      });
      throw new Error('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // H-16: Log successful login
    await securityLogger.loginSuccess({
      email: email.toLowerCase(),
      userId: user.id,
      accountId: user.accountId || undefined,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return user;
  }

  /**
   * Set/change password for a user
   */
  async setPassword(userId: string, newPassword: string) {
    this.validatePassword(newPassword);
    const passwordHash = await this.hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  /**
   * Change password (requires current password)
   * H-16: Includes security audit logging
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new Error('User not found or no password set');
    }

    const isValid = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    await this.setPassword(userId, newPassword);

    // H-16: Log password change
    await securityLogger.passwordChanged({
      userId,
      accountId: user.accountId || undefined,
      email: user.email,
    });
  }

  /**
   * Check if user has password auth enabled
   */
  async hasPasswordAuth(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    return !!user?.passwordHash;
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Check for at least one uppercase, one lowercase, one number
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
  }
}

export const passwordService = new PasswordService();
