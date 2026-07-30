import { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { PaymentService } from '../services/payment.service';
import { ApiResponseHelper } from '../utils/api-response';
import type { InitializePaymentRequest } from '../types/payg.types';

const logger = pino();

const getErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : 'Unknown error');

export const paymentController = {
  /**
   * POST /api/payments/initialize
   * Initialize a PAYG top-up or subscription payment (card or mobile money).
   * Records a PENDING credit transaction and returns the checkout/approval details.
   */
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
};
