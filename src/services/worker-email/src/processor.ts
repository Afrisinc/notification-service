import pino from 'pino';
import { prismaRead, prismaWrite } from '@shared/database';
import { getConfig } from '@shared/config';
import { EmailProviderFactory } from './providers/strategy';

export class EmailProcessor {
  constructor(private logger: pino.Logger) {}

  async process(email: any): Promise<void> {
    try {
      // Map incoming message format to EmailNotification
      const emailId = email.notificationId || email.id;
      const emailTo = email.to || email.recipient;
      const tenantId = email.tenantId;
      const templateCode = email.templateCode;
      const templateId = email.templateId;
      const accountId = email.accountId || tenantId; // Fallback to tenantId if accountId not provided
      const appId = email.appId;

      this.logger.info({ emailId, to: emailTo, appId }, 'Processing email notification');

      // Create provider strategy for this specific app (checks configured provider)
      const config = getConfig();
      const providerStrategy = await EmailProviderFactory.createStrategy(appId, config, this.logger);

      // Prepare email data - fetch and render template if body/subject not provided
      let subject = email.subject;
      let body = email.body;

      // If body/subject not provided, fetch and render template
      if (!body || !subject) {
        try {
          // Try to fetch template from user's account first, then system account
          let template = await prismaRead.template.findFirst({
            where: {
              id: templateId,
              account_id: accountId,
            },
          });

          // Fallback to system/shared template account if not found in user account
          if (!template) {
            template = await prismaRead.template.findFirst({
              where: {
                code: templateCode,
                account_id: tenantId,
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

      // Send using provider strategy (tries providers in order with fallback)
      const result = await providerStrategy.send(emailData);
      this.logger.info({ emailId, messageId: result.messageId }, 'Email sent successfully');

      // Update notification record and record success log
      try {
        const notificationExists = await prismaRead.notification.findUnique({
          where: { id: emailId },
        });

        if (notificationExists) {
          const now = new Date();
          const existingPayload = (notificationExists.payload as Record<string, any>) ?? {};

          // Update main notification record with sentAt and provider info
          await prismaWrite.notification.update({
            where: { id: emailId },
            data: {
              sentAt: now,
              payload: {
                ...existingPayload,
                provider: 'sendgrid',
                providerMessageId: result.messageId || 'unknown',
                deliveryStatus: 'sent',
              },
            },
          });

          // Record log for audit trail
          await prismaWrite.notificationLog.create({
            data: {
              notificationId: emailId,
              channel: 'EMAIL',
              provider: 'sendgrid',
              status: 'SENT',
              response: {
                messageId: result.messageId || 'unknown',
                sentAt: now.toISOString(),
                to: email.to,
                from: email.appId
                  ? `${(email as any).fromName || 'Afrisinc'} <${(email as any).fromEmail}>`
                  : undefined,
              },
            },
          });
          this.logger.debug({ emailId, messageId: result.messageId }, 'Notification sent and logged');
        } else {
          this.logger.debug({ emailId }, 'Ad-hoc email - no parent notification');
        }
      } catch (logError) {
        this.logger.warn({ emailId, error: logError }, 'Failed to update notification or log');
      }
    } catch (error) {
      const emailId = email?.id || email?.notificationId;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const emailConfig = getConfig();

      this.logger.error({ error, emailId }, 'Failed to process email');

      // Update notification record and record failure log
      try {
        const notificationExists = await prismaRead.notification.findUnique({
          where: { id: emailId },
        });

        if (notificationExists) {
          const now = new Date();
          const existingPayload = (notificationExists.payload as Record<string, any>) ?? {};

          // Update main notification record as FAILED
          await prismaWrite.notification.update({
            where: { id: emailId },
            data: {
              status: 'FAILED',
              retryCount: (notificationExists.retryCount || 0) + 1,
              payload: {
                ...existingPayload,
                errorMessage: errorMessage,
                deliveryStatus: 'failed',
              },
            },
          });

          // Record failure log for audit trail
          await prismaWrite.notificationLog.create({
            data: {
              notificationId: emailId,
              channel: 'EMAIL',
              provider: emailConfig.EMAIL_PROVIDER || 'unknown',
              status: 'FAILED',
              response: {
                error: errorMessage,
                failedAt: now.toISOString(),
                to: email.to,
              },
            },
          });
        } else {
          this.logger.debug({ emailId }, 'Ad-hoc email - no parent notification');
        }
      } catch (logError) {
        this.logger.warn({ emailId, error: logError }, 'Failed to update notification or log');
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
