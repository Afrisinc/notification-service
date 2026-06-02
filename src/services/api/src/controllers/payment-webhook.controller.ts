import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { verifyAfrisincSignature } from '../utils/webhook-signature';
import { PaymentWebhookService, WebhookEventPayload } from '../services/payment-webhook.service';

/**
 * Controller for handling payment webhook events from afrisinc-pay
 *
 * Handles signature verification and delegates to PaymentWebhookService
 */
export class PaymentWebhookController {
  /**
   * Handle incoming payment/subscription webhook events
   *
   * POST /internal/payment-event
   *
   * Verified via X-Afrisinc-Signature: t=<ts>,v1=<HMAC-SHA256(ts.body)>
   *
   * Event types:
   * - payment.succeeded: One-off payments (templates, upgrades, PAYG)
   * - subscription.*: Stripe subscription lifecycle events
   */
  async handlePaymentEvent(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Validate webhook secret is configured
    if (!env.AFRISINC_PAY_WEBHOOK_SECRET) {
      logger.error('AFRISINC_PAY_WEBHOOK_SECRET not configured');
      reply.status(500).send({ error: 'Webhook secret not configured' });
      return;
    }

    // Verify signature
    const signature = request.headers['x-afrisinc-signature'] as string | undefined;
    const rawBody = JSON.stringify(request.body);

    const verification = verifyAfrisincSignature(env.AFRISINC_PAY_WEBHOOK_SECRET, rawBody, signature);

    if (!verification.valid) {
      logger.warn({ error: verification.error, correlationId: request.id }, 'Invalid webhook signature');
      reply.status(401).send({ error: verification.error || 'Invalid signature' });
      return;
    }

    // Parse and validate event payload
    const payload = request.body as WebhookEventPayload;

    if (!payload.event || !payload.data) {
      logger.warn({ correlationId: request.id }, 'Invalid webhook payload - missing event or data');
      reply.status(400).send({ error: 'Invalid payload' });
      return;
    }

    // Process the event
    const result = await PaymentWebhookService.processEvent(payload);

    if (!result.success) {
      logger.error(
        { event: payload.event, error: result.error, correlationId: request.id },
        'Webhook event processing failed'
      );
      reply.status(422).send({ error: result.error });
      return;
    }

    if (result.skipped) {
      logger.debug({ event: payload.event, correlationId: request.id }, 'Webhook event skipped');
    }

    reply.status(200).send({ ok: true, skipped: result.skipped });
  }
}

export const paymentWebhookController = new PaymentWebhookController();
