import { FastifyInstance } from 'fastify';
import { clientsController } from '../controllers/clients.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { GetClientsSchema } from '../schemas/routes/clients.schema';
import { getDashboard, getDashboardStats, getRecentSends } from '../controllers/dashboard.controller';
import { rateLimiters } from '../middlewares/rate-limit.middleware';
import { GetDashboardSchema, GetDashboardStatsSchema, GetRecentSendsSchema } from '../schemas/routes/dashboard.schema';

export async function clientsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/clients',
    {
      schema: GetClientsSchema,
    },
    asyncWrapper(clientsController.getClients.bind(clientsController))
  );

  // Dashboard endpoints
  fastify.get(
    '/dashboard',
    {
      onRequest: [rateLimiters.api],
      schema: GetDashboardSchema,
    },
    asyncWrapper(getDashboard)
  );

  fastify.get(
    '/dashboard/stats',
    {
      onRequest: [rateLimiters.api],
      schema: GetDashboardStatsSchema,
    },
    asyncWrapper(getDashboardStats)
  );

  fastify.get(
    '/dashboard/recent-sends',
    {
      onRequest: [rateLimiters.api],
      schema: GetRecentSendsSchema,
    },
    asyncWrapper(getRecentSends)
  );
}
