import { prismaRead } from '@shared/database';
import { getPaymentClient } from '../utils/payment-client';
import { logger } from '../config/logger';
import { convertUsdToRwf } from '../utils/exchange-rate';

export interface MarketplacePaymentInitResult {
  checkoutUrl: string;
  pcode: string;
  orderId: string;
  amountUSD: number;
  templateName: string;
}

export class MarketplacePaymentService {
  /**
   * Initiate card payment for template purchase via ITEC PesaPal (africnc-pay).
   *
   * Converts USD amount to RWF before sending to payment provider.
   * Returns checkout URL for customer to complete payment.
   * After payment is confirmed, africnc-pay fires webhook → installs the template to the app.
   *
   * @param accountId   Buyer's account ID
   * @param templateId  Marketplace template ID
   * @param appId       Destination app to install into after payment
   * @param customerEmail  For PesaPal receipt
   */
  static async initPayment(
    accountId: string,
    templateId: string,
    appId: string,
    customerEmail: string
  ): Promise<MarketplacePaymentInitResult> {
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
      throw Object.assign(new Error('This is a free template — no payment required'), { statusCode: 422 });
    }

    const orderId = `tpl_${accountId}_${templateId}_${Date.now()}`;

    // Convert USD to RWF for PesaPal
    const priceRwf = await convertUsdToRwf(priceUSD);
    const amountCents = Math.round(priceRwf * 100);

    const cardPayment = await getPaymentClient().initiateCardPayment({
      orderId,
      amount: amountCents,
      email: customerEmail,
      currency: 'RWF', // PesaPal charges in RWF for Rwanda
      description: `Template purchase: ${template.code} ($${priceUSD} USD ≈ ${priceRwf} RWF)`,
      metadata: {
        accountId,
        paymentType: 'template_purchase',
        templateId,
        appId,
        amountUSD: priceUSD.toString(),
        amountRWF: priceRwf.toString(),
      },
    });

    logger.info(
      { accountId, templateId, appId, amountUSD: priceUSD, amountRWF: priceRwf, orderId, pcode: cardPayment.pcode },
      'Template card payment initiated (ITEC PesaPal) — converted USD to RWF'
    );

    return {
      checkoutUrl: cardPayment.checkoutUrl,
      pcode: cardPayment.pcode,
      orderId,
      amountUSD: priceUSD,
      templateName: template.code,
    };
  }
}
