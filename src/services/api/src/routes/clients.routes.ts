import { FastifyInstance } from 'fastify';
import { clientsController } from '../controllers/clients.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { GetClientsSchema } from '../schemas/routes/clients.schema';

export async function clientsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/clients',
    {
      schema: GetClientsSchema,
    },
    asyncWrapper(clientsController.getClients.bind(clientsController))
  );
}
