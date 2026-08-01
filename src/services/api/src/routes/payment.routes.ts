import { FastifyInstance } from 'fastify';
import { paymentController } from '../controllers/payment.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import {
  InitializePaymentSchema,
  GetPaymentStatusSchema,
  AdminInitializePaymentSchema,
} from '../schemas/routes/payment.schema';

export async function registerPaymentRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/payments/initialize',
    { onRequest: [validateBaseToken], schema: InitializePaymentSchema },
    asyncWrapper(paymentController.initialize.bind(paymentController))
  );

  fastify.get(
    '/payments/status/:ref',
    { onRequest: [validateBaseToken], schema: GetPaymentStatusSchema },
    asyncWrapper(paymentController.getPaymentStatus.bind(paymentController))
  );

  fastify.post(
    '/admin/payments/initialize-for-account',
    { onRequest: [validateBaseToken], schema: AdminInitializePaymentSchema },
    asyncWrapper(paymentController.adminInitializePayment.bind(paymentController))
  );
}
