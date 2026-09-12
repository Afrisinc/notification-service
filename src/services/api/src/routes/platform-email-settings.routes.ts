import { FastifyInstance } from 'fastify';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken, requirePlatformAdmin } from '../middlewares/auth.middleware';
import { verifyGatewaySignature } from '../plugins/gateway-guard';
import {
  getPlatformEmailSettingsHandler,
  updatePlatformEmailSettingsHandler,
} from '../controllers/platform-email-settings.controller';
import {
  GetPlatformEmailSettingsSchema,
  UpdatePlatformEmailSettingsSchema,
} from '../schemas/routes/platform-email-settings.schema';

const platformAdminOnly = [validateBaseToken, requirePlatformAdmin];
const gatewayOnly = [verifyGatewaySignature];

export async function registerPlatformEmailSettingsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/admin/platform-email-settings',
    { onRequest: platformAdminOnly, preValidation: gatewayOnly, schema: GetPlatformEmailSettingsSchema },
    asyncWrapper(getPlatformEmailSettingsHandler)
  );

  fastify.put(
    '/admin/platform-email-settings',
    { onRequest: platformAdminOnly, preValidation: gatewayOnly, schema: UpdatePlatformEmailSettingsSchema },
    asyncWrapper(updatePlatformEmailSettingsHandler)
  );
}
