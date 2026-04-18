import pino from 'pino';
import nodemailer from 'nodemailer';
import { EmailNotification, EmailProvider } from '@shared/common';
import { getConfig } from '@shared/config';
import { prismaRead } from '@shared/database';

/**
 * Main SMTP Provider - Afrisinc's Primary Postfix Server
 * Handles all email sending through our internal Postfix server
 * with custom domain support
 */
export class MainSMTPProvider implements EmailProvider {
  name = 'main-smtp';
  private transporter: nodemailer.Transporter;

  constructor(private logger: pino.Logger) {
    const config = getConfig();

    if (!config.SMTP_HOST || !config.SMTP_PORT) {
      throw new Error('SMTP_HOST and SMTP_PORT are required for Main SMTP provider');
    }

    const transportOptions: any = {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      pool: {
        maxConnections: 10,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 50, // 50 messages per second
      },
    };

    if (config.SMTP_USER && config.SMTP_PASSWORD) {
      transportOptions.auth = {
        user: config.SMTP_USER,
        pass: config.SMTP_PASSWORD,
      };
    }

    this.transporter = nodemailer.createTransport(transportOptions);
    this.logger.info('Main SMTP provider initialized with Postfix server');
  }

  async send(email: EmailNotification): Promise<{ messageId: string }> {
    try {
      const config = getConfig();
      let fromEmail = config.FROM_EMAIL || config.SMTP_FROM || 'noreply@afrisinc.com';
      let fromName: string | undefined = undefined;
      let replyTo: string | undefined = undefined;

      // Priority 1: Custom Domain (if app has one and it's verified)
      if (email.appId) {
        try {
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
              'Using custom domain for email'
            );
          }
        } catch (customDomainError) {
          this.logger.warn(
            { error: customDomainError, appId: email.appId },
            'Failed to load custom domain, trying app config'
          );
        }
      }

      // Priority 2: App-specific email config (if no custom domain)
      if (!replyTo && email.appId) {
        try {
          const emailConfig = await prismaRead.appEmailConfig.findUnique({
            where: { app_id: email.appId },
          });

          if (emailConfig) {
            fromEmail = emailConfig.from_email;
            fromName = emailConfig.from_name || undefined;
            this.logger.debug({ appId: email.appId, from: fromEmail }, 'Using app-specific email config');
          }
        } catch (configError) {
          this.logger.warn(
            { error: configError, appId: email.appId },
            'Failed to load app config, using Afrisinc default'
          );
        }
      }

      const mailOptions: any = {
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: email.to,
        subject: email.subject,
        text: email.body,
        html: email.html || email.body,
      };

      // Add reply-to if set (from custom domain)
      if (replyTo) {
        mailOptions.replyTo = replyTo;
      }

      this.logger.debug({ to: email.to, from: fromEmail, appId: email.appId }, 'Sending email via Main SMTP');

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.info(
        { messageId: result.messageId, to: email.to, from: fromEmail },
        'Email sent successfully via Main SMTP'
      );

      return { messageId: result.messageId || 'unknown' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { error: errorMessage, to: email.to, appId: email.appId },
        'Main SMTP provider failed to send email'
      );
      throw error;
    }
  }

  /**
   * Verify SMTP connection
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.info('Main SMTP connection verified');
      return true;
    } catch (error) {
      this.logger.error({ error }, 'Main SMTP connection verification failed');
      return false;
    }
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    const config = getConfig();
    return {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      from: config.FROM_EMAIL || 'noreply@afrisinc.com',
    };
  }
}
