import { prismaRead } from '@shared/database';
import { getPaymentClient } from '../utils/payment-client';
import { logger } from '../config/logger';

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

    const cardPayment = await getPaymentClient().initiateCardPayment({
      orderId,
      amount: Math.round(priceUSD * 100), // Convert to cents for africnc-pay
      email: customerEmail,
      description: `Template purchase: ${template.code}`,
      metadata: {
        accountId,
        paymentType: 'template_purchase',
        templateId,
        appId,
      },
    });

    logger.info(
      { accountId, templateId, appId, amountUSD: priceUSD, orderId, pcode: cardPayment.pcode },
      'Template card payment initiated (ITEC PesaPal)'
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
