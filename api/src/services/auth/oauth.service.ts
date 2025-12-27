// OAuth Service - Google Authentication Handler

import { prisma } from '../../lib/db.js';

interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export class OAuthService {
  /**
   * Find existing user or create new one from Google OAuth data
   * Links Google account to existing user if email matches
   */
  async findOrCreateUser(googleUser: GoogleUser) {
    // Check if OAuth account already exists
    let oauthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: googleUser.id,
        },
      },
      include: {
        user: {
          include: { account: true }
        }
      },
    });

    if (oauthAccount) {
      // Update last login timestamp
      await prisma.user.update({
        where: { id: oauthAccount.userId },
        data: { lastLoginAt: new Date() },
      });
      return oauthAccount.user;
    }

    // Check if user with this email already exists (link account)
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
      include: { account: true },
    });

    if (!user) {
      // Create new user with account in a transaction
      user = await prisma.$transaction(async (tx) => {
        // Create Account first
        const newAccount = await tx.account.create({
          data: {
            email: googleUser.email,
            tier: 'FREE',
            monthlyCredits: 100,
            usedCredits: 0,
          },
        });

        // Create User linked to Account
        const newUser = await tx.user.create({
          data: {
            email: googleUser.email,
            name: googleUser.name,
            image: googleUser.picture,
            emailVerified: new Date(),
            lastLoginAt: new Date(),
            accountId: newAccount.id,
          },
          include: { account: true },
        });

        return newUser;
      });
    }

    // Create OAuth account link
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: 'google',
        providerAccountId: googleUser.id,
      },
    });

    return user;
  }

  /**
   * Get user by ID with account data
   */
  async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { account: true },
    });
  }

  /**
   * Get user by email with account data
   */
  async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { account: true },
    });
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, data: { name?: string; image?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      include: { account: true },
    });
  }

  /**
   * Delete user and all associated data
   */
  async deleteUser(userId: string) {
    // This will cascade delete OAuth accounts, sessions, etc.
    return prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * List all OAuth providers linked to a user
   */
  async getLinkedProviders(userId: string) {
    return prisma.oAuthAccount.findMany({
      where: { userId },
      select: {
        provider: true,
        providerAccountId: true,
        createdAt: true,
      },
    });
  }

  /**
   * Unlink an OAuth provider from a user
   */
  async unlinkProvider(userId: string, provider: string) {
    // Ensure user has at least one other auth method
    const providers = await prisma.oAuthAccount.count({
      where: { userId },
    });

    if (providers <= 1) {
      throw new Error('Cannot unlink the last authentication provider');
    }

    return prisma.oAuthAccount.deleteMany({
      where: {
        userId,
        provider,
      },
    });
  }
}

export const oauthService = new OAuthService();
