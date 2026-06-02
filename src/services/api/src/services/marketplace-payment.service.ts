import { prismaRead } from '@shared/database';
import { getPaymentClient } from '../utils/payment-client';
import { logger } from '../config/logger';

export class MarketplacePaymentService {
  /**
   * Create a Stripe Payment Intent for a paid marketplace template.
   *
   * After Stripe confirms on the client, afrisinc-pay fires the merchant
   * webhook → /internal/payment-event → installs the template to the app.
   *
   * @param accountId   Buyer's account ID
   * @param templateId  Marketplace template ID
   * @param appId       Destination app to install into after payment
   * @param customerEmail  For Stripe receipt
   */
  static async initPayment(
    accountId: string,
    templateId: string,
    appId: string,
    customerEmail: string,
  ) {
    const template = await prismaRead.template.findFirst({
      where: {
        id: templateId,
        visibility: 'marketplace',
        is_public: true,
      },
      select: { id: true, code: true, price: true },
    });

    if (!template) {
      throw Object.assign(new Error('Template not found'), { statusCode: 404 });
    }

    const priceUSD = Number(template.price ?? 0);

    if (priceUSD <= 0) {
      throw Object.assign(
        new Error('This is a free template — no payment required'),
        { statusCode: 422 },
      );
    }

    const amountCents = Math.round(priceUSD * 100);
    const orderId = `tpl_${accountId}_${templateId}_${Date.now()}`;

    const intent = await getPaymentClient().createPaymentIntent({
      amount: amountCents,
      currency: 'USD',
      orderId,
      customerEmail,
      metadata: {
        accountId,
        paymentType: 'template',
        templateId,
        appId,
      },
    });

    logger.info(
      { accountId, templateId, appId, amountCents, orderId },
      'Template payment intent created',
    );

    return {
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.id,
      orderId,
      amountCents,
      templateName: template.code,
    };
  }
}
