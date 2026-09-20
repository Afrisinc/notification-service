import { FastifyInstance } from 'fastify';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateRecipientToken } from '../middlewares/recipient-auth.middleware';
import * as RecipientInboxController from '../controllers/recipient-inbox.controller';
import { ListMyThreadsSchema, GetMyThreadSchema, ReplyToMyThreadSchema } from '../schemas/routes/inbox.schema';

/** Recipient-scoped inbox: every thread addressed to the logged-in recipient's email, across all businesses. */
export async function registerRecipientInboxRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/mail/threads',
    { onRequest: [validateRecipientToken], schema: ListMyThreadsSchema },
    asyncWrapper(RecipientInboxController.listMyThreads)
  );

  fastify.get(
    '/mail/threads/:threadId',
    { onRequest: [validateRecipientToken], schema: GetMyThreadSchema },
    asyncWrapper(RecipientInboxController.getMyThread)
  );

  fastify.post(
    '/mail/threads/:threadId/reply',
    { onRequest: [validateRecipientToken], schema: ReplyToMyThreadSchema },
    asyncWrapper(RecipientInboxController.replyToMyThread)
  );
}
