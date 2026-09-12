import type { FastifyInstance } from 'fastify';
import { PlatformController } from '../controllers/platform.controller';
import { validateBaseToken, requirePlatformAdmin } from '../middlewares/auth.middleware';
import { verifyGatewaySignature } from '../plugins/gateway-guard';
import {
  AnalyticsOverviewSchema,
  AnalyticsUsersSchema,
  AnalyticsAccountsSchema,
  AnalyticsGrowthSchema,
  GetAllUsersSchema,
  GetUserByIdSchema,
} from '../schemas/routes/analytics.schema';
import { GetCreditTransactionsSchema } from '../schemas/routes/admin-transactions.schema';

const controller = new PlatformController();

export async function platformRoutes(app: FastifyInstance) {
  // All platform analytics routes are restricted to platform admins (ADMIN/OWNER)
  // reached only through the API Gateway.
  const platformAdminOnly = [validateBaseToken, requirePlatformAdmin];
  const gatewayOnly = [verifyGatewaySignature];

  // GET /platform/analytics/overview
  app.get(
    '/platform/analytics/overview',
    { onRequest: platformAdminOnly, preValidation: gatewayOnly, schema: { ...AnalyticsOverviewSchema, hide: true } },
    controller.getAnalyticsOverview.bind(controller)
  );

  // GET /platform/analytics/users
  app.get(
    '/platform/analytics/users',
    { onRequest: platformAdminOnly, preValidation: gatewayOnly, schema: { ...AnalyticsUsersSchema, hide: true } },
    controller.getAnalyticsUsers.bind(controller)
  );

  // GET /platform/analytics/accounts
  app.get(
    '/platform/analytics/accounts',
    { onRequest: platformAdminOnly, preValidation: gatewayOnly, schema: { ...AnalyticsAccountsSchema, hide: true } },
    controller.getAnalyticsAccounts.bind(controller)
  );

  // GET /platform/analytics/growth
  app.get(
    '/platform/analytics/growth',
    { onRequest: platformAdminOnly, preValidation: gatewayOnly, schema: { ...AnalyticsGrowthSchema, hide: true } },
    controller.getAnalyticsGrowth.bind(controller)
  );

  // GET /platform/users - Get all users with accounts and organizations
  app.get(
    '/platform/users',
    { onRequest: platformAdminOnly, preValidation: gatewayOnly, schema: { ...GetAllUsersSchema, hide: true } },
    controller.getAllUsers.bind(controller)
  );

  // GET /platform/users/:userId - Get specific user with details
  app.get(
    '/platform/users/:userId',
    { onRequest: platformAdminOnly, preValidation: gatewayOnly, schema: { ...GetUserByIdSchema, hide: true } },
    controller.getUserById.bind(controller)
  );

  // GET /platform/credit-transactions - Get all credit transactions (admin only)
  app.get(
    '/platform/credit-transactions',
    {
      onRequest: platformAdminOnly,
      preValidation: gatewayOnly,
      schema: { ...GetCreditTransactionsSchema, hide: true },
    },
    controller.getCreditTransactions.bind(controller)
  );
}
