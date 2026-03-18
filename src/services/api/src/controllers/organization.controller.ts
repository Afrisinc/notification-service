import { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { OrganizationService } from '../services/organization.service';
import { ApiResponseHelper } from '../utils/api-response';

const logger = pino();

export class OrganizationController {
  private organizationService: OrganizationService;

  constructor() {
    this.organizationService = new OrganizationService();
  }

  /**
   * Create an invite for someone to join an organization
   */
  async createInvite(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId } = request.params as { orgId: string };
      const { email, role } = request.body as { email: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' };
      const userId = (request as any).user?.userId;

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      // Verify user is admin/owner of the organization
      const canInvite = await this.organizationService.canManageOrganization(orgId, userId);
      if (!canInvite) {
        return ApiResponseHelper.forbidden(reply, 'You do not have permission to invite members to this organization');
      }

      const invite = await this.organizationService.createInvite(orgId, email, role);

      return ApiResponseHelper.created(reply, 'Invite created successfully', {
        inviteId: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create invite');
      return ApiResponseHelper.internalError(reply, 'Failed to create invite');
    }
  }

  /**
   * Get all members of an organization
   */
  async getMembers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId } = request.params as { orgId: string };
      const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };
      const userId = (request as any).user?.userId;

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      // Verify user is part of the organization
      const isMember = await this.organizationService.isOrganizationMember(orgId, userId);
      if (!isMember) {
        return ApiResponseHelper.forbidden(reply, 'You do not have access to this organization');
      }

      const result = await this.organizationService.getMembers(orgId, page, limit);

      return ApiResponseHelper.success(reply, 'Members retrieved successfully', {
        orgId,
        members: result.members,
        total: result.total,
        page,
        limit,
        pages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get organization members');
      return ApiResponseHelper.internalError(reply, 'Failed to get organization members');
    }
  }

  /**
   * Remove a member from an organization (Admin/Owner only)
   */
  async removeMember(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId, memberId } = request.params as { orgId: string; memberId: string };
      const userId = (request as any).user?.userId;

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      // Verify user is admin/owner of the organization
      const canManage = await this.organizationService.canManageOrganization(orgId, userId);
      if (!canManage) {
        return ApiResponseHelper.forbidden(
          reply,
          'You do not have permission to remove members from this organization'
        );
      }

      // Prevent self-removal
      if (userId === memberId) {
        return ApiResponseHelper.badRequest(reply, 'You cannot remove yourself from the organization');
      }

      await this.organizationService.removeMember(orgId, memberId);

      return ApiResponseHelper.success(reply, 'Member removed successfully', {
        removed: true,
        memberId,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to remove member');
      return ApiResponseHelper.internalError(reply, 'Failed to remove member');
    }
  }

  /**
   * Update organization details (Owner only)
   */
  async updateOrganization(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId } = request.params as { orgId: string };
      const userId = (request as any).user?.id;
      const body = request.body as any;

      console.log('Update organization request body:', body);
      console.log('User ID from request:', userId);
      console.log('Organization ID from request:', orgId);

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      const updated = await this.organizationService.updateOrganization(orgId, userId, body);

      return ApiResponseHelper.updated(reply, 'Organization updated successfully', updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update organization';
      logger.error({ error }, message);

      if (message.includes('Only organization owner')) {
        return ApiResponseHelper.forbidden(reply, message);
      }

      return ApiResponseHelper.internalError(reply, message);
    }
  }

  /**
   * Delete organization (Owner only)
   */
  async deleteOrganization(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId } = request.params as { orgId: string };
      const userId = (request as any).user?.userId;

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      await this.organizationService.deleteOrganization(orgId, userId);

      return ApiResponseHelper.success(reply, 'Organization deleted successfully', {
        deleted: true,
        orgId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete organization';
      logger.error({ error }, message);

      if (message.includes('Only organization owner')) {
        return ApiResponseHelper.forbidden(reply, message);
      }

      return ApiResponseHelper.internalError(reply, message);
    }
  }
}
