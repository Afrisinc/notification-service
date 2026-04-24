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
      // Filter out non-SMS messages (EMAIL, PUSH, etc.)
      if (sms.channel && sms.channel !== 'SMS') {
        this.logger.debug({ channel: sms.channel, notificationId: sms.notificationId }, 'Ignoring non-SMS message');
        return;
      }

      // Map incoming message format to SMS notification
      const smsId = sms.notificationId || sms.id;
      const smsTo = sms.to || sms.recipient;
      const tenantId = sms.tenantId;
      const templateCode = sms.templateCode;
      const templateId = sms.templateId;
      const accountId = sms.accountId || tenantId;

      this.logger.debug(
        {
          smsId,
          to: smsTo,
          templateCode,
          templateId,
          tenantId,
          accountId,
          hasBody: !!sms.body,
        },
        '🔍 [SMS PROCESSOR] Starting SMS processing'
      );

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
      this.logger.info(
        { smsId, to: smsData.to, provider: 'multi-provider-strategy' },
        '📤 [SMS PROCESSOR] Attempting to send SMS via provider strategy'
      );

      const result = await this.providerStrategy.send(smsData);

      this.logger.info(
        {
          smsId,
          messageId: result.messageId,
          provider: result.provider,
          recipient: smsData.to,
          status: 'SENT',
        },
        '✅ [SMS PROCESSOR] SMS sent successfully'
      );

      // Update notification record and record success log
      try {
        const notificationExists = await prismaRead.notification.findUnique({
          where: { id: smsId },
        });

        if (notificationExists) {
          const now = new Date();
          const existingPayload = (notificationExists.payload as Record<string, any>) ?? {};

          // Update main notification record with sentAt and provider info
          await prismaWrite.notification.update({
            where: { id: smsId },
            data: {
              sentAt: now,
              payload: {
                ...existingPayload,
                provider: result.provider || 'multi-provider-strategy',
                providerMessageId: result.messageId || 'unknown',
                deliveryStatus: 'sent',
              },
            },
          });

          // Record log for audit trail
          await prismaWrite.notificationLog.create({
            data: {
              notificationId: smsId,
              provider: result.provider || 'multi-provider-strategy',
              channel: 'SMS',
              status: 'SENT',
              response: {
                messageId: result.messageId || 'unknown',
                sentAt: now.toISOString(),
                to: sms.to,
                type: 'SMS',
              },
            },
          });

          this.logger.info(
            {
              smsId,
              messageId: result.messageId,
              provider: result.provider,
              sentAt: now.toISOString(),
            },
            '💾 [SMS PROCESSOR] Notification sent and logged'
          );
        } else {
          this.logger.debug({ smsId }, 'Ad-hoc SMS - no parent notification');
        }
      } catch (logError) {
        this.logger.warn(
          {
            smsId,
            error: logError instanceof Error ? logError.message : logError,
          },
          '⚠️ [SMS PROCESSOR] Failed to update notification or log'
        );
      }
    } catch (error) {
      const smsId = sms?.id || sms?.notificationId || 'unknown';
      const smsTo = sms?.to || sms?.recipient || 'unknown';
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(
        {
          smsId,
          to: smsTo,
          error: errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        '❌ [SMS PROCESSOR] Failed to process SMS notification'
      );

      // Update notification record and record failure log
      try {
        const notificationExists = await prismaRead.notification.findUnique({
          where: { id: smsId },
        });

        if (notificationExists) {
          const now = new Date();
          const existingPayload = (notificationExists.payload as Record<string, any>) ?? {};

          // Update main notification record as FAILED
          await prismaWrite.notification.update({
            where: { id: smsId },
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
              notificationId: smsId,
              provider: 'multi-provider-strategy',
              channel: 'SMS',
              status: 'FAILED',
              response: {
                error: errorMessage,
                failedAt: now.toISOString(),
                to: smsTo,
                type: 'SMS',
              },
            },
          });

          this.logger.warn(
            { smsId, to: smsTo, failedAt: now.toISOString() },
            '💾 [SMS PROCESSOR] Notification failed and logged'
          );
        } else {
          this.logger.debug({ smsId }, 'Ad-hoc SMS - no parent notification');
        }
      } catch (logError) {
        this.logger.error(
          {
            smsId,
            logError: logError instanceof Error ? logError.message : logError,
          },
          '⚠️ [SMS PROCESSOR] Failed to update notification or log'
        );
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
