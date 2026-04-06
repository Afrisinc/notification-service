import { FastifyInstance } from 'fastify';
import { TemplateController } from '../controllers/template.controller';
import { OrganizationController } from '../controllers/organization.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import { planGuards } from '../guards/plan-guard';
import { GetTemplatesByOrganizationRouteSchema } from '../schemas/routes/template.schema';
import {
  GetOrganizationByIdSchema,
  CreateOrganizationInviteSchema,
  GetOrganizationMembersSchema,
  RemoveOrganizationMemberSchema,
  UpdateOrganizationSchema,
  DeleteOrganizationSchema,
  ValidateInviteSchema,
  AcceptInviteSchema,
} from '../schemas/routes/organization.schema';

/**
 * Organization management routes
 */
export async function registerOrganizationRoutes(fastify: FastifyInstance) {
  const templateController = new TemplateController();
  const orgController = new OrganizationController();

  // Create organization
  fastify.post(
    '/organizations',
    { onRequest: [validateBaseToken], schema: { tags: ['Organizations'] } },
    asyncWrapper(orgController.createOrganization.bind(orgController))
  );

  // List organizations
  fastify.get(
    '/organizations',
    { onRequest: [validateBaseToken], schema: { tags: ['Organizations'] } },
    asyncWrapper(orgController.listOrganizations.bind(orgController))
  );

  // Get organization by ID
  fastify.get(
    '/organizations/:orgId',
    { onRequest: [validateBaseToken], schema: GetOrganizationByIdSchema },
    asyncWrapper(orgController.getOrganizationById.bind(orgController))
  );

  // Get templates by organization
  fastify.get(
    '/organizations/:orgId/templates',
    { onRequest: [validateBaseToken], schema: GetTemplatesByOrganizationRouteSchema },
    asyncWrapper(templateController.getTemplatesByOrganization.bind(templateController))
  );

  // Create organization invite
  fastify.post(
    '/organizations/:orgId/invites',
    {
      onRequest: [
        validateBaseToken,
        // planGuards.checkUsageLimit('team_members', 1), // Check if can add more team members
      ],
      schema: CreateOrganizationInviteSchema,
    },
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

  // Validate invitation (no auth required - used before login/registration)
  fastify.get(
    '/invites/:inviteId/:token',
    { schema: ValidateInviteSchema },
    asyncWrapper(orgController.validateInvite.bind(orgController))
  );

  // Accept invitation (auth required - user must be logged in)
  fastify.post(
    '/invites/:inviteId/:token/accept',
    { onRequest: [validateBaseToken], schema: AcceptInviteSchema },
    asyncWrapper(orgController.acceptInvite.bind(orgController))
  );
}
