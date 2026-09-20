import { randomUUID } from 'node:crypto';
import { prismaRead } from '@shared/database';
import { InboxRepository, ThreadPagination } from '../repositories/inbox.repository';
import { AppEmailProviderRepository } from '../repositories/app-email-provider.repository';
import { EmailSenderRepository } from '../repositories/email-identity.repository';
import { OrganizationService } from './organization.service';
import { getQueuePublisher } from './notify.service';
import { logger } from '../config/logger';

const organizationService = new OrganizationService();

export type ThreadScope = { kind: 'org'; orgId: string } | { kind: 'recipient'; email: string };

export interface ComposeThreadInput {
  orgId: string;
  userId: string;
  senderId: string;
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  html?: string;
}

function normalizeAddressList(addresses?: string[]): string[] {
  return (addresses ?? []).map((a) => a.toLowerCase().trim()).filter(Boolean);
}

function serializeMessage(message: any) {
  return {
    id: message.id,
    direction: message.direction,
    fromAddress: message.from_address,
    toAddresses: message.to_addresses,
    ccAddresses: message.cc_addresses ?? [],
    subject: message.subject,
    textBody: message.text_body,
    htmlBody: message.html_body,
    createdAt: message.created_at,
    attachments: (message.attachments || []).map((a: any) => ({
      id: a.id,
      filename: a.filename,
      contentType: a.content_type,
      sizeBytes: a.size_bytes,
      url: a.storage_url,
    })),
  };
}

function serializeThreadSummary(thread: any) {
  return {
    id: thread.id,
    appId: thread.app_id,
    appName: thread.app?.name,
    domain: thread.domain?.domain,
    contactEmail: thread.contact_email,
    subject: thread.subject,
    status: thread.status,
    lastMessageAt: thread.last_message_at,
  };
}

function serializeThreadDetail(thread: any) {
  return {
    ...serializeThreadSummary(thread),
    messages: (thread.messages || []).map(serializeMessage),
  };
}

export class InboxService {
  async listThreadsForOrg(orgId: string, pagination: ThreadPagination) {
    const { threads, total } = await InboxRepository.findThreadsByOrg(orgId, pagination);
    return { threads: threads.map(serializeThreadSummary), total };
  }

  async listThreadsForRecipient(email: string, pagination: ThreadPagination) {
    const normalizedEmail = email.toLowerCase().trim();
    const { threads, total } = await InboxRepository.findThreadsByContactEmail(normalizedEmail, pagination);
    return { threads: threads.map(serializeThreadSummary), total };
  }

  async getThreadDetail(threadId: string, scope: ThreadScope) {
    const thread = await this.loadAuthorizedThread(threadId, scope);
    return serializeThreadDetail(thread);
  }

  /**
   * Starts a brand-new thread to an arbitrary address, independent of any
   * App or template - the caller picks one of the organization's own sender
   * identities (see org-domain.service.ts) and it's used directly. There is
   * no "recipient compose" equivalent, since a recipient may only reply
   * within threads already addressed to them.
   */
  async composeThread(input: ComposeThreadInput) {
    const sender = await EmailSenderRepository.findById(input.senderId);
    if (!sender || sender.domain.organization_id !== input.orgId) {
      throw new Error('Sender not found');
    }
    if (sender.domain.status !== 'verified') {
      throw new Error('This domain must be verified before it can be used to send email');
    }

    const canUseSender =
      sender.assigned_user_id === input.userId ||
      (await organizationService.canManageOrganization(input.orgId, input.userId));
    if (!canUseSender) {
      throw new Error('This sender is not assigned to you');
    }

    const account = await prismaRead.account.findFirst({ where: { organization_id: input.orgId } });
    const fromEmail = `${sender.local_part}@${sender.domain.domain}`;
    const toAddress = input.to.toLowerCase().trim();
    const ccAddresses = normalizeAddressList(input.cc);
    const messageIdHeader = `<compose-${randomUUID()}@${sender.domain.domain}>`;

    const { thread, message } = await InboxRepository.createThread(
      { organizationId: input.orgId },
      sender.domain_id,
      toAddress,
      input.subject,
      {
        from_address: fromEmail,
        to_addresses: [toAddress],
        cc_addresses: ccAddresses,
        subject: input.subject,
        text_body: input.body,
        html_body: input.html,
        message_id_header: messageIdHeader,
      }
    );

    await this.publishOutboundEmail({
      tenantId: account?.id ?? input.orgId,
      to: toAddress,
      cc: ccAddresses,
      subject: input.subject,
      body: input.body,
      fromEmail,
      fromName: sender.from_name ?? undefined,
      messageIdHeader,
      threadReplyToAddress: `thread+${thread.id}@${sender.domain.domain}`,
      directSend: {
        fromEmail,
        fromName: sender.from_name ?? undefined,
        domain: sender.domain.domain,
        selector: sender.domain.selector,
      },
    });

    return serializeThreadDetail({ ...thread, domain: sender.domain, messages: [message] });
  }

  async replyToThread(threadId: string, scope: ThreadScope, data: { body: string; html?: string; cc?: string[] }) {
    const thread = await this.loadAuthorizedThread(threadId, scope);

    const message =
      scope.kind === 'recipient'
        ? await this.recordRecipientReply(thread, scope.email, data)
        : await this.sendBusinessReply(thread, data);

    return serializeMessage(message);
  }

  private async loadAuthorizedThread(threadId: string, scope: ThreadScope) {
    const thread = await InboxRepository.findThreadById(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }
    if (scope.kind === 'org' && thread.organization_id !== scope.orgId) {
      throw new Error('Thread not found');
    }
    if (scope.kind === 'recipient' && thread.contact_email !== scope.email.toLowerCase().trim()) {
      throw new Error('Thread not found');
    }
    return thread;
  }

