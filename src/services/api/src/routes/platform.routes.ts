import type { FastifyInstance } from 'fastify';
import { PlatformController } from '../controllers/platform.controller';
import {
  AnalyticsOverviewSchema,
  AnalyticsUsersSchema,
  AnalyticsAccountsSchema,
  AnalyticsGrowthSchema,
} from '../schemas/routes/analytics.schema';
import { validateBaseToken } from '../middlewares/auth.middleware';

const controller = new PlatformController();

export async function platformRoutes(app: FastifyInstance) {
  // All platform analytics routes require authentication
  const platformMiddleware = [validateBaseToken];

  // GET /platform/analytics/overview
  app.get(
    '/platform/analytics/overview',
    { schema: AnalyticsOverviewSchema, onRequest: platformMiddleware },
    controller.getAnalyticsOverview.bind(controller)
  );

  // GET /platform/analytics/users
  app.get(
    '/platform/analytics/users',
    { schema: AnalyticsUsersSchema, onRequest: platformMiddleware },
    controller.getAnalyticsUsers.bind(controller)
  );

  // GET /platform/analytics/accounts
  app.get(
    '/platform/analytics/accounts',
    { schema: AnalyticsAccountsSchema, onRequest: platformMiddleware },
    controller.getAnalyticsAccounts.bind(controller)
  );

  // GET /platform/analytics/growth
  app.get(
    '/platform/analytics/growth',
    { schema: AnalyticsGrowthSchema, onRequest: platformMiddleware },
    controller.getAnalyticsGrowth.bind(controller)
  );
}
