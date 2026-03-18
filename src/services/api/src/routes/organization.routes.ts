import { FastifyInstance } from 'fastify';
import { TemplateController } from '../controllers/template.controller';
import { OrganizationController } from '../controllers/organization.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import { GetTemplatesByOrganizationRouteSchema } from '../schemas/routes/template.schema';
import {
  CreateOrganizationInviteSchema,
  GetOrganizationMembersSchema,
  RemoveOrganizationMemberSchema,
  UpdateOrganizationSchema,
  DeleteOrganizationSchema,
} from '../schemas/routes/organization.schema';

/**
 * Organization management routes
 */
export async function registerOrganizationRoutes(fastify: FastifyInstance) {
  const templateController = new TemplateController();
  const orgController = new OrganizationController();

  // Get templates by organization
  fastify.get(
    '/organizations/:orgId/templates',
    { onRequest: [validateBaseToken], schema: GetTemplatesByOrganizationRouteSchema },
    asyncWrapper(templateController.getTemplatesByOrganization.bind(templateController))
  );

  // Create organization invite
  fastify.post(
    '/organizations/:orgId/invites',
    { onRequest: [validateBaseToken], schema: CreateOrganizationInviteSchema },
    asyncWrapper(orgController.createInvite.bind(orgController))
  );

  // Get organization members
  fastify.get(
    '/organizations/:orgId/members',
    { onRequest: [validateBaseToken], schema: GetOrganizationMembersSchema },
    asyncWrapper(orgController.getMembers.bind(orgController))
  );

  // Remove organization member
  fastify.delete(
    '/organizations/:orgId/members/:memberId',
    { onRequest: [validateBaseToken], schema: RemoveOrganizationMemberSchema },
    asyncWrapper(orgController.removeMember.bind(orgController))
  );

  // Update organization
  fastify.put(
    '/organizations/:orgId',
    { onRequest: [validateBaseToken], schema: UpdateOrganizationSchema },
    asyncWrapper(orgController.updateOrganization.bind(orgController))
  );

  // Delete organization
  fastify.delete(
    '/organizations/:orgId',
    { onRequest: [validateBaseToken], schema: DeleteOrganizationSchema },
    asyncWrapper(orgController.deleteOrganization.bind(orgController))
  );
}
