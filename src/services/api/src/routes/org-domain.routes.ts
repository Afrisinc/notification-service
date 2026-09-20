import { FastifyInstance } from 'fastify';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import { requireOrgOwner, requireOrgAdmin, requireOrgMember } from '../middlewares/org-role.middleware';
import * as OrgDomainController from '../controllers/org-domain.controller';
import {
  ListOrgDomainsSchema,
  AddOrgDomainSchema,
  GetOrgDomainRecordsSchema,
  VerifyOrgDomainSchema,
  GetOrgInboundMxRecordSchema,
  EnableOrgInboundDomainSchema,
  DeleteOrgDomainSchema,
  AddOrgSenderSchema,
  UpdateOrgSenderSchema,
  DeleteOrgSenderSchema,
  ListMySendersSchema,
  ListOrgSendersSchema,
  GetOrgCloudflareSettingsSchema,
  UpdateOrgCloudflareSettingsSchema,
  DeleteOrgCloudflareSettingsSchema,
} from '../schemas/routes/org-domain.schema';

/**
 * Organization-level custom domains and sender identities - a parallel flow
 * to the per-App email-identity routes. Registering/removing a domain (DNS,
 * DKIM) is owner-only (requireOrgOwner) - creating/assigning sender
 * addresses under an already-verified domain is lighter-weight and open to
 * OWNER/ADMIN (requireOrgAdmin). Any member can list the senders assigned to
 * them (requireOrgMember) to power the inbox's "send as" picker.
 */
export async function registerOrgDomainRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/organizations/:orgId/domains',
    { onRequest: [validateBaseToken, requireOrgAdmin], schema: ListOrgDomainsSchema },
    asyncWrapper(OrgDomainController.listOrgDomains)
  );

  fastify.post(
    '/organizations/:orgId/domains',
    { onRequest: [validateBaseToken, requireOrgOwner], schema: AddOrgDomainSchema },
    asyncWrapper(OrgDomainController.addOrgDomain)
  );

  fastify.get(
    '/organizations/:orgId/domains/:domainId/records',
    { onRequest: [validateBaseToken, requireOrgOwner], schema: GetOrgDomainRecordsSchema },
    asyncWrapper(OrgDomainController.getOrgDomainRecords)
  );

  fastify.post(
    '/organizations/:orgId/domains/:domainId/verify',
    { onRequest: [validateBaseToken, requireOrgOwner], schema: VerifyOrgDomainSchema },
    asyncWrapper(OrgDomainController.verifyOrgDomain)
  );

  fastify.get(
    '/organizations/:orgId/domains/:domainId/mx-record',
    { onRequest: [validateBaseToken, requireOrgOwner], schema: GetOrgInboundMxRecordSchema },
    asyncWrapper(OrgDomainController.getOrgInboundMxRecord)
  );

  fastify.post(
    '/organizations/:orgId/domains/:domainId/inbound/enable',
    { onRequest: [validateBaseToken, requireOrgOwner], schema: EnableOrgInboundDomainSchema },
    asyncWrapper(OrgDomainController.enableOrgInboundDomain)
  );

  fastify.delete(
    '/organizations/:orgId/domains/:domainId',
    { onRequest: [validateBaseToken, requireOrgOwner], schema: DeleteOrgDomainSchema },
    asyncWrapper(OrgDomainController.deleteOrgDomain)
  );

  fastify.post(
    '/organizations/:orgId/domains/:domainId/senders',
    { onRequest: [validateBaseToken, requireOrgAdmin], schema: AddOrgSenderSchema },
    asyncWrapper(OrgDomainController.addOrgSender)
  );

  fastify.patch(
    '/organizations/:orgId/senders/:senderId',
    { onRequest: [validateBaseToken, requireOrgAdmin], schema: UpdateOrgSenderSchema },
    asyncWrapper(OrgDomainController.updateOrgSender)
  );

  fastify.delete(
    '/organizations/:orgId/senders/:senderId',
    { onRequest: [validateBaseToken, requireOrgAdmin], schema: DeleteOrgSenderSchema },
    asyncWrapper(OrgDomainController.deleteOrgSender)
  );

  fastify.get(
    '/organizations/:orgId/senders',
    { onRequest: [validateBaseToken, requireOrgAdmin], schema: ListOrgSendersSchema },
    asyncWrapper(OrgDomainController.listOrgSenders)
  );

  fastify.get(
    '/organizations/:orgId/senders/mine',
    { onRequest: [validateBaseToken, requireOrgMember], schema: ListMySendersSchema },
    asyncWrapper(OrgDomainController.listMySenders)
  );

  // Org-wide Cloudflare default token, used to auto-configure DNS for any
  // domain added above without its own per-domain token. Owner-only, same
  // as domain registration itself.
  fastify.get(
    '/organizations/:orgId/cloudflare-settings',
    { onRequest: [validateBaseToken, requireOrgOwner], schema: GetOrgCloudflareSettingsSchema },
    asyncWrapper(OrgDomainController.getOrgCloudflareSettings)
  );

  fastify.put(
    '/organizations/:orgId/cloudflare-settings',
    { onRequest: [validateBaseToken, requireOrgOwner], schema: UpdateOrgCloudflareSettingsSchema },
    asyncWrapper(OrgDomainController.updateOrgCloudflareSettings)
  );

  fastify.delete(
    '/organizations/:orgId/cloudflare-settings',
    { onRequest: [validateBaseToken, requireOrgOwner], schema: DeleteOrgCloudflareSettingsSchema },
    asyncWrapper(OrgDomainController.deleteOrgCloudflareSettings)
  );
}
