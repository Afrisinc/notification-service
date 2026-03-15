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

      const msg = {
        to: email.to,
        from: config.SMTP_FROM || 'noreply@notification.local',
        subject: email.subject,
        text: email.body,
        html: email.html || email.body,
      };

      const result = await sgMail.send(msg);

      const messageId = (result[0].headers['x-message-id'] as string) || 'unknown';

      this.logger.debug({ messageId, to: email.to }, 'Email sent via SendGrid');

      return { messageId };
    } catch (error) {
      this.logger.error({ error, to: email.to }, 'SendGrid provider failed to send email');
      throw error;
    }
  }
}
