import { FastifyInstance } from 'fastify';
import { paymentController } from '../controllers/payment.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import { InitializePaymentSchema } from '../schemas/routes/payment.schema';

export async function registerPaymentRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/payments/initialize',
    { onRequest: [validateBaseToken], schema: InitializePaymentSchema },
    asyncWrapper(paymentController.initialize.bind(paymentController))
  );
}
