import { prismaRead, prismaWrite } from '@shared/database';
import { logger } from '../config/logger';

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
      throw error;
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
        },
      });
    } catch (error) {
      logger.error({ error, domainId, localPart: data.local_part }, 'Failed to create email sender');
      throw error;
    }
  }

  static async update(
    senderId: string,
    data: Partial<Pick<CreateEmailSenderData, 'from_name' | 'reply_to_email' | 'reply_to_name'>>
  ) {
    try {
      return await prismaWrite.emailSender.update({
        where: { id: senderId },
        data,
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
}
