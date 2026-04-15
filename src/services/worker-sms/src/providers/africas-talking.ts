import pino from 'pino';
import { getConfig } from '@shared/config';
import AfricasTalking from 'africastalking';
import { ISMSProvider } from './strategy';

export class AfricasTalkingProvider implements ISMSProvider {
  name = 'africas-talking';
  private client: any;
  private smsService: any;
  private config: any;

  constructor(private logger: pino.Logger) {
    this.config = getConfig();

    if (!this.isConfigured()) {
      this.logger.warn(
        "Africa's Talking provider not fully configured. Set AFRICAS_TALKING_API_KEY and AFRICAS_TALKING_USERNAME"
      );
      return;
    }

    try {
      this.client = AfricasTalking({
        apiKey: this.config.AFRICAS_TALKING_API_KEY,
        username: this.config.AFRICAS_TALKING_USERNAME,
      });

      this.smsService = this.client.SMS;
      this.logger.info("Africa's Talking SMS provider initialized");
    } catch (error) {
      this.logger.error({ error }, "Failed to initialize Africa's Talking provider");
      throw error;
    }
  }

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.AFRICAS_TALKING_API_KEY && this.config.AFRICAS_TALKING_USERNAME);
  }

  /**
   * Send SMS via Africa's Talking
   * Supports bulk SMS, shortcodes, and premium messaging
   */
  async send(smsData: any): Promise<{ messageId: string; provider: string }> {
    try {
      const { to, body } = smsData;

      if (!to || !body) {
        throw new Error('SMS recipient (to) and body are required');
      }

      // Validate phone number format (should start with country code)
      if (!to.startsWith('+')) {
        this.logger.warn({ to }, 'Phone number should start with +, but continuing anyway');
      }

      this.logger.info(
        {
          to,
          bodyLength: body.length,
          smsId: smsData.id || smsData.notificationId,
          senderId: this.config.AFRICAS_TALKING_SENDER_ID || 'default',
        },
        '📤 [AFRICAS TALKING] Preparing to send SMS'
      );

      // Send SMS via callback-based API
      // Note: Africa's Talking SDK only accepts 'to' and 'message' parameters
      // Sender ID must be configured at the account level in Africa's Talking dashboard
      // Environment variable AFRICAS_TALKING_SENDER_ID is stored for reference but
      // must be applied through the Africa's Talking web interface
      return new Promise((resolve, reject) => {
        const sendPayload: any = {
          to: [to],
          message: body,
        };

        this.logger.debug(
          {
            to,
            senderIdConfig: this.config.AFRICAS_TALKING_SENDER_ID || 'not configured',
            smsId: smsData.id || smsData.notificationId,
          },
          '📤 [AFRICAS TALKING] SMS payload prepared (sender ID: account level setting)'
        );

        this.smsService.send(sendPayload, (error: any, result: any) => {
          if (error) {
            this.logger.error(
              {
                error: error.message || error,
                to,
                smsId: smsData.id || smsData.notificationId,
              },
              '❌ [AFRICAS TALKING] API error occurred'
            );
            reject(error);
            return;
          }

          // Handle response
          if (
            result &&
            result.SMSMessageData &&
            result.SMSMessageData.Recipients &&
            result.SMSMessageData.Recipients.length > 0
          ) {
            const recipient = result.SMSMessageData.Recipients[0];

            if (recipient.status === 'Success' || recipient.statusCode === 101) {
              const messageId = recipient.messageId || `AT-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

              this.logger.info(
                {
                  messageId,
                  to,
                  status: recipient.status,
                  statusCode: recipient.statusCode,
                  smsId: smsData.id || smsData.notificationId,
                },
                '✅ [AFRICAS TALKING] SMS sent successfully'
              );

              resolve({ messageId, provider: this.name });
            } else {
              const errorMsg = `Africa's Talking API error: ${recipient.status || recipient.statusCode} - ${recipient.statusMessage || ''}`;
              this.logger.error(
                {
                  to,
                  status: recipient.status,
                  statusCode: recipient.statusCode,
                  statusMessage: recipient.statusMessage,
                  smsId: smsData.id || smsData.notificationId,
                },
                `❌ [AFRICAS TALKING] ${errorMsg}`
              );
              reject(new Error(errorMsg));
            }
          } else {
            const errorMsg = "Africa's Talking returned invalid response";
            this.logger.error(
              {
                to,
                smsId: smsData.id || smsData.notificationId,
                result: JSON.stringify(result),
              },
              `❌ [AFRICAS TALKING] ${errorMsg}`
            );
            reject(new Error(errorMsg));
          }
        });
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        {
          error: errorMsg,
          to: smsData.to,
          smsId: smsData.id || smsData.notificationId,
        },
        '❌ [AFRICAS TALKING] Provider failed to send SMS'
      );
      throw error;
    }
  }
}
