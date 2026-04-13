import pino from 'pino';
import { prismaRead, prismaWrite } from '@shared/database';
import { getConfig } from '@shared/config';
import { SMSProviderFactory } from './providers/strategy';

export class SMSProcessor {
  private providerStrategy;

  constructor(private logger: pino.Logger) {
    const config = getConfig();

    // Initialize provider strategy with fallback support
    this.providerStrategy = SMSProviderFactory.createStrategy(config, logger);
  }

  async process(sms: any): Promise<void> {
    try {
      // Map incoming message format to SMS notification
      const smsId = sms.id || sms.notificationId;
      const smsTo = sms.to || sms.recipient;
      const tenantId = sms.tenantId;
      const templateCode = sms.templateCode;
      const templateId = sms.templateId;
      const accountId = sms.accountId || tenantId;

      this.logger.info({ smsId, to: smsTo }, 'Processing SMS notification');

      // Prepare SMS data - fetch and render template if body not provided
      let body = sms.body;

      // If body not provided, fetch and render template
      if (!body) {
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
            body = body || this.renderTemplate(template.content, sms.payload || {});

            this.logger.debug({ templateCode, tenantId }, 'SMS template fetched and rendered');
          } else {
            // Fallback if template not found
            body = body || (sms.payload ? JSON.stringify(sms.payload) : `${templateCode} SMS`);
            this.logger.warn({ templateCode, tenantId }, 'SMS template not found, using fallback content');
          }
        } catch (templateError) {
          this.logger.warn({ templateCode, error: templateError }, 'Failed to fetch SMS template, using fallback');
          body = body || (sms.payload ? JSON.stringify(sms.payload) : `${templateCode} SMS`);
        }
      }

      const smsData = {
        ...sms,
        id: smsId,
        to: smsTo,
        body,
      };

      this.logger.debug(
        { smsId, hasBody: !!smsData.body, templateCode, recipient: smsData.to },
        'SMS data prepared for sending'
      );

      // Send using provider strategy (tries providers in order with fallback)
      const result = await this.providerStrategy.send(smsData);
      this.logger.info({ smsId, messageId: result.messageId, provider: result.provider }, 'SMS sent successfully');

      // Record success log to database
      try {
        await prismaWrite.notificationLog.create({
          data: {
            notificationId: smsId,
            provider: result.provider || 'multi-provider-strategy',
            status: 'SENT',
            response: {
              messageId: result.messageId || 'unknown',
              sentAt: new Date().toISOString(),
              to: sms.to,
              type: 'SMS',
            },
          },
        });

        this.logger.debug({ smsId }, 'SMS notification log recorded');
      } catch (logError) {
        this.logger.warn({ smsId, error: logError }, 'Failed to record SMS notification log (non-blocking)');
      }
    } catch (error) {
      const smsId = sms?.id || sms?.notificationId || 'unknown';
      const smsTo = sms?.to || sms?.recipient || 'unknown';

      this.logger.error(
        {
          smsId,
          to: smsTo,
          error: error instanceof Error ? error.message : error,
        },
        'Failed to process SMS notification'
      );

      // Record failure log to database
      try {
        await prismaWrite.notificationLog.create({
          data: {
            notificationId: smsId,
            provider: 'multi-provider-strategy',
            status: 'FAILED',
            response: {
              error: error instanceof Error ? error.message : String(error),
              failedAt: new Date().toISOString(),
              to: smsTo,
              type: 'SMS',
            },
          },
        });
      } catch (logError) {
        this.logger.warn({ smsId, error: logError }, 'Failed to record SMS failure log');
      }

      // Re-throw to trigger RabbitMQ retry logic
      throw error;
    }
  }

  /**
   * Render template with variable substitution using {{variable}} syntax
   */
  private renderTemplate(template: string, payload: Record<string, any>): string {
    if (!template) return '';

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return String(payload[key] ?? match);
    });
  }
}
