// Admin Statistics Service - Revenue and Usage Statistics

import { prisma } from '../../lib/db.js';
import Stripe from 'stripe';
import { STRIPE_CONFIG, isStripeConfigured } from '../../config/stripe.config.js';
import { logger } from '../../lib/logger.js';

// Lazy-initialized Stripe client (only created when needed)
let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (!isStripeConfigured()) {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(STRIPE_CONFIG.secretKey, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
  }
  return stripeClient;
}

export interface RevenueStats {
  totalRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  currency: string;
}

export interface UserStats {
  total: number;
  byTier: {
    FREE: number;
    PRO: number;
    BUSINESS: number;
    ENTERPRISE: number;
  };
  newThisMonth: number;
}

export interface UsageStats {
  screenshots: {
    total: number;
    thisMonth: number;
  };
  pdfs: {
    total: number;
    thisMonth: number;
  };
  apiKeys: {
    total: number;
    active: number;
  };
}

export interface GrowthMetrics {
  newUsersThisMonth: number;
  newUsersLastMonth: number;
  growthPercentage: number;
  screenshotsThisMonth: number;
  pdfsThisMonth: number;
}

export interface Statistics {
  revenue: RevenueStats;
  users: UserStats;
  usage: UsageStats;
  growth: GrowthMetrics;
}

export class AdminStatsService {
  /**
   * Get revenue statistics from Stripe
   * Uses paid invoices for subscription revenue tracking
   */
  async getRevenueStats(): Promise<RevenueStats> {
    try {
      const stripe = getStripeClient();

      // If Stripe is not configured, return zeros
      if (!stripe) {
        logger.warn('Stripe not configured - returning zero revenue stats');
        return {
          totalRevenue: 0,
          monthlyRevenue: 0,
          yearlyRevenue: 0,
          currency: 'USD',
        };
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      // Get all paid invoices (for subscription revenue)
      const allInvoices = await stripe.invoices.list({
        limit: 100,
        status: 'paid',
      });

      // Debug: Log invoice details
      logger.info({
        invoiceCount: allInvoices.data.length,
        invoices: allInvoices.data.map(inv => ({
          id: inv.id,
          status: inv.status,
          amount_paid: inv.amount_paid,
          amount_due: inv.amount_due,
          total: inv.total,
          subtotal: inv.subtotal,
          currency: inv.currency,
        })),
      }, 'Invoice details from Stripe');

      // Calculate total revenue from paid invoices
      let totalRevenue = 0;
      for (const invoice of allInvoices.data) {
        // Use total if amount_paid is 0 (some Stripe versions)
        totalRevenue += invoice.amount_paid || invoice.total || 0;
      }

      // Get monthly invoices
      const monthlyInvoices = await stripe.invoices.list({
        limit: 100,
        status: 'paid',
        created: {
          gte: Math.floor(startOfMonth.getTime() / 1000),
        },
      });

      let monthlyRevenue = 0;
      for (const invoice of monthlyInvoices.data) {
        monthlyRevenue += invoice.amount_paid || invoice.total || 0;
      }

      // Get yearly invoices
      const yearlyInvoices = await stripe.invoices.list({
        limit: 100,
        status: 'paid',
        created: {
          gte: Math.floor(startOfYear.getTime() / 1000),
        },
      });

      let yearlyRevenue = 0;
      for (const invoice of yearlyInvoices.data) {
        yearlyRevenue += invoice.amount_paid || invoice.total || 0;
      }

      const result = {
        totalRevenue: totalRevenue / 100, // Convert from cents to dollars
        monthlyRevenue: monthlyRevenue / 100,
        yearlyRevenue: yearlyRevenue / 100,
        currency: 'USD',
      };

      logger.info({
        totalInvoices: allInvoices.data.length,
        monthlyInvoices: monthlyInvoices.data.length,
        yearlyInvoices: yearlyInvoices.data.length,
        result,
      }, 'Revenue stats fetched from Stripe invoices');

      return result;
    } catch (error) {
      // Log the error for debugging
      logger.error({ error }, 'Failed to fetch revenue stats from Stripe');
      // If Stripe API fails, return zeros
      return {
        totalRevenue: 0,
        monthlyRevenue: 0,
        yearlyRevenue: 0,
        currency: 'USD',
      };
    }
  }

  /**
   * Get user statistics by tier
   */
  async getUserStats(): Promise<UserStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, tierDistribution, newThisMonth] = await Promise.all([
      prisma.account.count(),
      prisma.account.groupBy({
        by: ['tier'],
        _count: { tier: true },
      }),
      prisma.account.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
    ]);

    const byTier = {
      FREE: 0,
      PRO: 0,
      BUSINESS: 0,
      ENTERPRISE: 0,
    };

    for (const item of tierDistribution) {
      byTier[item.tier as keyof typeof byTier] = item._count.tier;
    }

    return {
      total,
      byTier,
      newThisMonth,
    };
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<UsageStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalScreenshots,
      screenshotsThisMonth,
      totalPdfs,
      pdfsThisMonth,
      totalApiKeys,
      activeApiKeys,
    ] = await Promise.all([
      prisma.screenshot.count(),
      prisma.screenshot.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
      prisma.pdf.count(),
      prisma.pdf.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
      prisma.apiKey.count(),
      prisma.apiKey.count({
        where: {
          isActive: true,
        },
      }),
    ]);

    return {
      screenshots: {
        total: totalScreenshots,
        thisMonth: screenshotsThisMonth,
      },
      pdfs: {
        total: totalPdfs,
        thisMonth: pdfsThisMonth,
      },
      apiKeys: {
        total: totalApiKeys,
        active: activeApiKeys,
      },
    };
  }

  /**
   * Get growth metrics
   */
  async getGrowthMetrics(): Promise<GrowthMetrics> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      newUsersThisMonth,
      newUsersLastMonth,
      screenshotsThisMonth,
      pdfsThisMonth,
    ] = await Promise.all([
      prisma.account.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
      prisma.account.count({
        where: {
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),
      prisma.screenshot.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
      prisma.pdf.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
    ]);

    let growthPercentage = 0;
    if (newUsersLastMonth > 0) {
      growthPercentage = Math.round(
        ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
      );
    } else if (newUsersThisMonth > 0) {
      growthPercentage = 100;
    }

    return {
      newUsersThisMonth,
      newUsersLastMonth,
      growthPercentage,
      screenshotsThisMonth,
      pdfsThisMonth,
    };
  }

  /**
   * Get all statistics combined
   */
  async getStatistics(): Promise<Statistics> {
    const [revenue, users, usage, growth] = await Promise.all([
      this.getRevenueStats(),
      this.getUserStats(),
      this.getUsageStats(),
      this.getGrowthMetrics(),
    ]);

    return {
      revenue,
      users,
      usage,
      growth,
    };
  }
}

/**
 * Singleton instance
 */
export const adminStatsService = new AdminStatsService();
