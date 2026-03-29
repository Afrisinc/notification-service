import { FastifyInstance } from 'fastify';
import { AppEmailConfigController } from '../controllers/app-email-config.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import {
  GetEmailConfigSchema,
  SetEmailConfigSchema,
  ResetEmailConfigSchema,
} from '../schemas/routes/app-email-config.schema';

const controller = new AppEmailConfigController();

/**
 * App Email Configuration Routes
 * Manage custom sender email addresses per app
 */
export async function registerAppEmailConfigRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/apps/:appId/email-config',
    {
      onRequest: [validateBaseToken],
      schema: GetEmailConfigSchema,
    },
    asyncWrapper(controller.getEmailConfig.bind(controller) as any)
  );

  fastify.post(
    '/apps/:appId/email-config',
    {
      onRequest: [validateBaseToken],
      schema: SetEmailConfigSchema,
    },
    asyncWrapper(controller.setEmailConfig.bind(controller) as any)
  );

  fastify.delete(
    '/apps/:appId/email-config',
    {
      onRequest: [validateBaseToken],
      schema: ResetEmailConfigSchema,
    },
    asyncWrapper(controller.resetEmailConfig.bind(controller) as any)
  );

  fastify.post(
    '/apps/:appId/email-config/verify-dns',
    {
      onRequest: [validateBaseToken],
    },
    asyncWrapper(controller.verifyDNS.bind(controller) as any)
  );
}
