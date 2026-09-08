import { FastifyInstance } from 'fastify';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import * as MailAliasController from '../controllers/mail-alias.controller';
import {
  ListMailAliasesSchema,
  AddMailAliasSchema,
  UpdateMailAliasSchema,
  DeleteMailAliasSchema,
} from '../schemas/routes/mail-alias.schema';

/**
 * Admin endpoints for managing the company's own inbound mail forwarding
 * aliases (/etc/postfix/virtual on the mail server) over SSH, so they no
 * longer need to be hand-edited on the box.
 */
export async function registerMailAliasRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/admin/mail-aliases',
    { onRequest: [validateBaseToken], schema: ListMailAliasesSchema },
    asyncWrapper(MailAliasController.listMailAliases)
  );

  fastify.post(
    '/admin/mail-aliases',
    { onRequest: [validateBaseToken], schema: AddMailAliasSchema },
    asyncWrapper(MailAliasController.addMailAlias)
  );

  fastify.patch(
    '/admin/mail-aliases/:localPart',
    { onRequest: [validateBaseToken], schema: UpdateMailAliasSchema },
    asyncWrapper(MailAliasController.updateMailAlias)
  );

  fastify.delete(
    '/admin/mail-aliases/:localPart',
    { onRequest: [validateBaseToken], schema: DeleteMailAliasSchema },
    asyncWrapper(MailAliasController.deleteMailAlias)
  );
}
