import { FastifyInstance } from 'fastify';
import { smsWebhookController } from '../controllers/sms-webhook.controller';
import { AfricasTalkingDeliveryReportSchema } from '../schemas/routes/sms-webhook.schema';

export async function registerSMSWebhookRoutes(app: FastifyInstance) {
  app.post(
    '/africas-talking/delivery',
    { schema: AfricasTalkingDeliveryReportSchema },
    smsWebhookController.handleAfricasTalkingDelivery.bind(smsWebhookController)
  );
}
