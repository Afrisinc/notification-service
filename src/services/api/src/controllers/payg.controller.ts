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
};
