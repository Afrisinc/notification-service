import type { FastifyInstance } from 'fastify';
import { PlatformController } from '../controllers/platform.controller';
import {
  AnalyticsOverviewSchema,
  AnalyticsUsersSchema,
  AnalyticsAccountsSchema,
  AnalyticsGrowthSchema,
  GetAllUsersSchema,
  GetUserByIdSchema,
} from '../schemas/routes/analytics.schema';

const controller = new PlatformController();

export async function platformRoutes(app: FastifyInstance) {
  // All platform analytics routes require authentication (disabled for internal use)
  // const platformMiddleware = [validateBaseToken];

  // GET /platform/analytics/overview
  app.get(
    '/platform/analytics/overview',
    { schema: { ...AnalyticsOverviewSchema, hide: true } },
    controller.getAnalyticsOverview.bind(controller)
  );

  // GET /platform/analytics/users
  app.get(
    '/platform/analytics/users',
    { schema: { ...AnalyticsUsersSchema, hide: true } },
    controller.getAnalyticsUsers.bind(controller)
  );

  // GET /platform/analytics/accounts
  app.get(
    '/platform/analytics/accounts',
    { schema: { ...AnalyticsAccountsSchema, hide: true } },
    controller.getAnalyticsAccounts.bind(controller)
  );

  // GET /platform/analytics/growth
  app.get(
    '/platform/analytics/growth',
    { schema: { ...AnalyticsGrowthSchema, hide: true } },
    controller.getAnalyticsGrowth.bind(controller)
  );

  // GET /platform/users - Get all users with accounts and organizations
  app.get('/platform/users', { schema: { ...GetAllUsersSchema, hide: true } }, controller.getAllUsers.bind(controller));

  // GET /platform/users/:userId - Get specific user with details
  app.get(
    '/platform/users/:userId',
    { schema: { ...GetUserByIdSchema, hide: true } },
    controller.getUserById.bind(controller)
  );
}
