import { FastifyInstance } from 'fastify';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken, requireSuperAdmin } from '../middlewares/auth.middleware';
import { verifyGatewaySignature } from '../plugins/gateway-guard';
import * as MailAliasController from '../controllers/mail-alias.controller';
import {
  ListMailAliasesSchema,
  AddMailAliasSchema,
  UpdateMailAliasSchema,
  DeleteMailAliasSchema,
} from '../schemas/routes/mail-alias.schema';

const superAdminOnly = [validateBaseToken, requireSuperAdmin];
const gatewayOnly = [verifyGatewaySignature];

/**
 * Admin endpoints for managing the company's own inbound mail forwarding
 * aliases (/etc/postfix/virtual on the mail server) over SSH, so they no
 * longer need to be hand-edited on the box.
 *
 * Restricted to SUPER_ADMIN (not the wider platform-admin group) since this
 * reaches shared mail server infrastructure directly.
 */
export async function registerMailAliasRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/admin/mail-aliases',
    { onRequest: superAdminOnly, preValidation: gatewayOnly, schema: ListMailAliasesSchema },
    asyncWrapper(MailAliasController.listMailAliases)
  );

  fastify.post(
    '/admin/mail-aliases',
    { onRequest: superAdminOnly, preValidation: gatewayOnly, schema: AddMailAliasSchema },
    asyncWrapper(MailAliasController.addMailAlias)
  );

  fastify.patch(
    '/admin/mail-aliases/:localPart',
    { onRequest: superAdminOnly, preValidation: gatewayOnly, schema: UpdateMailAliasSchema },
    asyncWrapper(MailAliasController.updateMailAlias)
  );

  fastify.delete(
    '/admin/mail-aliases/:localPart',
    { onRequest: superAdminOnly, preValidation: gatewayOnly, schema: DeleteMailAliasSchema },
    asyncWrapper(MailAliasController.deleteMailAlias)
  );
}
