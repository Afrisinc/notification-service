import { FastifyInstance } from 'fastify';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import {
  getPlatformEmailSettingsHandler,
  updatePlatformEmailSettingsHandler,
} from '../controllers/platform-email-settings.controller';
import {
  GetPlatformEmailSettingsSchema,
  UpdatePlatformEmailSettingsSchema,
} from '../schemas/routes/platform-email-settings.schema';

export async function registerPlatformEmailSettingsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/admin/platform-email-settings',
    { onRequest: [], schema: GetPlatformEmailSettingsSchema },
    asyncWrapper(getPlatformEmailSettingsHandler)
  );

  fastify.put(
    '/admin/platform-email-settings',
    { onRequest: [], schema: UpdatePlatformEmailSettingsSchema },
    asyncWrapper(updatePlatformEmailSettingsHandler)
  );
}
