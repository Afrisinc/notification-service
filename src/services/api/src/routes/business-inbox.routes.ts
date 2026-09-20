import { FastifyInstance } from 'fastify';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import { requireOrgMember } from '../middlewares/org-role.middleware';
import * as BusinessInboxController from '../controllers/business-inbox.controller';
import {
  ListOrgThreadsSchema,
  GetOrgThreadSchema,
  ComposeOrgThreadSchema,
  ReplyToOrgThreadSchema,
} from '../schemas/routes/inbox.schema';

/**
 * Org-scoped shared inbox: every thread across every domain owned by the
 * organization, visible/repliable by any member (like a shared team inbox) -
 * requireOrgMember, not requireOrgAdmin. Starting a NEW thread additionally
 * requires the caller to own (or manage) the chosen sender identity, enforced
 * inside inbox.service.ts#composeThread.
 */
export async function registerBusinessInboxRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/organizations/:orgId/inbox/threads',
    { onRequest: [validateBaseToken, requireOrgMember], schema: ListOrgThreadsSchema },
    asyncWrapper(BusinessInboxController.listOrgThreads)
  );

  fastify.get(
    '/organizations/:orgId/inbox/threads/:threadId',
    { onRequest: [validateBaseToken, requireOrgMember], schema: GetOrgThreadSchema },
    asyncWrapper(BusinessInboxController.getOrgThread)
  );

  fastify.post(
    '/organizations/:orgId/inbox/threads',
    { onRequest: [validateBaseToken, requireOrgMember], schema: ComposeOrgThreadSchema },
    asyncWrapper(BusinessInboxController.composeOrgThread)
  );

  fastify.post(
    '/organizations/:orgId/inbox/threads/:threadId/reply',
    { onRequest: [validateBaseToken, requireOrgMember], schema: ReplyToOrgThreadSchema },
    asyncWrapper(BusinessInboxController.replyToOrgThread)
  );
}
