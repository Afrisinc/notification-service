import { prismaRead, prismaWrite } from '@shared/database';
import { logger } from '../config/logger';

const threadWithApp = {
  app: { select: { id: true, name: true, organization_id: true } },
  domain: { select: { id: true, domain: true } },
};

export interface ThreadPagination {
  page?: number;
  pageSize?: number;
}

function paginationArgs({ page = 1, pageSize = 20 }: ThreadPagination) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export class InboxRepository {
  static async findThreadsByOrg(orgId: string, pagination: ThreadPagination = {}) {
    try {
      const where = { organization_id: orgId };
      const [threads, total] = await Promise.all([
        prismaRead.emailThread.findMany({
          where,
          include: threadWithApp,
          orderBy: { last_message_at: 'desc' },
          ...paginationArgs(pagination),
        }),
        prismaRead.emailThread.count({ where }),
      ]);
      return { threads, total };
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to list threads for organization');
      throw error;
    }
  }

  static async findThreadsByContactEmail(email: string, pagination: ThreadPagination = {}) {
    try {
      const where = { contact_email: email };
      const [threads, total] = await Promise.all([
        prismaRead.emailThread.findMany({
          where,
          include: threadWithApp,
          orderBy: { last_message_at: 'desc' },
          ...paginationArgs(pagination),
        }),
        prismaRead.emailThread.count({ where }),
      ]);
      return { threads, total };
    } catch (error) {
      logger.error({ error, email }, 'Failed to list threads for recipient');
      throw error;
    }
  }

  static async findThreadById(threadId: string) {
    try {
      return await prismaRead.emailThread.findUnique({
        where: { id: threadId },
        include: {
          ...threadWithApp,
          messages: { orderBy: { created_at: 'asc' }, include: { attachments: true } },
        },
      });
    } catch (error) {
      logger.error({ error, threadId }, 'Failed to load thread');
      throw error;
    }
  }

  static async createThread(
    owner: { appId?: string | null; organizationId?: string | null },
    domainId: string,
    contactEmail: string,
    subject: string | undefined,
    data: {
      from_address: string;
      to_addresses: string[];
      cc_addresses?: string[];
      subject?: string | null;
      text_body?: string | null;
      html_body?: string | null;
      message_id_header: string;
    }
  ) {
    try {
      return await prismaWrite.$transaction(async (tx) => {
        const thread = await tx.emailThread.create({
          data: {
            app_id: owner.appId ?? null,
            organization_id: owner.organizationId ?? null,
            domain_id: domainId,
            contact_email: contactEmail,
            subject,
          },
        });
        const message = await tx.emailMessage.create({
          data: { thread_id: thread.id, direction: 'outbound', references: [], ...data },
        });
        return { thread, message };
      });
    } catch (error) {
      logger.error({ error, owner, contactEmail }, 'Failed to create composed thread');
      throw error;
    }
  }

  static async createReplyMessage(
    threadId: string,
    direction: 'inbound' | 'outbound',
    data: {
      from_address: string;
      to_addresses: string[];
      cc_addresses?: string[];
      subject?: string | null;
      text_body?: string | null;
      html_body?: string | null;
      message_id_header: string;
      in_reply_to?: string | null;
      references: string[];
      sent_by_user_id?: string | null;
    }
  ) {
    try {
      const [message] = await prismaWrite.$transaction([
        prismaWrite.emailMessage.create({ data: { thread_id: threadId, direction, ...data } }),
        prismaWrite.emailThread.update({
          where: { id: threadId },
          data: { last_message_at: new Date(), status: 'open' },
        }),
      ]);
      return message;
    } catch (error) {
      logger.error({ error, threadId, direction }, 'Failed to record reply message');
      throw error;
    }
  }
}
