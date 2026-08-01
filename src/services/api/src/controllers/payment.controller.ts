import { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { PaymentService } from '../services/payment.service';
import { PaymentTrackingService } from '../services/payment-tracking.service';
import { getPaymentClient, PaymentClientError } from '../utils/payment-client';
import { ApiResponseHelper } from '../utils/api-response';
import type { InitializePaymentRequest } from '../types/payg.types';

const logger = pino();

const getErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : 'Unknown error');

export const paymentController = {
  async initialize(req: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = req.headers['x-account-id'] as string;
      if (!accountId) return ApiResponseHelper.unauthorized(reply, 'Account ID required');

      const body = req.body as InitializePaymentRequest;

      const result = await PaymentService.initializePayment(accountId, body);

      await PaymentTrackingService.recordPaymentInitialization({
        accountId,
        ref: result.paymentRef || result.orderId,
        orderId: result.orderId,
        method: result.method,
        amount: Math.round((body.amount || 0) * 100),
        currency: (body.currency || 'USD') as any,
        type: body.type as any,
        templateId: body.templateId,
        appId: body.appId,
        planId: body.planId,
        email: body.email,
        phoneNumber: body.phoneNumber,
        customerName: body.customerName,
        provider: result.method === 'mobile' ? 'paypack' : 'stripe',
      });

      return ApiResponseHelper.created(reply, result.message, result);
    } catch (err) {
      logger.error({ err }, 'initialize payment failed');
      const msg = getErrorMessage(err);
      const status = msg.includes('required') || msg.includes('Minimum') || msg.includes('not found') ? 400 : 500;
      return ApiResponseHelper.error(reply, msg, 4000, status);
    }
  },

  async getPaymentStatus(req: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = req.headers['x-account-id'] as string;
      if (!accountId) return ApiResponseHelper.unauthorized(reply, 'Account ID required');

      const { ref } = req.params as { ref: string };

      if (!ref?.trim()) {
        return ApiResponseHelper.error(reply, 'Payment reference (ref) is required in URL path', 4001, 400);
      }

      const paymentClient = getPaymentClient();
      const status = await paymentClient.getPaymentStatus(ref);

      logger.debug(
        { accountId, ref, transactionId: status.transaction_id, status: status.status },
        'Payment status retrieved from payment service'
      );

      // Auto-confirm and process if payment service reports SUCCESSFUL
      if (status.status === 'SUCCESSFUL') {
        const paymentRecord = await PaymentTrackingService.getPaymentByRef(ref);

        if (paymentRecord && paymentRecord.accountId === accountId && paymentRecord.status !== 'SUCCESSFUL') {
          const paymentType = paymentRecord.type;
          let result: any;
          const confirmPaymentData: any = {
            status: 'SUCCESSFUL',
            transactionId: status.transaction_id,
            processedAt: new Date(),
          };

          try {
            if (paymentType === 'template_purchase') {
              if (!paymentRecord.templateId || !paymentRecord.appId) {
                return ApiResponseHelper.error(reply, 'Template or app information missing', 4001, 400);
              }

              const { marketplaceService } = await import('../services/marketplace.service');
              await marketplaceService.installTemplate(paymentRecord.templateId, paymentRecord.appId, accountId, {});

              confirmPaymentData.appTemplateId = paymentRecord.templateId;

              logger.info(
                { accountId, ref, templateId: paymentRecord.templateId, appId: paymentRecord.appId },
                'Template installed via status check'
              );

              result = {
                transaction_id: status.transaction_id,
                status: status.status,
                amount: status.amount,
                type: 'template_purchase',
                templateId: paymentRecord.templateId,
                appId: paymentRecord.appId,
                message: 'Template installed successfully',
              };
            } else if (paymentType === 'subscription') {
              if (!paymentRecord.planId) {
                return ApiResponseHelper.error(reply, 'Plan information missing', 4001, 400);
              }

              const { SubscriptionService } = await import('../services/subscription.service');
              await SubscriptionService.changePlan(accountId, paymentRecord.planId);

              confirmPaymentData.subscriptionId = paymentRecord.planId;

              logger.info({ accountId, ref, planId: paymentRecord.planId }, 'Subscription activated via status check');

              result = {
                transaction_id: status.transaction_id,
                status: status.status,
                amount: status.amount,
                type: 'subscription',
                planId: paymentRecord.planId,
                message: 'Subscription activated successfully',
              };
            } else {
              const { PaygService } = await import('../services/payg.service');
              const paygResult = await PaygService.creditFromPayment({
                accountId,
                amountCents: status.amount,
                paymentRef: ref,
              });

              confirmPaymentData.creditTransactionId = paygResult.transaction.id;
              confirmPaymentData.newBalance = Math.round(paygResult.newBalance * 100);
              confirmPaymentData.bonusAmount = Math.round((paygResult.bonusAmount || 0) * 100);
              confirmPaymentData.bonusPercent = paygResult.bonusPercent;
              confirmPaymentData.transactionType = 'topup';

              logger.info(
                { accountId, ref, newBalance: paygResult.newBalance, creditTransactionId: paygResult.transaction.id },
                'PAYG balance credited via status check'
              );

              result = {
                transaction_id: status.transaction_id,
                status: status.status,
                amount: status.amount,
                type: 'payg_topup',
                newBalance: paygResult.newBalance,
                bonus: paygResult.bonusAmount,
              };
            }

            await PaymentTrackingService.confirmPayment(ref, confirmPaymentData);

            logger.info(
              { accountId, ref, transactionId: status.transaction_id, paymentType },
              'Payment confirmed and processed via status check'
            );

            return ApiResponseHelper.success(reply, 'Payment confirmed and processed successfully', result);
          } catch (processErr) {
            logger.error({ err: processErr, ref }, 'Failed to process payment during status check');
            throw processErr;
          }
        }
      }

      // Return current status if not SUCCESSFUL or already processed
      return ApiResponseHelper.success(reply, 'Payment status retrieved successfully', status);
    } catch (err) {
      logger.error({ err }, 'getPaymentStatus failed');
      const msg = getErrorMessage(err);

      if (err instanceof PaymentClientError) {
        if (err.code === 'INVALID_PARAM' || err.statusCode === 404) {
          return ApiResponseHelper.error(reply, msg, 4004, 404);
        }

        if (msg.includes('OPEN') || err.statusCode === 503) {
          return ApiResponseHelper.error(
            reply,
            'Payment service temporarily unavailable. Please try again in a few moments.',
            5030,
            503
          );
        }

        return ApiResponseHelper.error(reply, msg, err.statusCode || 5000, err.statusCode || 500);
      }

      return ApiResponseHelper.error(reply, msg, 5000, 500);
    }
  },

  /**
   * Admin endpoint: Initiate payment on behalf of account
   * Only admins can use this endpoint
   * Request body includes targetAccountId to specify which account to pay for
   */
  async adminInitializePayment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const adminId = req.headers['x-account-id'] as string;
      if (!adminId) return ApiResponseHelper.unauthorized(reply, 'Admin account ID required');

      const body = req.body as InitializePaymentRequest & { targetAccountId: string };

      if (!body.targetAccountId) {
        return ApiResponseHelper.error(reply, 'targetAccountId is required', 4001, 400);
      }

      if (!body.type) {
        return ApiResponseHelper.error(reply, 'type is required', 4001, 400);
      }

      if (!body.amount || body.amount <= 0) {
        return ApiResponseHelper.error(reply, 'amount must be greater than 0', 4001, 400);
      }

      if (!body.method) {
        return ApiResponseHelper.error(reply, 'method is required', 4001, 400);
      }

      const targetAccountId = body.targetAccountId;

      if (body.type === 'subscription' && !body.planId) {
        return ApiResponseHelper.error(reply, 'planId is required for subscription payments', 4001, 400);
      }

      if (body.type === 'template_purchase' && (!body.templateId || !body.appId)) {
        return ApiResponseHelper.error(reply, 'templateId and appId are required for template purchases', 4001, 400);
      }

      logger.info(
        { adminId, targetAccountId, paymentType: body.type, amount: body.amount },
        'Admin initiating payment on behalf of account'
      );

      const result = await PaymentService.initializePayment(targetAccountId, body);

      await PaymentTrackingService.recordPaymentInitialization({
        accountId: targetAccountId,
        ref: result.paymentRef || result.orderId,
        orderId: result.orderId,
        method: result.method,
        amount: Math.round((body.amount || 0) * 100),
        currency: (body.currency || 'USD') as any,
        type: body.type as any,
        templateId: body.templateId,
        appId: body.appId,
        planId: body.planId,
        email: body.email,
        phoneNumber: body.phoneNumber,
        customerName: body.customerName,
        provider: result.method === 'mobile' ? 'paypack' : 'stripe',
      });

      logger.info(
        { adminId, targetAccountId, paymentRef: result.paymentRef, amount: body.amount },
        'Admin payment initiated successfully'
      );

      return ApiResponseHelper.created(reply, `Payment initiated for account ${targetAccountId}`, {
        ...result,
        initiatedBy: 'admin',
        targetAccountId,
      });
    } catch (err) {
      logger.error({ err }, 'admin initialize payment failed');
      const msg = getErrorMessage(err);
      const status = msg.includes('required') || msg.includes('Minimum') || msg.includes('not found') ? 400 : 500;
      return ApiResponseHelper.error(reply, msg, 4000, status);
    }
  },
};