  /**
   * A recipient's portal reply can never be sent as real SMTP mail "from"
   * their own address - we don't control their domain's SPF/DKIM, so a real
   * send would fail authentication (or be an outright spoof). It's recorded
   * directly instead, exactly as if it had arrived over LMTP - which is
   * also all that's needed, since the business reads it from their own
   * inbox UI rather than a real mailbox.
   */
  private async recordRecipientReply(thread: any, email: string, data: { body: string; html?: string; cc?: string[] }) {
    const lastMessage = thread.messages[thread.messages.length - 1];
    const messageIdHeader = `<reply-${randomUUID()}@${thread.domain.domain}>`;

    return InboxRepository.createReplyMessage(thread.id, 'inbound', {
      from_address: email.toLowerCase().trim(),
      to_addresses: [`thread+${thread.id}@${thread.domain.domain}`],
      cc_addresses: normalizeAddressList(data.cc),
      subject: thread.subject ? `Re: ${thread.subject}` : undefined,
      text_body: data.body,
      html_body: data.html,
      message_id_header: messageIdHeader,
      in_reply_to: lastMessage?.message_id_header,
      references: lastMessage ? [...lastMessage.references, lastMessage.message_id_header] : [],
    });
  }

  /**
   * A business reply is real outbound mail - the recipient's address is
   * external and must actually receive it. Any org member with inbox access
   * may reply to a shared thread (like any team shared-inbox product); the
   * reply always continues using the thread's own existing From identity
   * rather than requiring the replier to personally own that sender -
   * per-member assignment governs who can START a new conversation as a
   * given address (composeThread), not who may continue an existing one.
   */
  private async sendBusinessReply(thread: any, data: { body: string; html?: string; cc?: string[] }) {
    const lastMessage = thread.messages[thread.messages.length - 1];
    const messageIdHeader = `<reply-${randomUUID()}@${thread.domain.domain}>`;
    const referencesHeader = lastMessage ? [...lastMessage.references, lastMessage.message_id_header] : [];
    const ccAddresses = normalizeAddressList(data.cc);

    const priorOutbound = [...thread.messages].reverse().find((m: any) => m.direction === 'outbound');
    const fromEmail = priorOutbound?.from_address;
    if (!fromEmail) {
      throw new Error('This thread has no sending identity to reply from');
    }

    const message = await InboxRepository.createReplyMessage(thread.id, 'outbound', {
      from_address: fromEmail,
      to_addresses: [thread.contact_email],
      cc_addresses: ccAddresses,
      subject: thread.subject ? `Re: ${thread.subject}` : 'Re: your message',
      text_body: data.body,
      html_body: data.html,
      message_id_header: messageIdHeader,
      in_reply_to: lastMessage?.message_id_header,
      references: referencesHeader,
    });

    const publishParams = {
      to: thread.contact_email,
      cc: ccAddresses,
      subject: message.subject ?? '',
      body: data.body,
      fromEmail,
      messageIdHeader,
      inReplyToMessageId: lastMessage?.message_id_header,
      referencesHeader,
      threadReplyToAddress: `thread+${thread.id}@${thread.domain.domain}`,
    };

    if (thread.app_id) {
      // Legacy app-based thread: resolve sender/tenant through the app's active provider, unchanged.
      const providerConfig = await AppEmailProviderRepository.findByAppId(thread.app_id);
      if (!providerConfig?.from_email) {
        throw new Error('This app has no active email sender configured');
      }
      const app = await prismaRead.app.findUnique({ where: { id: thread.app_id }, select: { account_id: true } });
      if (!app) {
        throw new Error('App not found');
      }

      await this.publishOutboundEmail({
        ...publishParams,
        tenantId: app.account_id,
        appId: thread.app_id,
        fromName: providerConfig.from_name ?? undefined,
      });
    } else {
      // Org-composed thread: resolve DKIM directly from the thread's own domain, no App involved.
      const account = await prismaRead.account.findFirst({ where: { organization_id: thread.organization_id } });
      await this.publishOutboundEmail({
        ...publishParams,
        tenantId: account?.id ?? thread.organization_id,
        directSend: { fromEmail, domain: thread.domain.domain, selector: thread.domain.selector },
      });
    }

    return message;
  }

  private async publishOutboundEmail(params: {
    tenantId: string;
    appId?: string;
    to: string;
    cc?: string[];
    subject: string;
    body: string;
    fromEmail: string;
    fromName?: string;
    messageIdHeader: string;
    inReplyToMessageId?: string;
    referencesHeader?: string[];
    threadReplyToAddress: string;
    directSend?: { fromEmail: string; fromName?: string; domain: string; selector: string };
  }) {
    try {
      await getQueuePublisher().publish({
        notificationId: randomUUID(),
        tenantId: params.tenantId,
        appId: params.appId,
        channel: 'EMAIL',
        recipient: params.to,
        cc: params.cc,
        subject: params.subject,
        body: params.body,
        payload: {},
        priority: 'NORMAL',
        timestamp: new Date(),
        fromEmail: params.fromEmail,
        fromName: params.fromName,
        messageIdHeader: params.messageIdHeader,
        inReplyToMessageId: params.inReplyToMessageId,
        referencesHeader: params.referencesHeader,
        threadReplyToAddress: params.threadReplyToAddress,
        directSend: params.directSend,
      });
    } catch (error) {
      logger.error({ error, to: params.to }, 'Failed to publish outbound email to send queue');
      throw error;
    }
  }
}

export const inboxService = new InboxService();
