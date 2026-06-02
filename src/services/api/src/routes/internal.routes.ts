import { FastifyInstance } from 'fastify';
import { provisioning } from '../controllers/provisioning.controller';
import { paymentWebhookController } from '../controllers/payment-webhook.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';

/**
 * Internal routes for system-to-system communication
 *
 * These routes are not exposed publicly and are called by:
 * - afrisinc-pay: Payment webhook events
 * - Internal services: Provisioning, etc.
 */
export async function registerInternalRoutes(fastify: FastifyInstance) {
  /**
   * POST /internal/provision
   * Account provisioning endpoint
   */
  fastify.post('/provision', { schema: { hide: true } }, asyncWrapper(provisioning.provision.bind(provisioning)));

  /**
   * POST /internal/payment-event
   * Webhook endpoint for afrisinc-pay payment and subscription events
   *
   * Handles:
   * - payment.succeeded: One-off payments (templates, upgrades, PAYG)
   * - subscription.payment_succeeded: Stripe auto-charge success
   * - subscription.payment_failed: Stripe payment failure
   * - subscription.trial_will_end: Trial ending reminder
   * - subscription.updated: Subscription status change
   * - subscription.canceled: Subscription cancellation
   *
   * Verified via X-Afrisinc-Signature header
   */
  fastify.post(
    '/payment-event',
    { schema: { hide: true } },
    asyncWrapper(paymentWebhookController.handlePaymentEvent.bind(paymentWebhookController))
  );
}
