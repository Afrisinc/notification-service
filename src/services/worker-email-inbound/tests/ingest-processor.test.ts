import pino from 'pino';
import { simpleParser } from 'mailparser';
import { prismaRead, prismaWrite } from '@shared/database';
import { getAssetsClient } from '../../api/src/utils/assets-client';
import { IngestProcessor } from '../src/ingest-processor';

jest.mock('@shared/database', () => ({
  prismaRead: {
    emailDomain: { findFirst: jest.fn() },
    emailThread: { findFirst: jest.fn() },
    emailMessage: { findFirst: jest.fn() },
  },
  prismaWrite: {
    emailMessage: { create: jest.fn() },
    emailThread: { create: jest.fn(), update: jest.fn() },
    emailAttachment: { create: jest.fn() },
  },
}));

jest.mock('../../api/src/utils/assets-client', () => ({
  getAssetsClient: jest.fn(),
}));

const domain = {
  id: 'domain-1',
  app_id: 'app-1',
  domain: 'acme.com',
  inbound_enabled: true,
  mx_verified: true,
};

function buildRawMime({
  messageId = '<msg-1@example.com>',
  inReplyTo,
  references,
}: { messageId?: string; inReplyTo?: string; references?: string } = {}) {
  const headers = [
    'From: Jane Doe <jane@customer.com>',
    'To: support@acme.com',
    'Subject: Help with my order',
    `Message-ID: ${messageId}`,
  ];
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);
  return `${headers.join('\r\n')}\r\n\r\nThanks for the help!\r\n`;
}

describe('IngestProcessor', () => {
  let processor: IngestProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new IngestProcessor(pino({ level: 'silent' }));
    (prismaRead.emailDomain.findFirst as jest.Mock).mockResolvedValue(domain);
    (prismaWrite.emailMessage.create as jest.Mock).mockResolvedValue({ id: 'message-1' });
    (prismaWrite.emailThread.update as jest.Mock).mockResolvedValue({});
  });

  it('rejects a recipient whose domain is not inbound-enabled', async () => {
    (prismaRead.emailDomain.findFirst as jest.Mock).mockResolvedValue(null);
    const result = await processor.resolveDomain('someone@unknown.com');
    expect(result).toBeNull();
  });

  it('creates a new thread when no reply headers or VERP address match', async () => {
    (prismaRead.emailThread.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaWrite.emailThread.create as jest.Mock).mockResolvedValue({ id: 'thread-new' });

    const parsed = await simpleParser(buildRawMime());
    await processor.ingest(parsed, 'support@acme.com');

    expect(prismaWrite.emailThread.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ app_id: 'app-1', domain_id: 'domain-1', contact_email: 'jane@customer.com' }),
    });
    expect(prismaWrite.emailMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        thread_id: 'thread-new',
        direction: 'inbound',
        from_address: 'jane@customer.com',
      }),
    });
  });

  it('resolves the thread via the VERP reply address before checking headers', async () => {
    const threadId = '11111111-1111-1111-1111-111111111111';
    (prismaRead.emailThread.findFirst as jest.Mock).mockResolvedValue({ id: threadId });

    const parsed = await simpleParser(buildRawMime());
    await processor.ingest(parsed, `thread+${threadId}@acme.com`);

    expect(prismaRead.emailThread.findFirst).toHaveBeenCalledWith({ where: { id: threadId, domain_id: 'domain-1' } });
    expect(prismaWrite.emailMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ thread_id: threadId }),
    });
  });

  it('resolves the thread via References header when no VERP match exists', async () => {
    (prismaRead.emailMessage.findFirst as jest.Mock).mockResolvedValue({ thread_id: 'thread-existing' });

    const parsed = await simpleParser(buildRawMime({ references: '<original@acme.com>' }));
    await processor.ingest(parsed, 'support@acme.com');

    expect(prismaRead.emailMessage.findFirst).toHaveBeenCalledWith({
      where: { message_id_header: { in: ['<original@acme.com>'] } },
    });
    expect(prismaWrite.emailMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ thread_id: 'thread-existing' }),
    });
  });

  it('skips silently on a duplicate message_id_header (idempotent LMTP redelivery)', async () => {
    (prismaRead.emailThread.findFirst as jest.Mock).mockResolvedValue({ id: 'thread-1' });
    (prismaWrite.emailMessage.create as jest.Mock).mockRejectedValue({ code: 'P2002' });

    const parsed = await simpleParser(buildRawMime());
    await expect(processor.ingest(parsed, 'support@acme.com')).resolves.toBeUndefined();
    expect(prismaWrite.emailThread.update).not.toHaveBeenCalled();
  });

  it('uploads attachments via the shared AssetsClient and records them', async () => {
    (prismaRead.emailThread.findFirst as jest.Mock).mockResolvedValue({ id: 'thread-1' });
    const uploadBuffer = jest.fn().mockResolvedValue({ url: 'https://assets.example.com/file.pdf' });
    (getAssetsClient as jest.Mock).mockReturnValue({ uploadBuffer });

    const raw =
      'From: Jane Doe <jane@customer.com>\r\n' +
      'To: support@acme.com\r\n' +
      'Subject: Invoice attached\r\n' +
      'Message-ID: <msg-attach@example.com>\r\n' +
      'Content-Type: multipart/mixed; boundary="b1"\r\n\r\n' +
      '--b1\r\nContent-Type: text/plain\r\n\r\nSee attached.\r\n' +
      '--b1\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename="invoice.pdf"\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\nJVBERi0xLjQK\r\n--b1--\r\n';

    const parsed = await simpleParser(raw);
    await processor.ingest(parsed, 'support@acme.com');

    expect(uploadBuffer).toHaveBeenCalledWith(expect.any(Buffer), 'invoice.pdf', { tags: ['inbound-email'] });
    expect(prismaWrite.emailAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        message_id: 'message-1',
        filename: 'invoice.pdf',
        storage_url: 'https://assets.example.com/file.pdf',
      }),
    });
  });
});
