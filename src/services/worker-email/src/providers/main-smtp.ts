import pino from 'pino';
import nodemailer from 'nodemailer';
import { EmailNotification, EmailProvider } from '@shared/common';
import { getConfig } from '@shared/config';
import { prismaRead } from '@shared/database';
import { dkimService } from '../../../api/src/services/dkim.service';

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
      let dkimConfig: any = undefined;
      let isCustomDomain = false;

      // Priority 1: Custom Domain (if app has one and it's verified)
      if (email.appId) {
        try {
          const customDomain = await prismaRead.appEmailProvider.findUnique({
            where: { app_id: email.appId },
          });

          if (customDomain && customDomain.provider === 'custom_domain' && customDomain.domain_status === 'verified') {
            isCustomDomain = true;
            const domain = customDomain.domain;
            const selector = customDomain.selector || 'afrisinc';

            // Set FROM address: use from_email if set, else noreply@domain
            fromEmail = customDomain.from_email || `noreply@${domain}`;
            fromName = customDomain.from_name || undefined;
            replyTo = fromEmail;

            this.logger.debug({ appId: email.appId, domain, from: fromEmail }, 'Using custom domain for email');

            // Load and configure DKIM signing
            try {
              const result = await dkimService.getPrivateKey(domain!, selector);
              const privateKey = result.key;

              if (privateKey) {
                dkimConfig = {
                  domainName: domain,
                  keySelector: selector,
                  privateKey,
                  cacheDir: false, // Disable caching to ensure fresh keys
                };
                this.logger.info({ domain, selector }, 'DKIM signing configured for custom domain');
              } else {
                this.logger.warn(
                  { domain, selector, error: result.error },
                  'Failed to load private key for DKIM signing - email will be sent without signature'
                );
              }
            } catch (dkimError) {
              const errorMsg = dkimError instanceof Error ? dkimError.message : String(dkimError);
              this.logger.error({ domain, selector, error: errorMsg }, 'Exception while configuring DKIM signing');
            }
          }
        } catch (customDomainError) {
          this.logger.warn(
            { error: customDomainError, appId: email.appId },
            'Failed to load custom domain, trying app config'
          );
        }
      }

      // Priority 2: App-specific email config (if no custom domain)
      if (!isCustomDomain && email.appId) {
        try {
          const emailConfig = await prismaRead.appEmailProvider.findUnique({
            where: { app_id: email.appId },
          });

          if (emailConfig && emailConfig.from_email) {
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

      // Add DKIM signing if configured for custom domain
      if (dkimConfig) {
        mailOptions.dkim = dkimConfig;
      }

      // Add attachments if present
      if (email.attachments && email.attachments.length > 0) {
        mailOptions.attachments = email.attachments.map((att) => ({
          filename: att.filename,
          content: Buffer.from(att.content!, 'base64'),
          contentType: att.contentType,
        }));
        this.logger.debug({ count: email.attachments.length }, 'Adding attachments to SMTP email');
      }

      this.logger.debug(
        { to: email.to, from: fromEmail, appId: email.appId, hasDkim: !!dkimConfig },
        'Sending email via Main SMTP'
      );

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.info(
        { messageId: result.messageId, to: email.to, from: fromEmail, dkimSigned: !!dkimConfig },
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
