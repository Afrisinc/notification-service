import type { FastifyInstance } from 'fastify';
import { SecurityController } from '../controllers/security.controller';
import { validateBaseToken, requirePlatformAdmin } from '../middlewares/auth.middleware';
import { verifyGatewaySignature } from '../plugins/gateway-guard';
import { GetSecurityOverviewSchema, GetLoginEventsSchema } from '../schemas/routes/security.schema';

const controller = new SecurityController();
const platformAdminOnly = [validateBaseToken, requirePlatformAdmin];
const gatewayOnly = [verifyGatewaySignature];

export async function securityRoutes(app: FastifyInstance) {
  // Get security overview with failed logins, top IPs, and suspicious activity
  app.get(
    '/platform/security/overview',
    {
      onRequest: platformAdminOnly,
      preValidation: gatewayOnly,
      schema: { ...GetSecurityOverviewSchema, hide: true },
    },
    controller.getSecurityOverview.bind(controller)
  );

  // Get login events with pagination and search
  app.get(
    '/platform/security/loginevents',
    {
      onRequest: platformAdminOnly,
      preValidation: gatewayOnly,
      schema: { ...GetLoginEventsSchema, hide: true },
    },
    controller.getLoginEvents.bind(controller)
  );
}
