import { randomUUID } from 'crypto';
import pino from 'pino';
import { prismaRead, prismaWrite } from '@shared/database';

const logger = pino();

export class OrganizationService {
  /**
   * Check if user has admin/owner permissions in organization
   */
  async canManageOrganization(orgId: string, userId: string): Promise<boolean> {
    try {
      const member = await prismaRead.organizationMember.findFirst({
        where: {
          organization_id: orgId,
          user_id: userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      return !!member;
    } catch (error) {
      logger.error({ error, orgId, userId }, 'Error checking organization permissions');
      return false;
    }
  }

  /**
   * Check if user is a member of organization
   */
  async isOrganizationMember(orgId: string, userId: string): Promise<boolean> {
    try {
      const member = await prismaRead.organizationMember.findFirst({
        where: {
          organization_id: orgId,
          user_id: userId,
        },
      });

      return !!member;
    } catch (error) {
      logger.error({ error, orgId, userId }, 'Error checking organization membership');
      return false;
    }
  }

  /**
   * Create an invite for someone to join an organization
   * For now, this just returns an invite object structure
   * In production, this would send an email invite
   */
  async createInvite(orgId: string, email: string, role: string) {
    try {
      // Check if organization exists
      const org = await prismaRead.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        throw new Error('Organization not found');
      }

      // Generate invite ID
      const inviteId = randomUUID();

      // Create expiry date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      logger.info({ orgId, email, role }, 'Organization invite created');

      // Return invite object (in production, would also send email)
      return {
        id: inviteId,
        email,
        role,
        status: 'pending',
        createdAt: new Date(),
        expiresAt,
      };
    } catch (error) {
      logger.error({ error, orgId, email }, 'Failed to create organization invite');
      throw error;
    }
  }

  /**
   * Get organization members with pagination
   */
  async getMembers(orgId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [members, total] = await Promise.all([
        prismaRead.organizationMember.findMany({
          where: { organization_id: orgId },
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prismaRead.organizationMember.count({
          where: { organization_id: orgId },
        }),
      ]);

      const formattedMembers = members.map((m: any) => ({
        userId: m.user_id,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        role: m.role,
        joinedAt: m.createdAt,
      }));

      return { members: formattedMembers, total };
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to get organization members');
      throw error;
    }
  }

  /**
   * Remove a member from organization
   */
  async removeMember(orgId: string, memberId: string): Promise<void> {
    try {
      await prismaWrite.organizationMember.delete({
        where: {
          organization_id_user_id: {
            organization_id: orgId,
            user_id: memberId,
          },
        },
      });

      logger.info({ orgId, memberId }, 'Member removed from organization');
    } catch (error) {
      logger.error({ error, orgId, memberId }, 'Failed to remove organization member');
      throw error;
    }
  }

  /**
   * Update organization details
   */
  async updateOrganization(
    orgId: string,
    userId: string,
    data: {
      name?: string;
      legal_name?: string;
      country?: string;
      org_email?: string;
      org_phone?: string;
      location?: string;
    }
  ) {
    try {
      // Verify user is owner of the organization
      const isOwner = await prismaRead.organizationMember.findFirst({
        where: {
          organization_id: orgId,
          user_id: userId,
          role: 'OWNER',
        },
      });
      const isOwner1 = await prismaRead.organizationMember.findFirst({
        where: {
          organization_id: orgId,
          user_id: userId,
        },
      });

      if (!isOwner) {
        throw new Error('Only organization owner can update organization details');
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.legal_name !== undefined) updateData.legal_name = data.legal_name;
      if (data.country !== undefined) updateData.country = data.country;
      if (data.org_email !== undefined) updateData.org_email = data.org_email;
      if (data.org_phone !== undefined) updateData.org_phone = data.org_phone;
      if (data.location !== undefined) updateData.location = data.location;

      const updated = await prismaWrite.organization.update({
        where: { id: orgId },
        data: updateData,
        select: {
          id: true,
          name: true,
          legal_name: true,
          country: true,
          org_email: true,
          org_phone: true,
          location: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info({ orgId }, 'Organization updated');
      return updated;
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to update organization');
      throw error;
    }
  }

  /**
   * Delete organization (Owner only)
   */
  async deleteOrganization(orgId: string, userId: string): Promise<void> {
    try {
      // Verify user is owner
      const isOwner = await prismaRead.organizationMember.findFirst({
        where: {
          organization_id: orgId,
          user_id: userId,
          role: 'OWNER',
        },
      });

      if (!isOwner) {
        throw new Error('Only organization owner can delete organization');
      }

      // Delete organization (cascade will handle members, etc.)
      await prismaWrite.organization.delete({
        where: { id: orgId },
      });

      logger.info({ orgId }, 'Organization deleted');
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to delete organization');
      throw error;
    }
  }
}
