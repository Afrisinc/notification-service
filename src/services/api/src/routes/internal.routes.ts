import crypto from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { provisioning } from '../controllers/provisioning.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { PaygService } from '../services/payg.service';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Verifies afrisinc-pay's Stripe-style signature header:
 * X-Afrisinc-Signature: t=<timestamp>,v1=<HMAC-SHA256(timestamp.body)>
 */
function verifyAfrisincSignature(secret: string, rawBody: string, header: string | undefined): boolean {
  if (!header) return false;
  try {
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
    const timestamp = parts['t'];
    const v1 = parts['v1'];
    if (!timestamp || !v1) return false;
    const signed = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function registerInternalRoutes(fastify: FastifyInstance) {
  fastify.post('/provision', { schema: { hide: true } }, asyncWrapper(provisioning.provision.bind(provisioning)));

  /**
   * POST /internal/payment-event
   * Called by afrisinc-pay after Stripe confirms payment.
   * Verified via X-Afrisinc-Signature: t=<ts>,v1=<HMAC-SHA256(ts.body)>
   * Credits the PAYG balance for the accountId stored in payment metadata.
   */
  fastify.post('/payment-event', { schema: { hide: true } }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!env.AFRISINC_PAY_WEBHOOK_SECRET) {
      logger.error('AFRISINC_PAY_WEBHOOK_SECRET not configured');
      return reply.status(500).send({ error: 'Webhook secret not configured' });
    }

    const signature = req.headers['x-afrisinc-signature'] as string | undefined;
    const rawBody = JSON.stringify(req.body);

    if (!verifyAfrisincSignature(env.AFRISINC_PAY_WEBHOOK_SECRET, rawBody, signature)) {
      logger.warn({ signature }, 'payment-event invalid signature');
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // afrisinc-pay sends: { event, timestamp, data: { paymentId, orderId, amount, status, metadata } }
    const body = req.body as {
      event: string;
      timestamp: string;
      data: {
        paymentId: string;
        orderId: string;
        amount: number;
        currency: string;
        status: string;
        customerEmail?: string;
        metadata?: Record<string, unknown>;
      };
    };

    if (body.event !== 'payment.succeeded') {
      return reply.status(200).send({ ok: true, skipped: true });
    }

    const { data } = body;
    const accountId = data.metadata?.['accountId'] as string | undefined;
    if (!accountId) {
      logger.warn({ paymentId: data.paymentId }, 'payment-event missing accountId in metadata');
      return reply.status(422).send({ error: 'Missing accountId in metadata' });
    }

    const paymentType = data.metadata?.['paymentType'] as string | undefined;

    // ── Template purchase ─────────────────────────────────────────────────────
    if (paymentType === 'template') {
      const templateId = data.metadata?.['templateId'] as string | undefined;
      const appId = data.metadata?.['appId'] as string | undefined;
      if (!templateId || !appId) {
        logger.warn({ paymentId: data.paymentId }, 'payment-event template missing templateId or appId');
        return reply.status(422).send({ error: 'Missing templateId or appId in metadata' });
      }
      try {
        const { marketplaceService } = await import('../services/marketplace.service');
        await marketplaceService.installTemplate(templateId, appId, accountId, {});
        logger.info({ accountId, templateId, appId, paymentId: data.paymentId }, 'Template installed from payment');
        return reply.status(200).send({ ok: true });
      } catch (err) {
        logger.error({ err, accountId, templateId, appId, paymentId: data.paymentId }, 'Failed to install template from payment');
        return reply.status(500).send({ error: 'Failed to install template' });
      }
    }

    // ── Subscription upgrade ──────────────────────────────────────────────────
    if (paymentType === 'subscription') {
      const planId = data.metadata?.['planId'] as string | undefined;
      const billingCycle = (data.metadata?.['billingCycle'] as string | undefined) ?? 'monthly';
      if (!planId) {
        logger.warn({ paymentId: data.paymentId }, 'payment-event subscription missing planId');
        return reply.status(422).send({ error: 'Missing planId in metadata' });
      }
      try {
        await SubscriptionRepository.activateFromPayment(
          accountId,
          planId,
          billingCycle as 'monthly' | 'yearly',
        );
        logger.info({ accountId, planId, billingCycle, paymentId: data.paymentId }, 'Subscription activated from payment');
        return reply.status(200).send({ ok: true });
      } catch (err) {
        logger.error({ err, accountId, planId, paymentId: data.paymentId }, 'Failed to activate subscription plan');
        return reply.status(500).send({ error: 'Failed to activate plan' });
      }
    }

    // ── PAYG top-up (default) ─────────────────────────────────────────────────
    try {
      await PaygService.creditFromPayment({
        accountId,
        amountCents: data.amount,
        paymentRef: data.paymentId,
      });

      logger.info({ accountId, paymentId: data.paymentId, amount: data.amount }, 'PAYG balance credited from payment');
      return reply.status(200).send({ ok: true });
    } catch (err) {
      logger.error({ err, accountId, paymentId: data.paymentId }, 'Failed to credit PAYG balance');
      return reply.status(500).send({ error: 'Failed to credit balance' });
    }
  });
}
