import type { FastifyInstance } from 'fastify';
import {
  createDomain,
  getDomainRecords,
  verifyDomain,
  updateDomain,
  deleteDomain,
} from '../controllers/domain.controller';
import { validateBaseToken } from '../middlewares/auth.middleware';
import {
  CreateDomainSchema,
  GetDomainRecordsSchema,
  VerifyDomainSchema,
  UpdateDomainSchema,
  DeleteDomainSchema,
} from '../schemas/routes/domain.schema';

export async function registerDomainRoutes(app: FastifyInstance) {
  // Create Domain
  app.post(
    '/apps/:appId/domains',
    {
      onRequest: [validateBaseToken],
      schema: CreateDomainSchema,
    },
    createDomain
  );

  // Get Domain Records
  app.get(
    '/apps/:appId/domains/:domainId/records',
    {
      onRequest: [validateBaseToken],
      schema: GetDomainRecordsSchema,
    },
    getDomainRecords
  );

  // Verify Domain
  app.post(
    '/apps/:appId/domains/:domainId/verify',
    {
      onRequest: [validateBaseToken],
      schema: VerifyDomainSchema,
    },
    verifyDomain
  );

  // Update Domain
  app.patch(
    '/apps/:appId/domains/:domainId',
    {
      onRequest: [validateBaseToken],
      schema: UpdateDomainSchema,
    },
    updateDomain
  );

  // Delete Domain
  app.delete(
    '/apps/:appId/domains/:domainId',
    {
      onRequest: [validateBaseToken],
      schema: DeleteDomainSchema,
    },
    deleteDomain
  );
}
