import pino from 'pino';
import twilio from 'twilio';
import { getConfig } from '@shared/config';
import { ISMSProvider } from './strategy';

export class TwilioProvider implements ISMSProvider {
  name = 'twilio';
  private client: any;
  private config: any;

  constructor(private logger: pino.Logger) {
    this.config = getConfig();

    if (!this.isConfigured()) {
      this.logger.warn(
        'Twilio provider not fully configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER'
      );
      return;
    }

    try {
      this.client = twilio(this.config.TWILIO_ACCOUNT_SID, this.config.TWILIO_AUTH_TOKEN);
      this.logger.info('Twilio SMS provider initialized');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize Twilio provider');
      throw error;
    }
  }

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.TWILIO_ACCOUNT_SID && this.config.TWILIO_AUTH_TOKEN && this.config.TWILIO_PHONE_NUMBER);
  }

  /**
   * Send SMS via Twilio
   * Supports SMS, MMS, WhatsApp, and other messaging channels
   */
  async send(smsData: any): Promise<{ messageId: string; provider: string }> {
    try {
      const { to, body } = smsData;

      if (!to || !body) {
        throw new Error('SMS recipient (to) and body are required');
      }

      this.logger.debug(
        { to, bodyLength: body.length, from: this.config.TWILIO_PHONE_NUMBER },
        'Sending SMS via Twilio'
      );

      // Send SMS
      const message = await this.client.messages.create({
        body,
        from: this.config.TWILIO_PHONE_NUMBER,
        to,
        // Optional: Add more configuration
        maxPrice: this.config.TWILIO_MAX_PRICE,
        validityPeriod: this.config.TWILIO_VALIDITY_PERIOD,
      });

      if (!message.sid) {
        throw new Error('Twilio API did not return message SID');
      }

      this.logger.debug({ messageId: message.sid, to, status: message.status }, 'SMS sent successfully via Twilio');

      return { messageId: message.sid, provider: this.name };
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : error, to: smsData.to },
        'Twilio provider failed to send SMS'
      );
      throw error;
    }
  }
}
