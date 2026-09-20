import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { ApiResponseHelper } from '../utils';
import { OrganizationService } from '../services/organization.service';

const organizationService = new OrganizationService();

/**
 * Restricts an org-scoped route to that organization's OWNER/ADMIN members.
 * Must run after `validateBaseToken` (populates `request.user.id`). Distinct
 * from `requirePlatformAdmin`/`requireSuperAdmin`, which gate the staff
 * console role carried on the token payload, not organization membership.
 */
export async function requireOrgAdmin(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).user?.id;
  const { orgId } = request.params as { orgId?: string };

  if (!userId) {
    return ApiResponseHelper.unauthorized(reply, 'User information not found in request');
  }
  if (!orgId) {
    return ApiResponseHelper.badRequest(reply, 'Organization ID is required');
  }

  const canManage = await organizationService.canManageOrganization(orgId, userId);
  if (!canManage) {
    logger.warn({ requestId: request.id, userId, orgId }, 'Org admin access denied: insufficient role');
    return ApiResponseHelper.forbidden(reply, 'Organization administrator access required');
  }
}

/**
 * Stricter than requireOrgAdmin: only the organization OWNER, not ADMIN.
 * Used for domain/sender management - only the owner may register domains
 * or create/assign sender identities.
 */
export async function requireOrgOwner(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).user?.id;
  const { orgId } = request.params as { orgId?: string };

  if (!userId) {
    return ApiResponseHelper.unauthorized(reply, 'User information not found in request');
  }
  if (!orgId) {
    return ApiResponseHelper.badRequest(reply, 'Organization ID is required');
  }

  const isOwner = await organizationService.isOrganizationOwner(orgId, userId);
  if (!isOwner) {
    logger.warn({ requestId: request.id, userId, orgId }, 'Org owner access denied: insufficient role');
    return ApiResponseHelper.forbidden(reply, 'Only the organization owner can perform this action');
  }
}

/** Any member of the organization, regardless of role - used for read-only, member-scoped endpoints. */
export async function requireOrgMember(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).user?.id;
  const { orgId } = request.params as { orgId?: string };

  if (!userId) {
    return ApiResponseHelper.unauthorized(reply, 'User information not found in request');
  }
  if (!orgId) {
    return ApiResponseHelper.badRequest(reply, 'Organization ID is required');
  }

  const isMember = await organizationService.isOrganizationMember(orgId, userId);
  if (!isMember) {
    logger.warn({ requestId: request.id, userId, orgId }, 'Org member access denied: not a member');
    return ApiResponseHelper.forbidden(reply, 'You are not a member of this organization');
  }
}
