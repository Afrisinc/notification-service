import pino from 'pino';
import nodemailer from 'nodemailer';
import { EmailNotification, EmailProvider } from '@shared/common';
import { getConfig } from '@shared/config';

export class SMTPProvider implements EmailProvider {
  name = 'smtp';
  private transporter: nodemailer.Transporter;

  constructor(private logger: pino.Logger) {
    const config = getConfig();

    if (!config.SMTP_HOST || !config.SMTP_PORT) {
      throw new Error('SMTP_HOST and SMTP_PORT are required for SMTP provider');
    }

    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth:
        config.SMTP_USER && config.SMTP_PASSWORD
          ? {
              user: config.SMTP_USER,
              pass: config.SMTP_PASSWORD,
            }
          : undefined,
    });

    this.logger.info('SMTP provider initialized');
  }

  async send(email: EmailNotification): Promise<{ messageId: string }> {
    try {
      const config = getConfig();
      let fromEmail = config.FROM_EMAIL || config.SMTP_FROM || 'noreply@notification.local';
      let fromName: string | undefined = undefined;

      // Try to get app-specific email config if appId is provided
      if (email.appId) {
        try {
          const { prismaRead } = await import('@shared/database');
          const emailConfig = await prismaRead.appEmailConfig.findUnique({
            where: { app_id: email.appId },
          });

          if (emailConfig) {
            fromEmail = emailConfig.from_email;
            fromName = emailConfig.from_name || undefined;
            this.logger.debug({ appId: email.appId, from: fromEmail }, 'Using app-specific email configuration');
          }
        } catch (configError) {
          this.logger.warn(
            { error: configError, appId: email.appId },
            'Failed to load app-specific email config, using platform default'
          );
          // Continue with platform default
        }
      }

      const mailOptions = {
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: email.to,
        subject: email.subject,
        text: email.body,
        html: email.html || email.body,
      };

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.debug({ messageId: result.messageId, to: email.to }, 'Email sent via SMTP');

      return { messageId: result.messageId || 'unknown' };
    } catch (error) {
      this.logger.error({ error, to: email.to }, 'SMTP provider failed to send email');
      throw error;
    }
  }
}
