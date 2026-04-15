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
      let replyTo: string | undefined = undefined;

      // Try to get custom domain first if appId is provided
      if (email.appId) {
        try {
          const { prismaRead } = await import('@shared/database');
          const customDomain = await prismaRead.customerDomain.findFirst({
            where: {
              app_id: email.appId,
              status: 'verified',
            },
          });

          if (customDomain) {
            fromEmail = customDomain.from_email;
            fromName = customDomain.from_name || undefined;
            replyTo = customDomain.from_email;
            this.logger.debug(
              { appId: email.appId, domain: customDomain.domain, from: fromEmail },
              'Using app custom domain for email'
            );
          }
        } catch (customDomainError) {
          this.logger.warn(
            { error: customDomainError, appId: email.appId },
            'Failed to load custom domain config, trying app config'
          );
          // Continue with app config or default
        }
      }

      // Try to get app-specific email config if appId is provided (only if no custom domain)
      if (!replyTo && email.appId) {
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

      const mailOptions: any = {
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: email.to,
        subject: email.subject,
        text: email.body,
        html: email.html || email.body,
      };

      // Add replyTo if set (from custom domain)
      if (replyTo) {
        mailOptions.replyTo = replyTo;
      }

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.debug({ messageId: result.messageId, to: email.to }, 'Email sent via SMTP');

      return { messageId: result.messageId || 'unknown' };
    } catch (error) {
      this.logger.error({ error, to: email.to }, 'SMTP provider failed to send email');
      throw error;
    }
  }
}
