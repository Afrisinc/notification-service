import { FastifyRequest, FastifyReply } from 'fastify';
import { PaygService } from '../services/payg.service';
import { ApiResponseHelper } from '../utils/api-response';
import pino from 'pino';
import type { PaygChannel } from '../types/payg.types';

const logger = pino();

const getErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : 'Unknown error');

export const paygController = {
  /**
   * GET /api/payg/balance
   */
  async getBalance(req: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = req.headers['x-account-id'] as string;
      if (!accountId) return ApiResponseHelper.unauthorized(reply, 'Account ID required');

      const balance = await PaygService.getBalance(accountId);
      return ApiResponseHelper.success(reply, 'Balance retrieved', balance);
    } catch (err) {
      logger.error({ err }, 'getBalance failed');
      return ApiResponseHelper.error(reply, getErrorMessage(err), 5000, 500);
    }
  },

  /**
   * POST /api/payg/topup
   */
  async topUp(req: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = req.headers['x-account-id'] as string;
      if (!accountId) return ApiResponseHelper.unauthorized(reply, 'Account ID required');

      const body = req.body as { amount: number; paymentRef?: string };

      const result = await PaygService.topUp(accountId, {
        amount: body.amount,
        paymentRef: body.paymentRef,
      });

      return ApiResponseHelper.success(reply, 'Top-up successful', result);
    } catch (err) {
      logger.error({ err }, 'topUp failed');
      const msg = getErrorMessage(err);
      const status = msg.includes('Minimum') ? 400 : 500;
      return ApiResponseHelper.error(reply, msg, 4000, status);
    }
  },

  /**
   * POST /api/payg/topup/init
   * Creates a Stripe payment intent and returns the client secret.
   * The UI must confirm the payment via Stripe.js.
   */
  async initTopUp(req: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = req.headers['x-account-id'] as string;
      if (!accountId) return ApiResponseHelper.unauthorized(reply, 'Account ID required');

      const body = req.body as { amount: number; customerEmail: string };
      if (!body.customerEmail) return ApiResponseHelper.error(reply, 'customerEmail is required', 4001, 400);

      const result = await PaygService.initTopUp(accountId, body.amount, body.customerEmail);
      return ApiResponseHelper.success(reply, 'Payment intent created', result);
    } catch (err) {
      logger.error({ err }, 'initTopUp failed');
      const msg = getErrorMessage(err);
      const status = msg.includes('Minimum') || msg.includes('required') ? 400 : 500;
      return ApiResponseHelper.error(reply, msg, 4000, status);
    }
  },

  /**
   * GET /api/payg/transactions
   */
  async getTransactions(req: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = req.headers['x-account-id'] as string;
      if (!accountId) return ApiResponseHelper.unauthorized(reply, 'Account ID required');

      const query = req.query as { page?: string; limit?: string; type?: string };

      const result = await PaygService.getTransactions(accountId, {
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        type: query.type,
      });

      return ApiResponseHelper.success(reply, 'Transactions retrieved', result);
    } catch (err) {
      logger.error({ err }, 'getTransactions failed');
      return ApiResponseHelper.error(reply, getErrorMessage(err), 5000, 500);
    }
  },

  /**
   * GET /api/payg/rates  (public)
   */
  async getRates(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const rates = PaygService.getRates();
      return ApiResponseHelper.success(reply, 'PAYG rates retrieved', rates);
    } catch (err) {
      logger.error({ err }, 'getRates failed');
      return ApiResponseHelper.error(reply, getErrorMessage(err), 5000, 500);
    }
  },

  /**
   * GET /api/payg/check-balance
   */
  async checkBalance(req: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = req.headers['x-account-id'] as string;
      if (!accountId) return ApiResponseHelper.unauthorized(reply, 'Account ID required');

      const query = req.query as { channel: PaygChannel; quantity: string };

      const result = await PaygService.checkSufficientBalance(accountId, query.channel, parseInt(query.quantity, 10));

      return ApiResponseHelper.success(reply, 'Balance check complete', result);
    } catch (err) {
      logger.error({ err }, 'checkBalance failed');
      return ApiResponseHelper.error(reply, getErrorMessage(err), 5000, 500);
    }
  },

  // ─── Mobile Money Methods ─────────────────────────────────────────────────────

  /**
   * POST /api/payg/mobile/topup
   * Initiate mobile money payment (PAYG top-up or subscription)
   */
  async initMobileTopUp(req: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = req.headers['x-account-id'] as string;
      if (!accountId) return ApiResponseHelper.unauthorized(reply, 'Account ID required');

      const body = req.body as {
        amount: number;
        phoneNumber: string;
        customerName?: string;
        paymentType?: 'payg_topup' | 'subscription';
        planId?: string;
        billingCycle?: 'monthly' | 'yearly';
      };

      if (!body.phoneNumber) {
        return ApiResponseHelper.error(reply, 'phoneNumber is required', 4001, 400);
      }

      // Validate subscription-specific fields
      if (body.paymentType === 'subscription' && !body.planId) {
        return ApiResponseHelper.error(reply, 'planId is required for subscription payments', 4001, 400);
      }

      const result = await PaygService.initMobileTopUp(accountId, body.amount, body.phoneNumber, body.customerName, {
        paymentType: body.paymentType ?? 'payg_topup',
        planId: body.planId,
        billingCycle: body.billingCycle ?? 'monthly',
      });

      return ApiResponseHelper.created(reply, result.message, result);
    } catch (err) {
      logger.error({ err }, 'initMobileTopUp failed');
      const msg = getErrorMessage(err);
      const status = msg.includes('Minimum') || msg.includes('required') || msg.includes('not found') ? 400 : 500;
      return ApiResponseHelper.error(reply, msg, 4000, status);
    }
  },

  /**
   * GET /api/payg/mobile/:paymentId
   * Get mobile payment status by ID
   */
  async getMobilePayment(req: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = req.headers['x-account-id'] as string;
      if (!accountId) return ApiResponseHelper.unauthorized(reply, 'Account ID required');

      const { paymentId } = req.params as { paymentId: string };

      const payment = await PaygService.getMobilePayment(paymentId);
      return ApiResponseHelper.success(reply, 'Mobile payment retrieved', payment);
    } catch (err) {
      logger.error({ err }, 'getMobilePayment failed');
      const msg = getErrorMessage(err);
      const status = msg.includes('not found') ? 404 : 500;
      return ApiResponseHelper.error(reply, msg, 4004, status);
    }
  },

  /**
   * GET /api/payg/mobile/ref/:ref
   * Get mobile payment status by Paypack reference
   */
  async getMobilePaymentByRef(req: FastifyRequest, reply: FastifyReply) {
    try {
      const accountId = req.headers['x-account-id'] as string;
      if (!accountId) return ApiResponseHelper.unauthorized(reply, 'Account ID required');

      const { ref } = req.params as { ref: string };

      const payment = await PaygService.getMobilePaymentByRef(ref);
      return ApiResponseHelper.success(reply, 'Mobile payment retrieved', payment);
    } catch (err) {
      logger.error({ err }, 'getMobilePaymentByRef failed');
      const msg = getErrorMessage(err);
      const status = msg.includes('not found') ? 404 : 500;
      return ApiResponseHelper.error(reply, msg, 4004, status);
    }
  },
};
