import { FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionService } from '../services/subscription.service';
import { SubscriptionPaymentService } from '../services/subscription-payment.service';
import { TrialSubscriptionService } from '../services/trial-subscription.service';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { ApiResponseHelper } from '../utils/api-response';
import { logger } from '../config/logger';

export class SubscriptionController {
  /**
   * Get current subscription and usage details
   */
  async getSubscriptionDetails(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const subscription = await SubscriptionService.getSubscriptionDetails(accountId);

      logger.info({ accountId, correlationId: request.id }, 'Subscription details retrieved');

      return ApiResponseHelper.success(reply, 'Subscription details retrieved', subscription);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get subscription details');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, 'Subscription not found');
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Get all available plans
   */
  async getAvailablePlans(request: FastifyRequest, reply: FastifyReply) {
    try {
      const plans = await SubscriptionService.getAvailablePlans();

      logger.debug({ correlationId: request.id }, 'Plans retrieved');

      return ApiResponseHelper.successList(reply, 'Available plans', plans, { total: plans.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get plans');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Change plan (upgrade/downgrade)
   */
  async changePlan(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      const { planId, planName } = request.body as { planId?: string; planName?: string };

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      let resolvedPlanId = planId;
      if (!resolvedPlanId && planName) {
        const plan = await SubscriptionRepository.getPlanByName(planName.toUpperCase());
        if (!plan) return ApiResponseHelper.notFound(reply, `Plan '${planName}' not found`);
        resolvedPlanId = plan.id;
      }

      if (!resolvedPlanId) {
        return ApiResponseHelper.badRequest(reply, 'planId or planName is required');
      }

      const result = await SubscriptionService.changePlan(accountId, resolvedPlanId);

      logger.info({ accountId, planId, correlationId: request.id }, 'Plan changed');

      return ApiResponseHelper.success(reply, result.message, { plan: result.plan });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to change plan');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, 'Plan not found');
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const result = await SubscriptionService.cancelSubscription(accountId);

      logger.info({ accountId, correlationId: request.id }, 'Subscription cancelled');

      return ApiResponseHelper.success(reply, result.message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to cancel subscription');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const result = await SubscriptionService.pauseSubscription(accountId);

      logger.info({ accountId, correlationId: request.id }, 'Subscription paused');

      return ApiResponseHelper.success(reply, result.message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to pause subscription');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const result = await SubscriptionService.resumeSubscription(accountId);

      logger.info({ accountId, correlationId: request.id }, 'Subscription resumed');

      return ApiResponseHelper.success(reply, result.message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to resume subscription');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Get usage dashboard with limits and remaining
   */
  async getUsageDashboard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const usageData = await UsageTrackingService.getUsageWithLimits(accountId);

      if (!usageData) {
        return ApiResponseHelper.notFound(reply, 'Subscription not found');
      }

      logger.info({ accountId, correlationId: request.id }, 'Usage dashboard retrieved');

      return ApiResponseHelper.success(reply, 'Usage dashboard retrieved', usageData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get usage dashboard');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Get detailed usage breakdown by metric
   */
  async getUsageBreakdown(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      const { startDate, endDate } = request.query as {
        startDate?: string;
        endDate?: string;
      };

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      // Calculate period
      const now = new Date();
      const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = endDate ? new Date(endDate) : now;

      const usage = await UsageTrackingService.getUsageSummary(accountId, start, end);

      // Get limits for comparison
      const subscription2 = await SubscriptionService.getSubscriptionDetails(accountId);

      const breakdown = {
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        metrics: Object.entries(usage).map(([metric, used]) => ({
          metric,
          used,
          limit: subscription2.limits.find((l) => l.metric === metric)?.limit || 'Unlimited',
          percentage:
            typeof subscription2.limits.find((l) => l.metric === metric)?.limit === 'number'
              ? Math.round((used / (subscription2.limits.find((l) => l.metric === metric)?.limit as number)) * 100)
              : 0,
        })),
      };

      logger.info({ accountId, correlationId: request.id }, 'Usage breakdown retrieved');

      return ApiResponseHelper.success(reply, 'Usage breakdown retrieved', breakdown);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get usage breakdown');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Check if feature is available for current plan
   */
  async checkFeatureAvailability(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      const { feature } = request.query as { feature: string };

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      if (!feature) {
        return ApiResponseHelper.badRequest(reply, 'feature parameter is required');
      }

      const subscription = await SubscriptionService.getSubscriptionDetails(accountId);

      // Feature availability mapping
      const featureAvailability: Record<string, boolean> = {
        custom_domain: subscription.limits.some((l) => l.metric === 'custom_domain' && l.limit !== 0),
        advanced_analytics: subscription.limits.some((l) => l.metric === 'advanced_analytics' && l.limit !== 0),
        webhooks: subscription.limits.some(
          (l) => l.metric === 'webhooks' && typeof l.limit === 'number' && l.limit > 0
        ),
        team_management: subscription.limits.some(
          (l) => l.metric === 'team_members' && typeof l.limit === 'number' && l.limit > 1
        ),
        api_keys: subscription.limits.some(
          (l) => l.metric === 'api_keys' && typeof l.limit === 'number' && l.limit > 0
        ),
      };

      const isAvailable = featureAvailability[feature] ?? false;

      logger.info(
        { accountId, feature, available: isAvailable, correlationId: request.id },
        'Feature availability checked'
      );

      return ApiResponseHelper.success(reply, 'Feature availability retrieved', {
        feature,
        available: isAvailable,
        plan: subscription.plan,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to check feature availability');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Get upgrade recommendations based on current usage
   */
  async getUpgradeRecommendations(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const subscription = await SubscriptionService.getSubscriptionDetails(accountId);
      const currentPlan = subscription.plan;
      const availablePlans = await SubscriptionService.getAvailablePlans();

      // Find metrics that are close to limit (>80%)
      const limitedMetrics = subscription.limits
        .filter((l) => typeof l.limit === 'number' && l.limit > 0)
        .filter((l) => {
          const percentage = typeof l.percentage === 'number' ? l.percentage : 0;
          return percentage >= 80;
        });

      // Find next tier plan
      const planHierarchy = ['FREE', 'PRO', 'ENTERPRISE'];
      const currentIndex = planHierarchy.indexOf(currentPlan);
      const recommendedPlan =
        currentIndex < planHierarchy.length - 1
          ? availablePlans.find((p) => p.name === planHierarchy[currentIndex + 1])
          : null;

      const recommendations = {
        currentPlan,
        needsUpgrade: limitedMetrics.length > 0,
        limitedMetrics: limitedMetrics.map((l) => ({
          metric: l.metric,
          used: l.used,
          limit: l.limit,
          percentage: l.percentage,
        })),
        recommendedPlan: recommendedPlan
          ? {
              name: recommendedPlan.name,
              priceMonthly: recommendedPlan.priceMonthly,
              priceYearly: recommendedPlan.priceYearly,
              improvements: recommendedPlan.limits
                .filter((l) => {
                  const currentLimit = subscription.limits.find((cl) => cl.metric === l.metric)?.limit;
                  return l.limit !== currentLimit;
                })
                .map((l) => ({
                  metric: l.metric,
                  current: subscription.limits.find((cl) => cl.metric === l.metric)?.limit,
                  upgraded: l.limit,
                })),
            }
          : null,
      };

      logger.info(
        { accountId, needsUpgrade: recommendations.needsUpgrade, correlationId: request.id },
        'Upgrade recommendations retrieved'
      );

      return ApiResponseHelper.success(reply, 'Upgrade recommendations retrieved', recommendations);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get recommendations');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * POST /api/subscriptions/payment/init
   * Create a Stripe Payment Intent for a plan upgrade.
   * Returns clientSecret for Stripe.js to confirm on the client.
   */
  async initSubscriptionPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const { planId, billingCycle, customerEmail } = request.body as {
        planId: string;
        billingCycle: 'monthly' | 'yearly';
        customerEmail: string;
      };

      if (!planId || !billingCycle || !customerEmail) {
        return ApiResponseHelper.badRequest(reply, 'planId, billingCycle, and customerEmail are required');
      }

      const result = await SubscriptionPaymentService.initPayment(accountId, planId, billingCycle, customerEmail);

      logger.info({ accountId, planId, billingCycle, correlationId: request.id }, 'Subscription payment init');

      return ApiResponseHelper.success(reply, 'Payment intent created', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = (error as any)?.statusCode;

      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to init subscription payment');

      if (statusCode === 404) return ApiResponseHelper.notFound(reply, errorMessage);
      if (statusCode === 422) return ApiResponseHelper.badRequest(reply, errorMessage);
      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  // ── Trial SetupIntent flow ──────────────────────────────────────────────────

  /**
   * POST /api/subscriptions/setup-intent
   * Step 1 of the trial subscription flow.
   *
   * Creates (or retrieves) a Stripe Customer for this account and returns a
   * SetupIntent clientSecret. The frontend calls stripe.confirmCardSetup(clientSecret)
   * to save the card for future off-session charges.
   *
   * Body: { email: string; name?: string }
   * Returns: { customerId, clientSecret, setupIntentId }
   */
  async createSetupIntent(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const { email, name } = request.body as { email: string; name?: string };
      if (!email?.trim()) {
        return ApiResponseHelper.badRequest(reply, 'email is required');
      }

      const result = await TrialSubscriptionService.createSetupIntent(accountId, email, name);

      logger.info({ accountId, customerId: result.customerId, correlationId: request.id }, 'SetupIntent created');

      return ApiResponseHelper.success(reply, 'Setup intent created', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to create setup intent');
      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * POST /api/subscriptions/activate
   * Step 2 of the trial subscription flow.
   *
   * Called after stripe.confirmCardSetup() succeeds on the frontend.
   * Creates the Stripe Subscription with a 14-day trial. Stripe owns
   * auto-charge, dunning, and lifecycle events from this point.
   *
   * Body: { planId, billingCycle, paymentMethodId, customerId }
   */
  async activateTrialSubscription(request: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = request.headers['x-account-id'] as string;
      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const { planId, billingCycle, paymentMethodId, customerId } = request.body as {
        planId: string;
        billingCycle: 'monthly' | 'annual';
        paymentMethodId: string; // pm_xxx from confirmCardSetup
        customerId: string; // cus_xxx from createSetupIntent
      };

      if (!planId || !billingCycle || !paymentMethodId || !customerId) {
        return ApiResponseHelper.badRequest(
          reply,
          'planId, billingCycle, paymentMethodId, and customerId are required'
        );
      }

      await TrialSubscriptionService.activateSubscription(accountId, planId, billingCycle, paymentMethodId, customerId);

      logger.info({ accountId, planId, billingCycle, correlationId: request.id }, 'Trial subscription activated');

      return ApiResponseHelper.success(reply, 'Trial subscription activated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = (error as any)?.statusCode;
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to activate trial subscription');
      if (statusCode === 404) return ApiResponseHelper.notFound(reply, errorMessage);
      if (statusCode === 422) return ApiResponseHelper.badRequest(reply, errorMessage);
      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * POST /api/subscriptions/setup-intent/anonymous  (PUBLIC — no auth)
   * Used during the signup flow before the account exists.
   * Creates a Stripe Customer + SetupIntent so the user can save their card
   * via confirmCardSetup(). The customerId is passed back through the signup
   * payload so the backend can link it to the newly-created account.
   *
   * Body: { email: string; name?: string }
   * Returns: { customerId, clientSecret, setupIntentId }
   */
  async createAnonymousSetupIntent(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email, name } = request.body as { email: string; name?: string };

      if (!email?.trim()) {
        return ApiResponseHelper.badRequest(reply, 'email is required');
      }

      const result = await TrialSubscriptionService.createAnonymousSetupIntent(email, name);

      logger.info({ setupIntentId: result.setupIntentId, correlationId: request.id }, 'Anonymous setup intent created');

      return ApiResponseHelper.success(reply, 'Setup intent created', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to create anonymous setup intent');
      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }
}

export const subscriptionController = new SubscriptionController();
