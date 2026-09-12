import { FastifyInstance } from 'fastify';
import { clientsController } from '../controllers/clients.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken, requirePlatformAdmin } from '../middlewares/auth.middleware';
import { verifyGatewaySignature } from '../plugins/gateway-guard';
import { GetClientsSchema, GetClientsStatsSchema } from '../schemas/routes/clients.schema';
import { getDashboard, getDashboardStats, getRecentSends } from '../controllers/dashboard.controller';
import { adminNotificationsController } from '../controllers/admin-notifications.controller';
import { adminTemplatesController } from '../controllers/admin-templates.controller';
import { adminAnalyticsController } from '../controllers/admin-analytics.controller';
import { rateLimiters } from '../middlewares/rate-limit.middleware';
import { GetDashboardSchema, GetDashboardStatsSchema, GetRecentSendsSchema } from '../schemas/routes/dashboard.schema';
import {
  GetAdminNotificationsSchema,
  GetAdminNotificationStatsSchema,
} from '../schemas/routes/admin-notifications.schema';
import { GetAdminTemplatesSchema, GetAdminTemplateStatsSchema } from '../schemas/routes/admin-templates.schema';
import { GetAdminAnalyticsSchema } from '../schemas/routes/admin-analytics.schema';

const platformAdminOnly = [validateBaseToken, requirePlatformAdmin];
const gatewayOnly = [verifyGatewaySignature];

export async function clientsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/clients',
    {
      onRequest: platformAdminOnly,
      preValidation: gatewayOnly,
      schema: GetClientsSchema,
    },
    asyncWrapper(clientsController.getClients.bind(clientsController))
  );

  fastify.get(
    '/clients/stats',
    {
      onRequest: [rateLimiters.api, ...platformAdminOnly],
      preValidation: gatewayOnly,
      schema: GetClientsStatsSchema,
    },
    asyncWrapper(clientsController.getStats.bind(clientsController))
  );

  // Dashboard endpoints
  fastify.get(
    '/dashboard',
    {
      onRequest: [rateLimiters.api, ...platformAdminOnly],
      preValidation: gatewayOnly,
      schema: GetDashboardSchema,
    },
    asyncWrapper(getDashboard)
  );

  fastify.get(
    '/dashboard/stats',
    {
      onRequest: [rateLimiters.api, ...platformAdminOnly],
      preValidation: gatewayOnly,
      schema: GetDashboardStatsSchema,
    },
    asyncWrapper(getDashboardStats)
  );

  fastify.get(
    '/dashboard/recent-sends',
    {
      onRequest: [rateLimiters.api, ...platformAdminOnly],
      preValidation: gatewayOnly,
      schema: GetRecentSendsSchema,
    },
    asyncWrapper(getRecentSends)
  );

  // Admin notifications endpoints
  fastify.get(
    '/notifications',
    {
      onRequest: [rateLimiters.api, ...platformAdminOnly],
      preValidation: gatewayOnly,
      schema: GetAdminNotificationsSchema,
    },
    asyncWrapper(adminNotificationsController.getNotifications.bind(adminNotificationsController))
  );

  fastify.get(
    '/notifications/stats',
    {
      onRequest: [rateLimiters.api, ...platformAdminOnly],
      preValidation: gatewayOnly,
      schema: GetAdminNotificationStatsSchema,
    },
    asyncWrapper(adminNotificationsController.getStats.bind(adminNotificationsController))
  );

  // Admin templates endpoints
  fastify.get(
    '/templates',
    {
      onRequest: [rateLimiters.api, ...platformAdminOnly],
      preValidation: gatewayOnly,
      schema: GetAdminTemplatesSchema,
    },
    asyncWrapper(adminTemplatesController.getTemplates.bind(adminTemplatesController))
  );

  fastify.get(
    '/templates/stats',
    {
      onRequest: [rateLimiters.api, ...platformAdminOnly],
      preValidation: gatewayOnly,
      schema: GetAdminTemplateStatsSchema,
    },
    asyncWrapper(adminTemplatesController.getStats.bind(adminTemplatesController))
  );

  // Admin analytics endpoint
  fastify.get(
    '/analytics',
    {
      onRequest: [rateLimiters.api, ...platformAdminOnly],
      preValidation: gatewayOnly,
      schema: GetAdminAnalyticsSchema,
    },
    asyncWrapper(adminAnalyticsController.getOverview.bind(adminAnalyticsController))
  );
}
