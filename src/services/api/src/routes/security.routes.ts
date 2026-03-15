import type { FastifyInstance } from 'fastify';
import { SecurityController } from '../controllers/security.controller';
import { GetSecurityOverviewSchema, GetLoginEventsSchema } from '../schemas/routes/security.schema';

const controller = new SecurityController();

export async function securityRoutes(app: FastifyInstance) {
  // Get security overview with failed logins, top IPs, and suspicious activity
  app.get(
    '/platform/security/overview',
    {
      schema: { ...GetSecurityOverviewSchema, hide: true },
    },
    controller.getSecurityOverview.bind(controller)
  );

  // Get login events with pagination and search
  app.get(
    '/platform/security/loginevents',
    {
      schema: { ...GetLoginEventsSchema, hide: true },
    },
    controller.getLoginEvents.bind(controller)
  );
}
