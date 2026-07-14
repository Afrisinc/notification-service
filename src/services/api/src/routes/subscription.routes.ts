import { FastifyInstance } from 'fastify';
import { subscriptionController } from '../controllers/subscription.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import {
  GetSubscriptionDetailsSchema,
  GetPlansSchema,
  ChangePlanSchema,
  CancelSubscriptionSchema,
  PauseSubscriptionSchema,
  ResumeSubscriptionSchema,
  InitSubscriptionPaymentSchema,
  CheckCardPaymentStatusSchema,
} from '../schemas/routes/subscription.schema';

/**
 * Subscription management routes
 */
export async function registerSubscriptionRoutes(fastify: FastifyInstance) {
  // Get subscription details (protected)
  fastify.get(
    '/subscriptions/current',
    { onRequest: [validateBaseToken], schema: GetSubscriptionDetailsSchema },
    asyncWrapper(subscriptionController.getSubscriptionDetails.bind(subscriptionController))
  );

  // Get available plans (public)
  fastify.get(
    '/subscriptions/plans',
    { schema: GetPlansSchema },
    asyncWrapper(subscriptionController.getAvailablePlans.bind(subscriptionController))
  );

  // Change plan (protected)
  fastify.put(
    '/subscriptions/plan',
    { onRequest: [validateBaseToken], schema: ChangePlanSchema },
    asyncWrapper(subscriptionController.changePlan.bind(subscriptionController))
  );

  // Cancel subscription (protected)
  fastify.post(
    '/subscriptions/cancel',
    { onRequest: [validateBaseToken], schema: CancelSubscriptionSchema },
    asyncWrapper(subscriptionController.cancelSubscription.bind(subscriptionController))
  );

  // Pause subscription (protected)
  fastify.post(
    '/subscriptions/pause',
    { onRequest: [validateBaseToken], schema: PauseSubscriptionSchema },
    asyncWrapper(subscriptionController.pauseSubscription.bind(subscriptionController))
  );

  // Resume subscription (protected)
  fastify.post(
    '/subscriptions/resume',
    { onRequest: [validateBaseToken], schema: ResumeSubscriptionSchema },
    asyncWrapper(subscriptionController.resumeSubscription.bind(subscriptionController))
  );

  /**
   * POST /api/subscriptions/payment/init
   * Initiates card payment for subscription upgrade via ITEC PesaPal.
   * Body: { planId, billingCycle, customerEmail }
   * Returns: { checkoutUrl, pcode, orderId, amountUSD, planName, validUntil }
   */
  fastify.post(
    '/subscriptions/payment/init',
    { onRequest: [validateBaseToken], schema: InitSubscriptionPaymentSchema },
    asyncWrapper(subscriptionController.initSubscriptionPayment.bind(subscriptionController))
  );

  /**
   * GET /api/subscriptions/payment/status/:pcode
   * Check payment status by reference (PCODE for card, ref for mobile)
   * Auto-detects payment type and polls status directly from afrisinc-pay
   * Fallback endpoint if webhook delivery is delayed or fails
   */
  fastify.get(
    '/subscriptions/payment/status/:pcode',
    { onRequest: [validateBaseToken], schema: CheckCardPaymentStatusSchema },
    asyncWrapper(subscriptionController.checkCardPaymentStatus.bind(subscriptionController))
  );

  // ── Trial Subscription Flow (SetupIntent) ───────────────────────────────────

  /**
   * POST /api/subscriptions/setup-intent
   * Step 1 (authenticated): Create Stripe Customer + SetupIntent for an
   * existing account (e.g. org creation, plan upgrade).
   * Body: { email: string; name?: string }
   * Returns: { customerId, clientSecret, setupIntentId }
   */
  fastify.post(
    '/subscriptions/setup-intent',
    { onRequest: [validateBaseToken] },
    asyncWrapper(subscriptionController.createSetupIntent.bind(subscriptionController))
  );

  /**
   * POST /api/subscriptions/setup-intent/anonymous
   * Step 1 (public, no auth): Create Stripe Customer + SetupIntent during
   * the signup flow — before the account exists.
   * Body: { email: string; name?: string }
   * Returns: { customerId, clientSecret, setupIntentId }
   */
  fastify.post(
    '/subscriptions/setup-intent/anonymous',
    // No onRequest — public endpoint for pre-signup card saving
    asyncWrapper(subscriptionController.createAnonymousSetupIntent.bind(subscriptionController))
  );

  /**
   * POST /api/subscriptions/activate
   * Step 2: Create Stripe Subscription after frontend confirms card.
   * Body: { planId, billingCycle, paymentMethodId, customerId }
   */
  fastify.post(
    '/subscriptions/activate',
    { onRequest: [validateBaseToken] },
    asyncWrapper(subscriptionController.activateTrialSubscription.bind(subscriptionController))
  );

  // ========================
  // Dashboard Endpoints
  // ========================

  // Get usage dashboard (protected)
  fastify.get(
    '/subscriptions/dashboard/usage',
    { onRequest: [validateBaseToken] },
    asyncWrapper(subscriptionController.getUsageDashboard.bind(subscriptionController))
  );

  // Get usage breakdown by metric (protected)
  fastify.get(
    '/subscriptions/dashboard/breakdown',
    { onRequest: [validateBaseToken] },
    asyncWrapper(subscriptionController.getUsageBreakdown.bind(subscriptionController))
  );

  // Check feature availability (protected)
  fastify.get(
    '/subscriptions/features/check',
    { onRequest: [validateBaseToken] },
    asyncWrapper(subscriptionController.checkFeatureAvailability.bind(subscriptionController))
  );

  // Get upgrade recommendations (protected)
  fastify.get(
    '/subscriptions/recommendations/upgrade',
    { onRequest: [validateBaseToken] },
    asyncWrapper(subscriptionController.getUpgradeRecommendations.bind(subscriptionController))
  );
}
