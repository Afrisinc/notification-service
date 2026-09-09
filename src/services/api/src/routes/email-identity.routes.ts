import { FastifyInstance } from 'fastify';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import * as EmailIdentityController from '../controllers/email-identity.controller';
import {
  ListEmailDomainsSchema,
  AddEmailDomainSchema,
  GetEmailDomainRecordsSchema,
  VerifyEmailDomainSchema,
  DeleteEmailDomainSchema,
  AddEmailSenderSchema,
  UpdateEmailSenderSchema,
  DeleteEmailSenderSchema,
} from '../schemas/routes/email-identity.schema';

/**
 * Multi-domain, multi-sender email identity routes.
 * Sits alongside the single-config `/apps/:appId/email-provider*` routes -
 * setting a sender as default here writes through to that same AppEmailProvider
 * row, which is what actually gets read at send time.
 */
export async function registerEmailIdentityRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/apps/:appId/email-domains',
    { onRequest: [validateBaseToken], schema: ListEmailDomainsSchema },
    asyncWrapper(EmailIdentityController.listEmailDomains)
  );

  fastify.post(
    '/apps/:appId/email-domains',
    { onRequest: [validateBaseToken], schema: AddEmailDomainSchema },
    asyncWrapper(EmailIdentityController.addEmailDomain)
  );

  fastify.get(
    '/apps/:appId/email-domains/:domainId/records',
    { onRequest: [validateBaseToken], schema: GetEmailDomainRecordsSchema },
    asyncWrapper(EmailIdentityController.getEmailDomainRecords)
  );

  fastify.post(
    '/apps/:appId/email-domains/:domainId/verify',
    { onRequest: [validateBaseToken], schema: VerifyEmailDomainSchema },
    asyncWrapper(EmailIdentityController.verifyEmailDomain)
  );

  fastify.delete(
    '/apps/:appId/email-domains/:domainId',
    { onRequest: [validateBaseToken], schema: DeleteEmailDomainSchema },
    asyncWrapper(EmailIdentityController.deleteEmailDomain)
  );

  fastify.post(
    '/apps/:appId/email-domains/:domainId/senders',
    { onRequest: [validateBaseToken], schema: AddEmailSenderSchema },
    asyncWrapper(EmailIdentityController.addEmailSender)
  );

  fastify.patch(
    '/apps/:appId/email-senders/:senderId',
    { onRequest: [validateBaseToken], schema: UpdateEmailSenderSchema },
    asyncWrapper(EmailIdentityController.updateEmailSender)
  );

  fastify.delete(
    '/apps/:appId/email-senders/:senderId',
    { onRequest: [validateBaseToken], schema: DeleteEmailSenderSchema },
    asyncWrapper(EmailIdentityController.deleteEmailSender)
  );
}
