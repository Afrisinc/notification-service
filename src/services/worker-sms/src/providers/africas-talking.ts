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

      this.logger.debug({ to, bodyLength: body.length }, "Sending SMS via Africa's Talking");

      // Send SMS
      const result = await this.smsService.send({
        recipients: [to],
        message: body,
        // Optional: use sender ID if configured
        from: this.config.AFRICAS_TALKING_SENDER_ID || 'NOTIFY',
      });

      // Handle response
      if (result.SMSMessageData.Recipients && result.SMSMessageData.Recipients.length > 0) {
        const recipient = result.SMSMessageData.Recipients[0];

        if (recipient.status === 'Success' || recipient.statusCode === 101) {
          const messageId = recipient.messageId || `AT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          this.logger.debug({ messageId, to, status: recipient.status }, "SMS sent successfully via Africa's Talking");

          return { messageId, provider: this.name };
        } else {
          throw new Error(
            `Africa's Talking API error: ${recipient.status || recipient.statusCode} - ${recipient.statusMessage || ''}`
          );
        }
      } else {
        throw new Error("Africa's Talking returned no recipients in response");
      }
    } catch (error) {
      this.logger.error({ error, to: smsData.to }, "Africa's Talking provider failed to send SMS");
      throw error;
    }
  }
}
