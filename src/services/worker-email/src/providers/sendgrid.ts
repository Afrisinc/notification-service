import pino from 'pino';
import sgMail from '@sendgrid/mail';
import { EmailNotification, EmailProvider } from '@shared/common';
import { getConfig } from '@shared/config';

export class SendGridProvider implements EmailProvider {
  name = 'sendgrid';

  constructor(private logger: pino.Logger) {
    const config = getConfig();

    if (!config.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY is required for SendGrid provider');
    }

    sgMail.setApiKey(config.SENDGRID_API_KEY);
    this.logger.info('SendGrid provider initialized');
  }

  async send(email: EmailNotification): Promise<{ messageId: string }> {
    try {
      const config = getConfig();

      // Use sender info from message (resolved at publish time)
      let fromEmail = (email as any).fromEmail;
      let fromName = (email as any).fromName;

      // If not in message, try to look up from database (fallback for safety)
      if (!fromEmail && email.appId) {
        try {
          const database = await import('@shared/database');
          if (database && database.prismaRead) {
            const emailConfig = await database.prismaRead.appEmailProvider.findUnique({
              where: { app_id: email.appId },
            });

            if (emailConfig) {
              fromEmail = emailConfig.from_email;
              fromName = emailConfig.from_name || fromName;
              this.logger.debug(
                { appId: email.appId, from: fromEmail },
                'Using app-specific email config (fallback lookup)'
              );
            }
          }
        } catch (configError) {
          this.logger.warn(
            { error: configError instanceof Error ? configError.message : String(configError), appId: email.appId },
            'Fallback app config lookup failed'
          );
        }
      }

      // Use platform default if still not found
      if (!fromEmail) {
        fromEmail = config.FROM_EMAIL || config.SMTP_FROM || 'noreply@notification.local';
      }

      if (!fromName) {
        fromName = 'Afrisinc';
      }

      const msg: any = {
        to: email.to,
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        subject: email.subject,
        text: email.body,
        html: email.html || email.body,
      };

      // Add attachments if present
      if (email.attachments && email.attachments.length > 0) {
        msg.attachments = email.attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          type: att.contentType,
          disposition: 'attachment',
        }));
        this.logger.debug({ count: email.attachments.length }, 'Adding attachments to SendGrid email');
      }

      this.logger.debug({ to: email.to, from: msg.from, appId: email.appId }, 'Sending email via SendGrid');

      const result = await sgMail.send(msg);

      const messageId = (result[0].headers['x-message-id'] as string) || 'unknown';

      this.logger.debug({ messageId, to: email.to, from: msg.from }, 'Email sent via SendGrid');

      return { messageId };
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error), to: email.to },
        'SendGrid provider failed to send email'
      );
      throw error;
    }
  }
}
