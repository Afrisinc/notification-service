import { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { PaymentService } from '../services/payment.service';
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
};
