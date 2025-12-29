// Subscription Service - Business Logic for Subscription Management

import { Tier, SubscriptionStatus, Subscription } from '@prisma/client';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { stripeService } from './stripe.service.js';
import { getRequestsForTier } from '../../config/stripe.config.js';

export class SubscriptionService {
  /**
   * Get active subscription for account
   * @param accountId - Account ID
   * @returns Subscription or null
   */
  async getSubscription(accountId: string): Promise<Subscription | null> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        accountId,
        status: {
          in: ['ACTIVE', 'TRIALING', 'PAST_DUE'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return subscription;
  }

  /**
   * Create or update subscription from Stripe event
   * @param stripeSubscription - Stripe subscription object
   */
  async syncSubscription(stripeSubscription: Stripe.Subscription): Promise<void> {
    try {
      const accountId = stripeSubscription.metadata.accountId;
      const tier = stripeSubscription.metadata.tier as Tier;

      if (!accountId || !tier) {
        throw new Error('Missing accountId or tier in subscription metadata');
      }

      // Map Stripe status to our enum
      const status = this.mapStripeStatus(stripeSubscription.status);

      // Upsert subscription
      await prisma.subscription.upsert({
        where: {
          stripeSubscriptionId: stripeSubscription.id,
        },
        create: {
          accountId,
          stripeSubscriptionId: stripeSubscription.id,
          stripePriceId: stripeSubscription.items.data[0].price.id,
          status,
          tier,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt: stripeSubscription.canceled_at
            ? new Date(stripeSubscription.canceled_at * 1000)
            : null,
          metadata: stripeSubscription.metadata as Record<string, unknown>,
        },
        update: {
          status,
          tier,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt: stripeSubscription.canceled_at
            ? new Date(stripeSubscription.canceled_at * 1000)
            : null,
          metadata: stripeSubscription.metadata as Record<string, unknown>,
        },
      });

      // Update account tier and credits if subscription is active
      if (status === 'ACTIVE' || status === 'TRIALING') {
        await this.updateAccountTier(accountId, tier);
      }

      logger.info(
        { accountId, tier, status, subscriptionId: stripeSubscription.id },
        'Subscription synced'
      );
    } catch (error) {
      logger.error({ error, subscriptionId: stripeSubscription.id }, 'Failed to sync subscription');
      throw error;
    }
  }

  /**
   * Update account tier and reset credits
   * @param accountId - Account ID
   * @param tier - New tier
   */
  async updateAccountTier(accountId: string, tier: Tier): Promise<void> {
    const monthlyCredits = getRequestsForTier(tier);

    await prisma.account.update({
      where: { id: accountId },
      data: {
        tier,
        monthlyCredits,
        usedCredits: 0,
        lastResetAt: new Date(),
      },
    });

    logger.info({ accountId, tier, monthlyCredits }, 'Account tier updated');
  }

  /**
   * Cancel subscription
   * @param accountId - Account ID
   * @param immediately - Cancel immediately or at period end
   */
  async cancelSubscription(accountId: string, immediately = false): Promise<void> {
    try {
      const subscription = await this.getSubscription(accountId);

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Cancel in Stripe
      await stripeService.cancelStripeSubscription(
        subscription.stripeSubscriptionId,
        immediately
      );

      // Update local subscription
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: !immediately,
          canceledAt: immediately ? new Date() : null,
          status: immediately ? 'CANCELED' : subscription.status,
        },
      });

      // If immediate cancellation, downgrade to FREE tier
      if (immediately) {
        await this.updateAccountTier(accountId, 'FREE');
      }

      logger.info(
        { accountId, subscriptionId: subscription.id, immediately },
        'Subscription canceled'
      );
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to cancel subscription');
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Handle subscription deleted event
   * @param stripeSubscription - Stripe subscription object
   */
  async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    try {
      const accountId = stripeSubscription.metadata.accountId;

      if (!accountId) {
        throw new Error('Missing accountId in subscription metadata');
      }

      // Update subscription status
      await prisma.subscription.update({
        where: {
          stripeSubscriptionId: stripeSubscription.id,
        },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
        },
      });

      // Downgrade account to FREE tier
      await this.updateAccountTier(accountId, 'FREE');

      logger.info({ accountId, subscriptionId: stripeSubscription.id }, 'Subscription deleted');
    } catch (error) {
      logger.error({ error, subscriptionId: stripeSubscription.id }, 'Failed to handle subscription deletion');
      throw error;
    }
  }

  /**
   * Handle subscription updated event
   * @param stripeSubscription - Stripe subscription object
   */
  async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<void> {
    await this.syncSubscription(stripeSubscription);
  }

  /**
   * Handle successful payment
   * @param invoice - Stripe invoice object
   */
  async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
      if (!invoice.subscription) {
        return;
      }

      const subscription = await stripeService.getStripeSubscription(
        invoice.subscription as string
      );

      await this.syncSubscription(subscription);

      logger.info(
        { subscriptionId: subscription.id, invoiceId: invoice.id },
        'Payment succeeded - subscription updated'
      );
    } catch (error) {
      logger.error({ error, invoiceId: invoice.id }, 'Failed to handle invoice payment');
      throw error;
    }
  }

  /**
   * Handle failed payment
   * @param invoice - Stripe invoice object
   */
  async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      if (!invoice.subscription) {
        return;
      }

      const subscription = await stripeService.getStripeSubscription(
        invoice.subscription as string
      );

      // Update subscription status
      await prisma.subscription.update({
        where: {
          stripeSubscriptionId: subscription.id,
        },
        data: {
          status: 'PAST_DUE',
        },
      });

      logger.warn(
        { subscriptionId: subscription.id, invoiceId: invoice.id },
        'Payment failed - subscription marked as past due'
      );
    } catch (error) {
      logger.error({ error, invoiceId: invoice.id }, 'Failed to handle payment failure');
      throw error;
    }
  }

  /**
   * Map Stripe subscription status to our enum
   * @param stripeStatus - Stripe status
   * @returns Our SubscriptionStatus enum
   */
  private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      incomplete: 'INCOMPLETE',
      incomplete_expired: 'INCOMPLETE_EXPIRED',
      trialing: 'TRIALING',
      unpaid: 'UNPAID',
      paused: 'UNPAID', // Map paused to unpaid
    };

    return statusMap[stripeStatus] || 'CANCELED';
  }

  /**
   * Get subscription details with Stripe sync
   * @param accountId - Account ID
   * @returns Subscription with latest Stripe data
   */
  async getSubscriptionWithSync(accountId: string): Promise<Subscription | null> {
    const subscription = await this.getSubscription(accountId);

    if (!subscription) {
      return null;
    }

    try {
      // Sync with Stripe to get latest data
      const stripeSubscription = await stripeService.getStripeSubscription(
        subscription.stripeSubscriptionId
      );
      await this.syncSubscription(stripeSubscription);

      // Return updated subscription
      return await this.getSubscription(accountId);
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to sync subscription with Stripe');
      // Return cached subscription on error
      return subscription;
    }
  }
}

export const subscriptionService = new SubscriptionService();
