import { randomUUID, createHash } from 'crypto';
import pino from 'pino';
import { prismaRead, prismaWrite } from '@shared/database';
import { NotifyService } from './notify.service';
import { env } from '../config/env';
import { template } from 'handlebars';
import { accountRepository } from '../repositories/account.repository';

const logger = pino();

export class OrganizationService {
  /**
   * Create a new organization
   */
  async createOrganization(
    data: {
      name: string;
      legalName?: string;
      country?: string;
      location?: string;
      taxId?: string;
      email?: string;
      phone?: string;
    },
    userId: string
  ) {
    try {
      // Create organization
      const org = await prismaWrite.organization.create({
        data: {
          id: randomUUID(),
          name: data.name,
          slug: data.name.toLowerCase().replace(/\s+/g, '-'),
          legal_name: data.legalName,
          country: data.country || 'NG',
          location: data.location,
          tax_id: data.taxId,
          org_email: data.email,
          org_phone: data.phone,
        },
      });

      // Add user as owner
      await prismaWrite.organizationMember.create({
        data: {
          id: randomUUID(),
          organization_id: org.id,
          user_id: userId,
          role: 'OWNER',
        },
      });

      // Create account for the organization to associate with user
      await prismaWrite.account.create({
        data: {
          id: randomUUID(),
          owner_user_id: userId,
          organization_id: org.id,
          type: 'ORGANIZATION',
        },
      });

      return org;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to create organization');
      throw error;
    }
  }

