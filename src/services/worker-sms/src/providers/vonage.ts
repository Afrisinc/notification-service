import pino from 'pino';
import axios from 'axios';
import { getConfig } from '@shared/config';
import { ISMSProvider } from './strategy';

export class VonageProvider implements ISMSProvider {
  name = 'vonage';
  private config: any;
  private readonly API_BASE_URL = 'https://rest.nexmo.com/sms/json';

  constructor(private logger: pino.Logger) {
    this.config = getConfig();

    if (!this.isConfigured()) {
      this.logger.warn('Vonage provider not fully configured. Set VONAGE_API_KEY and VONAGE_API_SECRET');
      return;
    }

    this.logger.info('Vonage SMS provider initialized');
  }

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.VONAGE_API_KEY && this.config.VONAGE_API_SECRET);
  }

  /**
   * Send SMS via Vonage (Nexmo) HTTP API
   * REST API endpoint: POST https://rest.nexmo.com/sms/json
   */
  async send(smsData: any): Promise<{ messageId: string; provider: string }> {
    try {
      const { to, body } = smsData;

      if (!to || !body) {
        throw new Error('SMS recipient (to) and body are required');
      }

      // Parse phone number - Vonage expects international format without +
      const vonagePhoneNumber = to.startsWith('+') ? to.slice(1) : to;

      const params = {
        api_key: this.config.VONAGE_API_KEY,
        api_secret: this.config.VONAGE_API_SECRET,
        to: vonagePhoneNumber,
        from: this.config.VONAGE_SENDER_ID || 'NOTIFY',
        text: body,
        // Optional parameters
        type: 'unicode', // Automatically handle unicode characters
        status_report_req: 1, // Request delivery receipt
      };

      this.logger.debug(
        { to: vonagePhoneNumber, bodyLength: body.length, from: params.from },
        'Sending SMS via Vonage'
      );

      // Send SMS via HTTP POST
      const response = await axios.post(this.API_BASE_URL, null, { params });

      if (!response.data || !response.data.messages || response.data.messages.length === 0) {
        throw new Error('Vonage API returned empty response');
      }

      const message = response.data.messages[0];

      // Check status code
      if (message.status !== '0') {
        throw new Error(`Vonage API error: ${message.status} - ${message['error-text'] || 'Unknown error'}`);
      }

      if (!message['message-id']) {
        throw new Error('Vonage API did not return message ID');
      }

      this.logger.debug(
        { messageId: message['message-id'], to, remaining: message['remaining-balance'] },
        'SMS sent successfully via Vonage'
      );

      return { messageId: message['message-id'], provider: this.name };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : error,
          to: smsData.to,
          provider: this.name,
        },
        'Vonage provider failed to send SMS'
      );

      // Add more context for debugging
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error({ status: error.response.status, data: error.response.data }, 'Vonage API error details');
      }

      throw error;
    }
  }
}
