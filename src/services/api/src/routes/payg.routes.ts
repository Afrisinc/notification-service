import { FastifyInstance } from 'fastify';
import { paygController } from '../controllers/payg.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import {
  GetBalanceSchema,
  TopUpSchema,
  GetTransactionsSchema,
  GetRatesSchema,
  CheckBalanceSchema,
} from '../schemas/routes/payg.schema';

/**
 * PAYG (Pay-as-you-go) Routes
 */
export async function registerPaygRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/payg/rates
   * Public — return channel rates and top-up tiers
   */
  fastify.get('/payg/rates', { schema: GetRatesSchema }, asyncWrapper(paygController.getRates.bind(paygController)));

  /**
   * GET /api/payg/balance
   * Protected — current credit balance
   */
  fastify.get(
    '/payg/balance',
    { onRequest: [validateBaseToken], schema: GetBalanceSchema },
    asyncWrapper(paygController.getBalance.bind(paygController))
  );

  /**
   * POST /api/payg/topup
   * Protected — add credits (mocked payment, real processor plugged in later)
   */
  fastify.post(
    '/payg/topup',
    { onRequest: [validateBaseToken], schema: TopUpSchema },
    asyncWrapper(paygController.topUp.bind(paygController))
  );

  /**
   * GET /api/payg/transactions
   * Protected — credit ledger history
   */
  fastify.get(
    '/payg/transactions',
    { onRequest: [validateBaseToken], schema: GetTransactionsSchema },
    asyncWrapper(paygController.getTransactions.bind(paygController))
  );

  /**
   * GET /api/payg/check-balance
   * Protected — check if balance covers a planned send
   */
  fastify.get(
    '/payg/check-balance',
    { onRequest: [validateBaseToken], schema: CheckBalanceSchema },
    asyncWrapper(paygController.checkBalance.bind(paygController))
  );
}
