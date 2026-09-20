import { prismaRead, prismaWrite } from '@shared/database';
import { logger } from '../config/logger';
import { transformPrismaError } from '../utils/db-errors';

export interface CreateEmailDomainData {
  domain: string;
  selector: string;
  dkim_public_key?: string | null;
  dkim_private_key_path?: string | null;
}

export interface CreateEmailSenderData {
  local_part: string;
  from_name?: string | null;
  reply_to_email?: string | null;
  reply_to_name?: string | null;
  assigned_user_id?: string | null;
}

const domainWithSenders = {
  senders: { orderBy: { created_at: 'asc' as const } },
};

export class EmailDomainRepository {
  static async findByApp(appId: string) {
    try {
      return await prismaRead.emailDomain.findMany({
        where: { app_id: appId },
        include: domainWithSenders,
        orderBy: { created_at: 'asc' },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to list email domains for app');
      throw error;
    }
  }

  static async findById(domainId: string) {
    try {
      return await prismaRead.emailDomain.findUnique({
        where: { id: domainId },
        include: domainWithSenders,
      });
    } catch (error) {
      logger.error({ error, domainId }, 'Failed to find email domain');
      throw error;
    }
  }

  static async create(appId: string, data: CreateEmailDomainData) {
    try {
      return await prismaWrite.emailDomain.create({
        data: {
          app_id: appId,
          domain: data.domain,
          selector: data.selector,
          dkim_public_key: data.dkim_public_key ?? null,
          dkim_private_key_path: data.dkim_private_key_path ?? null,
        },
        include: domainWithSenders,
      });
    } catch (error) {
      logger.error({ error, appId, domain: data.domain }, 'Failed to create email domain');
      throw transformPrismaError(error, 'email-identity.repository');
    }
  }

  static async updateVerification(
    domainId: string,
    data: {
      spf_verified: boolean;
      dkim_verified: boolean;
      dmarc_verified: boolean;
      status: 'pending' | 'verified' | 'suspended';
      verified_at?: Date | null;
    }
  ) {
    try {
      return await prismaWrite.emailDomain.update({
        where: { id: domainId },
        data,
        include: domainWithSenders,
      });
    } catch (error) {
      logger.error({ error, domainId }, 'Failed to update email domain verification');
      throw error;
    }
  }

  static async updateInbound(
    domainId: string,
    data: { inbound_enabled: boolean; mx_verified: boolean; mx_verified_at: Date | null }
  ) {
    try {
      return await prismaWrite.emailDomain.update({
        where: { id: domainId },
        data,
        include: domainWithSenders,
      });
    } catch (error) {
      logger.error({ error, domainId }, 'Failed to update inbound email settings');
      throw error;
    }
  }

  static async updateCloudflareConnection(
    domainId: string,
    data: { cloudflare_zone_id: string | null; cloudflare_api_token: string | null; cloudflare_connected: boolean }
  ) {
    try {
      return await prismaWrite.emailDomain.update({
        where: { id: domainId },
        data,
      });
    } catch (error) {
      logger.error({ error, domainId }, 'Failed to update Cloudflare connection');
      throw error;
    }
  }

  static async delete(domainId: string) {
    try {
      await prismaWrite.emailDomain.delete({ where: { id: domainId } });
    } catch (error) {
      logger.error({ error, domainId }, 'Failed to delete email domain');
      throw error;
    }
  }

  /** Org-level flow: domains registered directly against an Organization, not any single App. */
  static async findByOrg(orgId: string) {
    try {
      return await prismaRead.emailDomain.findMany({
        where: { organization_id: orgId },
        include: domainWithSenders,
        orderBy: { created_at: 'asc' },
      });
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to list email domains for organization');
      throw error;
    }
  }

  static async createForOrg(orgId: string, data: CreateEmailDomainData) {
    try {
      return await prismaWrite.emailDomain.create({
        data: {
          organization_id: orgId,
          domain: data.domain,
          selector: data.selector,
          dkim_public_key: data.dkim_public_key ?? null,
          dkim_private_key_path: data.dkim_private_key_path ?? null,
        },
        include: domainWithSenders,
      });
    } catch (error) {
      logger.error({ error, orgId, domain: data.domain }, 'Failed to create organization email domain');
      throw transformPrismaError(error, 'email-identity.repository');
    }
  }
}

export class EmailSenderRepository {
  static async findById(senderId: string) {
    try {
      return await prismaRead.emailSender.findUnique({
        where: { id: senderId },
        include: { domain: true },
      });
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to find email sender');
      throw error;
    }
  }

  static async create(domainId: string, data: CreateEmailSenderData) {
    try {
      return await prismaWrite.emailSender.create({
        data: {
          domain_id: domainId,
          local_part: data.local_part,
          from_name: data.from_name ?? null,
          reply_to_email: data.reply_to_email ?? null,
          reply_to_name: data.reply_to_name ?? null,
          assigned_user_id: data.assigned_user_id ?? null,
        },
        include: { domain: true, assignedUser: true },
      });
    } catch (error) {
      logger.error({ error, domainId, localPart: data.local_part }, 'Failed to create email sender');
      throw error;
    }
  }

  static async update(
    senderId: string,
    data: Partial<Pick<CreateEmailSenderData, 'from_name' | 'reply_to_email' | 'reply_to_name' | 'assigned_user_id'>>
  ) {
    try {
      return await prismaWrite.emailSender.update({
        where: { id: senderId },
        data,
        include: { domain: true, assignedUser: true },
      });
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to update email sender');
      throw error;
    }
  }

  /**
   * Atomically mark one sender as the app's default, clearing the flag on every
   * other sender belonging to the same app (across all of the app's domains).
   */
  static async setAsDefault(appId: string, senderId: string) {
    try {
      const [, sender] = await prismaWrite.$transaction([
        prismaWrite.emailSender.updateMany({
          where: { domain: { app_id: appId } },
          data: { is_default: false },
        }),
        prismaWrite.emailSender.update({
          where: { id: senderId },
          data: { is_default: true },
          include: { domain: true },
        }),
      ]);
      return sender;
    } catch (error) {
      logger.error({ error, appId, senderId }, 'Failed to set default email sender');
      throw error;
    }
  }

  static async delete(senderId: string) {
    try {
      await prismaWrite.emailSender.delete({ where: { id: senderId } });
    } catch (error) {
      logger.error({ error, senderId }, 'Failed to delete email sender');
      throw error;
    }
  }

  /** Org-level flow: every sender under any domain owned directly by the organization. */
  static async findByOrg(orgId: string) {
    try {
      return await prismaRead.emailSender.findMany({
        where: { domain: { organization_id: orgId } },
        include: { domain: true, assignedUser: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { created_at: 'asc' },
      });
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to list email senders for organization');
      throw error;
    }
  }

  /** Senders a given member may send/reply as: everything if privileged (OWNER/ADMIN), else only their own assignments. */
  static async findForUser(orgId: string, userId: string, privileged: boolean) {
    try {
      return await prismaRead.emailSender.findMany({
        where: {
          domain: { organization_id: orgId },
          ...(privileged ? {} : { assigned_user_id: userId }),
        },
        include: { domain: true },
        orderBy: { created_at: 'asc' },
      });
    } catch (error) {
      logger.error({ error, orgId, userId }, 'Failed to list email senders for user');
      throw error;
    }
  }
}
