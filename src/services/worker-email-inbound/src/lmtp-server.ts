import pino from 'pino';
import { SMTPServer, SMTPServerAddress, SMTPServerSession, SMTPServerDataStream } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { IngestProcessor } from './ingest-processor';

export interface LmtpServerOptions {
  port: number;
  logger: pino.Logger;
}

/**
 * LMTP front-end for inbound mail. The upstream Postfix host (a separate box
 * from the outbound SSH-managed server - see README.md) delivers accepted
 * mail here via `virtual_transport = lmtp:inet:worker-email-inbound:<port>`.
 * Domain acceptance is enforced at RCPT TO time so unrecognized/non-receiving
 * domains are rejected before any message body is transferred.
 */
export function createLmtpServer(options: LmtpServerOptions): SMTPServer {
  const processor = new IngestProcessor(options.logger);

  const server = new SMTPServer({
    lmtp: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    logger: false,

    async onRcptTo(address: SMTPServerAddress, _session: SMTPServerSession, callback: (err?: Error) => void) {
      const domain = await processor.resolveDomain(address.address);
      if (!domain) {
        const error: any = new Error('Recipient domain not configured for inbound mail');
        error.responseCode = 550;
        return callback(error);
      }
      callback();
    },

    onData(stream: SMTPServerDataStream, session: SMTPServerSession, callback: (err?: Error) => void) {
      simpleParser(stream)
        .then(async (parsed) => {
          const recipients = session.envelope.rcptTo.map((r) => r.address);
          for (const rcpt of recipients) {
            await processor.ingest(parsed, rcpt).catch((error) => {
              options.logger.error({ error, rcpt }, 'Failed to ingest inbound message for recipient');
            });
          }
          callback();
        })
        .catch((error) => {
          options.logger.error({ error }, 'Failed to parse inbound MIME message');
          callback(error);
        });
    },
  });

  server.on('error', (error) => {
    options.logger.error({ error }, 'LMTP server error');
  });

  return server;
}
