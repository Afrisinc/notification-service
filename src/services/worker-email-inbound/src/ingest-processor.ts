import pino from 'pino';
import type { ParsedMail } from 'mailparser';
import { prismaRead, prismaWrite } from '@shared/database';
import { getAssetsClient, type Asset } from '../../api/src/utils/assets-client';

const THREAD_REPLY_LOCAL_PART = /^thread\+([0-9a-f-]{36})$/i;
const PRISMA_UNIQUE_CONSTRAINT_ERROR = 'P2002';

function extractDomain(address: string): string {
  return address.split('@')[1]?.toLowerCase() ?? '';
}

function toReferencesArray(references: ParsedMail['references']): string[] {
  if (!references) return [];
  return Array.isArray(references) ? references : [references];
}

function addressListToStrings(field: ParsedMail['to']): string[] {
  if (!field) return [];
  const list = Array.isArray(field) ? field.flatMap((f) => f.value) : field.value;
  return list.map((v) => v.address).filter((address): address is string => Boolean(address));
}

export class IngestProcessor {
  constructor(private logger: pino.Logger) {}

  /** Returns the inbound-enabled EmailDomain for an address, or null if unknown/not receiving. */
  async resolveDomain(rcptAddress: string) {
    const domain = extractDomain(rcptAddress);
    if (!domain) return null;

    return prismaRead.emailDomain.findFirst({
      where: { domain, inbound_enabled: true, mx_verified: true },
    });
  }

  async ingest(parsed: ParsedMail, rcptAddress: string): Promise<void> {
    const emailDomain = await this.resolveDomain(rcptAddress);
    if (!emailDomain) {
      this.logger.warn({ rcptAddress }, 'Rejecting inbound message for unrecognized/disabled domain');
      return;
    }

    const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase();
    if (!fromAddress) {
      this.logger.warn({ rcptAddress }, 'Inbound message has no From address, discarding');
      return;
    }

    const messageIdHeader = parsed.messageId || `<generated-${Date.now()}-${Math.random().toString(36).slice(2)}>`;
    const threadId = await this.resolveThreadId(rcptAddress, parsed, emailDomain, fromAddress);

    const toAddresses = addressListToStrings(parsed.to);
    if (toAddresses.length === 0) toAddresses.push(rcptAddress);
    const ccAddresses = addressListToStrings(parsed.cc);

    let message;
    try {
      message = await prismaWrite.emailMessage.create({
        data: {
          thread_id: threadId,
          direction: 'inbound',
          from_address: fromAddress,
          to_addresses: toAddresses,
          cc_addresses: ccAddresses,
          subject: parsed.subject,
          text_body: parsed.text,
          html_body: typeof parsed.html === 'string' ? parsed.html : undefined,
          message_id_header: messageIdHeader,
          in_reply_to: parsed.inReplyTo,
          references: toReferencesArray(parsed.references),
        },
      });
    } catch (error: any) {
      if (error?.code === PRISMA_UNIQUE_CONSTRAINT_ERROR) {
        this.logger.info({ messageIdHeader }, 'Duplicate inbound message (LMTP redelivery), skipping');
        return;
      }
      throw error;
    }

    await this.storeAttachments(message.id, parsed);

    await prismaWrite.emailThread.update({
      where: { id: threadId },
      data: { last_message_at: new Date(), status: 'open' },
    });

    this.logger.info({ threadId, messageId: message.id, from: fromAddress }, 'Inbound message ingested');
  }

  private async resolveThreadId(
    rcptAddress: string,
    parsed: ParsedMail,
    emailDomain: { id: string; app_id: string | null; organization_id: string | null },
    contactEmail: string
  ): Promise<string> {
    const domainId = emailDomain.id;
    const localPart = rcptAddress.split('@')[0];
    const verpMatch = localPart.match(THREAD_REPLY_LOCAL_PART);
    if (verpMatch) {
      const thread = await prismaRead.emailThread.findFirst({ where: { id: verpMatch[1], domain_id: domainId } });
      if (thread) return thread.id;
    }

    const referenceIds = [...toReferencesArray(parsed.references), parsed.inReplyTo].filter(Boolean) as string[];
    if (referenceIds.length > 0) {
      const matchedMessage = await prismaRead.emailMessage.findFirst({
        where: { message_id_header: { in: referenceIds } },
      });
      if (matchedMessage) return matchedMessage.thread_id;
    }

    const existingThread = await prismaRead.emailThread.findFirst({
      where: { domain_id: domainId, contact_email: contactEmail },
      orderBy: { last_message_at: 'desc' },
    });
    if (existingThread) return existingThread.id;

    const created = await prismaWrite.emailThread.create({
      data: {
        app_id: emailDomain.app_id,
        organization_id: emailDomain.organization_id,
        domain_id: domainId,
        contact_email: contactEmail,
        subject: parsed.subject,
      },
    });
    return created.id;
  }

  private async storeAttachments(messageId: string, parsed: ParsedMail): Promise<void> {
    if (!parsed.attachments || parsed.attachments.length === 0) return;

    for (const attachment of parsed.attachments) {
      try {
        const filename = attachment.filename || 'attachment';
        const asset = (await getAssetsClient().uploadBuffer(attachment.content, filename, {
          tags: ['inbound-email'],
        })) as unknown as Asset;

        await prismaWrite.emailAttachment.create({
          data: {
            message_id: messageId,
            filename,
            content_type: attachment.contentType,
            size_bytes: attachment.size,
            storage_url: asset.url,
          },
        });
      } catch (error) {
        this.logger.warn(
          { messageId, filename: attachment.filename, error: error instanceof Error ? error.message : error },
          'Failed to store inbound attachment'
        );
      }
    }
  }
}
