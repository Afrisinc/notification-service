import pino from 'pino';
import { prismaRead, prismaWrite } from '@shared/database';
import { getConfig } from '@shared/config';
import { SMTPProvider } from './providers/smtp';
import { SendGridProvider } from './providers/sendgrid';

export class EmailProcessor {
  private smtpProvider?: SMTPProvider;
  private sendgridProvider?: SendGridProvider;

  constructor(private logger: pino.Logger) {
    const config = getConfig();

    // Initialize providers based on config
    if (config.EMAIL_PROVIDER === 'smtp') {
      this.smtpProvider = new SMTPProvider(logger);
    } else if (config.EMAIL_PROVIDER === 'sendgrid') {
      this.sendgridProvider = new SendGridProvider(logger);
    }
  }

  async process(email: any): Promise<void> {
    try {
      // Map incoming message format to EmailNotification
      const emailId = email.id || email.notificationId;
      const emailTo = email.to || email.recipient;
      const tenantId = email.tenantId;
      const templateCode = email.templateCode;

      this.logger.info({ emailId, to: emailTo }, 'Processing email notification');

      // Prepare email data - fetch and render template if body/subject not provided
      let subject = email.subject;
      let body = email.body;

      // If body/subject not provided, fetch and render template
      if (!body || !subject) {
        try {
          // Try to fetch template from user's account first, then system account
          let template = await prismaRead.template.findFirst({
            where: {
              code: templateCode,
              account_id: tenantId,
            },
          });

          // Fallback to system/shared template account if not found in user account
          if (!template) {
            template = await prismaRead.template.findFirst({
              where: {
                code: templateCode,
                account_id: 'afrisinc-notify-account',
              },
            });
          }

          if (template) {
            // Render template with payload variables
            subject = subject || this.renderTemplate(template.subject || templateCode, email.payload || {});
            body = body || this.renderTemplate(template.content, email.payload || {});

            this.logger.debug({ templateCode, tenantId }, 'Template fetched and rendered');
          } else {
            // Fallback if template not found
            subject = subject || `${templateCode} Notification`;
            body = body || (email.payload ? JSON.stringify(email.payload) : '');
            this.logger.warn({ templateCode, tenantId }, 'Template not found, using fallback content');
          }
        } catch (templateError) {
          this.logger.warn({ templateCode, error: templateError }, 'Failed to fetch template, using fallback');
          subject = subject || `${templateCode} Notification`;
          body = body || (email.payload ? JSON.stringify(email.payload) : '');
        }
      }

      const emailData = {
        ...email,
        id: emailId,
        to: emailTo,
        subject,
        body,
      };

      this.logger.debug(
        { emailId, hasBody: !!emailData.body, hasSubject: !!emailData.subject, templateCode },
        'Email data prepared for sending'
      );

      // Select provider
      let result;
      const config = getConfig();

      if (config.EMAIL_PROVIDER === 'sendgrid' && this.sendgridProvider) {
        result = await this.sendgridProvider.send(emailData);
      } else if (this.smtpProvider) {
        result = await this.smtpProvider.send(emailData);
      } else {
        throw new Error('No email provider configured');
      }

      this.logger.info({ emailId, messageId: result.messageId }, 'Email sent successfully');

      // Record success log to database
      try {
        await prismaWrite.notificationLog.create({
          data: {
            notificationId: emailId,
            provider: config.EMAIL_PROVIDER || 'unknown',
            status: 'SENT',
            response: result.messageId || 'Email sent successfully',
          },
        });
        this.logger.debug({ emailId }, 'Notification log recorded');
      } catch (logError) {
        this.logger.warn({ emailId, error: logError }, 'Failed to record notification log');
        // Don't throw - email was sent successfully even if logging failed
      }
    } catch (error) {
      const emailId = email?.id || email?.notificationId;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const emailConfig = getConfig();

      this.logger.error({ error, emailId }, 'Failed to process email');

      // Record failure log to database
      try {
        await prismaWrite.notificationLog.create({
          data: {
            notificationId: emailId,
            provider: emailConfig.EMAIL_PROVIDER || 'unknown',
            status: 'FAILED',
            response: errorMessage,
          },
        });
      } catch (logError) {
        this.logger.warn({ emailId, error: logError }, 'Failed to record failure log');
      }

      throw error;
    }
  }

  /**
   * Simple Handlebars-like template rendering
   * Replaces {{variable}} with values from payload
   */
  private renderTemplate(template: string, payload: Record<string, any>): string {
    let rendered = template;

    // Replace {{variable}} with payload values
    Object.entries(payload).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      rendered = rendered.replace(regex, stringValue);
    });

    return rendered;
  }
}
