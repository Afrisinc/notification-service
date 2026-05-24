import { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { OrganizationService } from '../services/organization.service';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { ApiResponseHelper } from '../utils/api-response';

const logger = pino();

export class OrganizationController {
  private organizationService: OrganizationService;

  constructor() {
    this.organizationService = new OrganizationService();
  }

  /**
   * Create a new organization with billing
   */
  async createOrganization(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.id;
      const body = request.body as {
        name: string;
        legalName?: string;
        country?: string;
        location?: string;
        taxId?: string;
        email?: string;
        phone?: string;
        planId: string;
        billingCycle?: 'monthly' | 'annual';
        paymentMethodId?: string;
      };

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      if (!body.name) {
        return ApiResponseHelper.badRequest(reply, 'Organization name is required');
      }

      if (!body.planId) {
        return ApiResponseHelper.badRequest(reply, 'Plan ID is required');
      }

      const org = await this.organizationService.createOrganization(body, userId);

      return ApiResponseHelper.created(reply, 'Organization created successfully', {
        id: org.id,
        name: org.name,
        slug: org.slug,
        legalName: org.legal_name,
        location: org.location,
        country: org.country,
        taxId: org.tax_id,
        orgEmail: org.org_email,
        orgPhone: org.org_phone,
        createdAt: org.createdAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create organization';
      logger.error({ error }, message);

      if (message.includes('Plan not found') || message.includes('Payment method is required')) {
        return ApiResponseHelper.badRequest(reply, message);
      }

      return ApiResponseHelper.internalError(reply, 'Failed to create organization');
    }
  }

  /**
   * List organizations for the current user
   */
  async listOrganizations(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.id;
      const query = request.query as { page?: string; limit?: string };

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      const page = parseInt(query.page || '1', 10);
      const limit = parseInt(query.limit || '10', 10);

      const result = await this.organizationService.listOrganizations(userId, page, limit);

      return ApiResponseHelper.success(reply, 'Organizations retrieved successfully', {
        organizations: result.organizations.map((org: any) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          legalName: org.legal_name,
          location: org.location,
          country: org.country,
          taxId: org.tax_id,
          orgEmail: org.org_email,
          orgPhone: org.org_phone,
          memberCount: org._count?.members || 0,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to list organizations');
      return ApiResponseHelper.internalError(reply, 'Failed to list organizations');
    }
  }

  /**
   * Get organization details by ID
   */
  async getOrganizationById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId } = request.params as { orgId: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      // Verify user is part of the organization
      const isMember = await this.organizationService.isOrganizationMember(orgId, userId);
      if (!isMember) {
        return ApiResponseHelper.forbidden(reply, 'You do not have access to this organization');
      }

      const org = await this.organizationService.getOrganizationById(orgId);

      if (!org) {
        return ApiResponseHelper.notFound(reply, 'Organization not found');
      }

      return ApiResponseHelper.success(reply, 'Organization retrieved successfully', {
        id: org.id,
        name: org.name,
        slug: org.slug,
        legalName: org.legal_name,
        location: org.location,
        country: org.country,
        taxId: org.tax_id,
        orgEmail: org.org_email,
        orgPhone: org.org_phone,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        memberCount: org._count?.members || 0,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get organization');
      return ApiResponseHelper.internalError(reply, 'Failed to get organization');
    }
  }

  /**
   * Create an invite for someone to join an organization
   */
  async createInvite(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId } = request.params as { orgId: string };
      const { email, role } = request.body as { email: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' };
      const userId = (request as any).user?.id;

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      // Verify user is admin/owner of the organization
      const canInvite = await this.organizationService.canManageOrganization(orgId, userId);
      if (!canInvite) {
        return ApiResponseHelper.forbidden(reply, 'You do not have permission to invite members to this organization');
      }

      const invite = await this.organizationService.createInvite(orgId, email, role);

      // Track usage - use orgId as both account and app for organization-level tracking
      const accountId = request.headers['x-account-id'] as string;
      await UsageTrackingService.recordUsage(accountId, orgId, 'team_members', 1);

      return ApiResponseHelper.created(reply, 'Invite created successfully', {
        inviteId: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
      });
    } catch (error: any) {
      logger.error({ error }, 'Failed to create invite');
      const message = error.message || 'Failed to create invite';

      // Let's temporary return the actual internal error message to the frontend so we can see EXACTLY what's breaking
      if (
        message === 'Organization not found' ||
        message.includes('already exists') ||
        message.includes('already a member')
      ) {
        return ApiResponseHelper.badRequest(reply, message);
      }

      return ApiResponseHelper.internalError(reply, `Failed to create invite: ${message}`);
    }
  }

  /**
   * Get all members of an organization
   */
  async getMembers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId } = request.params as { orgId: string };
      const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };
      const userId = (request as any).user?.id;

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
   * Get all invites of an organization
   */
  async getInvites(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId } = request.params as { orgId: string };
      const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };
      const userId = (request as any).user?.id;

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      // Verify user is part of the organization
      const isMember = await this.organizationService.isOrganizationMember(orgId, userId);
      if (!isMember) {
        return ApiResponseHelper.forbidden(reply, 'You do not have access to this organization');
      }

      const result = await this.organizationService.getInvites(orgId, Number(page), Number(limit));

      return ApiResponseHelper.success(reply, 'Invites retrieved successfully', {
        orgId,
        invites: result.invites,
        total: result.total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get organization invites');
      return ApiResponseHelper.internalError(reply, 'Failed to get organization invites');
    }
  }

  /**
   * Get all pending invites for the authenticated user
   */
  async getUserInvites(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.id;

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      const invites = await this.organizationService.getUserInvites(userId);

      return ApiResponseHelper.success(reply, 'User invites retrieved successfully', { invites });
    } catch (error) {
      logger.error({ error }, 'Failed to get user invites');
      return ApiResponseHelper.internalError(reply, 'Failed to get user invites');
    }
  }

  /**
   * Remove a member from an organization (Admin/Owner only)
   */
  async removeMember(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId, memberId } = request.params as { orgId: string; memberId: string };
      const userId = (request as any).user?.id;

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
      const userId = (request as any).user?.id;

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

  /**
   * Validate an organization invitation (no auth required)
   */
  async validateInvite(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { inviteId, token } = request.params as { inviteId: string; token: string };

      const invite = await this.organizationService.validateInvite(inviteId, token);

      if (!invite) {
        return ApiResponseHelper.notFound(reply, 'Invitation not found or invalid');
      }

      const isExpired = new Date() > new Date((invite as any).expiresAt);

      return ApiResponseHelper.success(reply, 'Invitation validated successfully', {
        inviteId: (invite as any).id,
        email: (invite as any).email,
        orgId: (invite as any).organization_id,
        orgName: (invite as any).organization?.name,
        role: (invite as any).role,
        status: isExpired ? 'expired' : (invite as any).status,
        expiresAt: (invite as any).expiresAt,
        isExpired,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to validate invitation');
      return ApiResponseHelper.internalError(reply, 'Failed to validate invitation');
    }
  }

  /**
   * Accept an organization invitation (auth required)
   */
  async acceptInvite(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { inviteId, token } = request.params as { inviteId: string; token: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      const result = await this.organizationService.acceptInvite(inviteId, token, userId);

      if (!result) {
        return ApiResponseHelper.badRequest(reply, 'Failed to accept invitation');
      }

      return ApiResponseHelper.success(reply, 'Invitation accepted successfully', {
        memberId: result.memberId,
        orgId: result.orgId,
        orgName: result.orgName,
        role: result.role,
        addedAt: result.addedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept invitation';
      logger.error({ error }, message);

      if (message.includes('expired')) {
        return ApiResponseHelper.badRequest(reply, 'Invitation has expired');
      }

      if (message.includes('already a member')) {
        return ApiResponseHelper.badRequest(reply, 'User is already a member of this organization');
      }

      return ApiResponseHelper.internalError(reply, message);
    }
  }

  /**
   * Decline an organization invitation (auth required)
   */
  async declineInvite(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { inviteId, token } = request.params as { inviteId: string; token: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
      }

      const result = await this.organizationService.declineInvite(inviteId, token, userId);

      if (!result) {
        return ApiResponseHelper.badRequest(reply, 'Failed to decline invitation');
      }

      return ApiResponseHelper.success(reply, 'Invitation declined successfully', {
        inviteId: result.inviteId,
        status: result.status,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decline invitation';
      logger.error({ error }, message);

      if (message.includes('expired')) {
        return ApiResponseHelper.badRequest(reply, 'Invitation has expired');
      }

      return ApiResponseHelper.internalError(reply, message);
    }
  }
}