  /**
   * List organizations for a user
   */
  async listOrganizations(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [organizations, total] = await Promise.all([
        prismaRead.organization.findMany({
          where: {
            members: {
              some: {
                user_id: userId,
              },
            },
          },
          include: {
            _count: {
              select: {
                members: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prismaRead.organization.count({
          where: {
            members: {
              some: {
                user_id: userId,
              },
            },
          },
        }),
      ]);

      return {
        organizations,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to list organizations');
      throw error;
    }
  }

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
   * Get organization details by ID
   */
  async getOrganizationById(orgId: string) {
    try {
      const org = await prismaRead.organization.findUnique({
        where: { id: orgId },
        include: {
          _count: true,
        },
      });

      return org;
    } catch (error) {
      logger.error({ error, orgId }, 'Error fetching organization');
      throw error;
    }
  }

  /**
   * Create an invite for someone to join an organization
   * Stores invite with token in database and sends email notification
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

      // check if invite exist for the email and organization and is still pending
      const invit = await prismaRead.organizationInvite.findFirst({
        where: {
          organization_id: orgId,
          email: email,
          status: 'pending',
          expiresAt: { gt: new Date() },
        },
      });
      if (invit) {
        logger.warn({ orgId, email }, 'Still pending invite for this email already exists for the organization');
        throw new Error('Still pending invite for this email already exists for the organization');
      }

      // check if the user is already a member of the organization
      const user = await prismaRead.user.findUnique({
        where: { email },
      });

      if (user) {
        // Check if the user is already a member of the organization
        const isMember = await prismaRead.organizationMember.findFirst({
          where: {
            organization_id: orgId,
            user_id: user.id,
          },
        });

        if (isMember) {
          logger.warn({ orgId, email }, 'User is already a member of the organization');
          throw new Error('User is already a member of the organization');
        }
      }

      // Generate invite ID and token
      const inviteId = randomUUID();
      const inviteToken = randomUUID();

      // Create expiry date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Store invite in database with plaintext token (upsert to recycle old/expired invite records)
      const storedInvite = await prismaWrite.organizationInvite.upsert({
        where: {
          organization_id_email: {
            organization_id: orgId,
            email: email,
          },
        },
        update: {
          role,
          token: inviteToken,
          status: 'pending',
          expiresAt,
        },
        create: {
          id: inviteId,
          organization_id: orgId,
          email,
          role,
          token: inviteToken,
          status: 'pending',
          expiresAt,
        },
      });

      // Generate invitation link with plaintext token
      const invitationLink = `${env.WEBAPP_URL}/invite/${inviteId}/${inviteToken}`;

      logger.info({ orgId, email, role, inviteId }, 'Organization invite created and stored');

      // Send invite email using notification service
      try {
        const notifyService = new NotifyService();

        // Extract member name from email (part before @)
        const memberName = email.split('@')[0];

        await notifyService.sendNotification(env.ACCOUNT_ID, env.SYSTEM_APP_ID, {
          channel: 'EMAIL',
          recipient: email,
          templateId: env.INVITE_MEMBER_TEMPLATE_ID, // Organization invite template
          app_id: env.SYSTEM_APP_ID,
          payload: {
            member_name: memberName,
            org_name: org.name,
            role: role,
            invitation_link: invitationLink,
            expiry_time: '7 Days',
            platform_name: env.COMPANY_NAME,
          },
        });

        logger.info({ email, orgId }, 'Organization invite email sent');
      } catch (emailError) {
        logger.warn({ emailError, email }, 'Failed to send organization invite email, but invite stored in database');
        // Don't throw - invite was created even if email fails
      }

      // Return invite object
      return {
        id: storedInvite.id,
        email: storedInvite.email,
        role: storedInvite.role,
        status: storedInvite.status,
        invitationLink,
        createdAt: storedInvite.createdAt,
        expiresAt: storedInvite.expiresAt,
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
   * Get organization invites with pagination
   */
  async getInvites(orgId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [invites, total] = await Promise.all([
        prismaRead.organizationInvite.findMany({
          where: {
            organization_id: orgId,
            status: 'pending',
            expiresAt: { gt: new Date() },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prismaRead.organizationInvite.count({
          where: {
            organization_id: orgId,
            status: 'pending',
            expiresAt: { gt: new Date() },
          },
        }),
      ]);

      const formattedInvites = invites.map((i: any) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        invitationLink: `${env.WEBAPP_URL}/invite/${i.id}/${i.token}`,
      }));

      return { invites: formattedInvites, total };
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to get organization invites');
      throw error;
    }
  }

  /**
   * Get pending invites for a specific user (by email)
   */
  async getUserInvites(userId: string) {
    try {
      // Get user email
      const user = await prismaRead.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Find pending invites for this email
      const invites = await prismaRead.organizationInvite.findMany({
        where: {
          email: user.email,
          status: 'pending',
          expiresAt: {
            gt: new Date(), // Filter out expired invites
          },
        },
        include: {
          organization: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return invites.map((i: any) => ({
        id: i.id,
        orgId: i.organization_id,
        orgName: i.organization.name,
        role: i.role,
        status: i.status,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        token: i.token,
        invitationLink: `${env.WEBAPP_URL}/invite/${i.id}/${i.token}`,
      }));
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user invites');
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
   * Validate an organization invitation by fetching from database and verifying token
   */
  async validateInvite(inviteId: string, token: string) {
    try {
      // Fetch invite from database
      const invite = await prismaRead.organizationInvite.findUnique({
        where: { id: inviteId },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });

      if (!invite) {
        logger.warn({ inviteId }, 'Invitation not found');
        return null;
      }

      // Verify token matches stored token
      if (invite.token !== token) {
        logger.warn({ inviteId }, 'Invalid invitation token');
        return null;
      }

      // Check if invitation has expired
      if (new Date() > invite.expiresAt) {
        logger.warn({ inviteId }, 'Invitation has expired');
        // Update status to expired
        await prismaWrite.organizationInvite.update({
          where: { id: inviteId },
          data: { status: 'expired' },
        });
        return null;
      }

      // Check if already accepted
      if (invite.status === 'accepted') {
        logger.warn({ inviteId }, 'Invitation already accepted');
        return null;
      }

      logger.info({ inviteId, email: invite.email }, 'Invitation validated successfully');
      return invite;
    } catch (error) {
      logger.error({ error, inviteId }, 'Error validating invitation');
      throw error;
    }
  }

  /**
   * Accept an organization invitation and add user to organization
   * Handles both new and existing users
   * User email must match invitation email
   */
  async acceptInvite(inviteId: string, token: string, userId: string) {
    try {
      // Validate the invite
      const invite = await this.validateInvite(inviteId, token);

      if (!invite) {
        throw new Error('Invalid or expired invitation');
      }

      // Get user details to verify email matches
      const user = await prismaRead.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify user email matches invitation email
      if (user.email !== invite.email) {
        logger.warn(
          { userId, inviteEmail: invite.email, userEmail: user.email },
          'Email mismatch for invitation acceptance'
        );
        throw new Error('Your email does not match the invitation email. Please log in with the invited email.');
      }

      // Check if user is already a member
      const existingMember = await prismaRead.organizationMember.findFirst({
        where: {
          organization_id: invite.organization_id,
          user_id: userId,
        },
      });

      if (existingMember) {
        throw new Error('User is already a member of this organization');
      }

      // Create organization member record
      const member = await prismaWrite.organizationMember.create({
        data: {
          organization_id: invite.organization_id,
          user_id: userId,
          role: invite.role as any, // role is OWNER, ADMIN, or MEMBER
        },
      });

      // Create account for the user in this organization
      // This allows the user to create templates and perform operations
      await accountRepository.create({
        id: randomUUID(),
        owner_user_id: userId,
        organization_id: invite.organization_id,
        type: 'ORGANIZATION',
      });

      // Update invite status to accepted
      await prismaWrite.organizationInvite.update({
        where: { id: inviteId },
        data: {
          status: 'accepted',
          acceptedBy_user_id: userId,
          acceptedAt: new Date(),
        },
      });

      logger.info({ inviteId, userId, orgId: invite.organization_id }, 'Organization invitation accepted');

      return {
        memberId: member.id,
        orgId: invite.organization_id,
        orgName: invite.organization.name,
        role: member.role,
        addedAt: member.createdAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept invitation';
      logger.error({ error, inviteId, userId }, message);
      throw error;
    }
  }

  /**
   * Decline an organization invitation
   * Sets status to "declined"
   */
  async declineInvite(inviteId: string, token: string, userId: string) {
    try {
      // Validate the invite
      const invite = await this.validateInvite(inviteId, token);

      if (!invite) {
        throw new Error('Invalid or expired invitation');
      }

      // Get user details to verify email matches
      const user = await prismaRead.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify user email matches invitation email
      if (user.email !== invite.email) {
        logger.warn(
          { userId, inviteEmail: invite.email, userEmail: user.email },
          'Email mismatch for invitation decline'
        );
        throw new Error('Your email does not match the invitation email. Please log in with the invited email.');
      }

      // Update invite status to declined
      await prismaWrite.organizationInvite.update({
        where: { id: inviteId },
        data: {
          status: 'declined',
          acceptedBy_user_id: userId,
          acceptedAt: new Date(), // using acceptedAt to track when it was actioned
        },
      });

      logger.info({ inviteId, userId, orgId: invite.organization_id }, 'Organization invitation declined');

      return {
        inviteId,
        status: 'declined',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decline invitation';
      logger.error({ error, inviteId, userId }, message);
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
