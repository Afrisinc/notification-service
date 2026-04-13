import pino from 'pino';
import { AfricasTalkingProvider } from './africas-talking';
import { TwilioProvider } from './twilio';
import { VonageProvider } from './vonage';

export interface ISMSProvider {
  send(smsData: any): Promise<{ messageId: string; provider: string }>;
  isConfigured(): boolean;
}

export class SMSProviderStrategy {
  private providers: ISMSProvider[] = [];
  private providerNames: Map<ISMSProvider, string> = new Map();

  constructor(private logger: pino.Logger) {}

  /**
   * Add a provider to the strategy (in priority order - cheapest first)
   */
  addProvider(provider: ISMSProvider, name: string): void {
    if (provider.isConfigured()) {
      this.providers.push(provider);
      this.providerNames.set(provider, name);
      this.logger.info({ provider: name }, `Added SMS provider: ${name}`);
    } else {
      this.logger.warn({ provider: name }, `SMS provider ${name} is not properly configured, skipping`);
    }
  }

  /**
   * Send SMS with fallback to next provider on failure
   */
  async send(smsData: any): Promise<{ messageId: string; provider: string }> {
    if (this.providers.length === 0) {
      throw new Error(
        "No SMS providers configured. Please configure at least one SMS provider (Africa's Talking, Twilio, or Vonage)"
      );
    }

    let lastError: Error | null = null;

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      const providerName = this.providerNames.get(provider) || provider.constructor.name;

      try {
        this.logger.debug(
          { provider: providerName, smsId: smsData.id, to: smsData.to },
          `Attempting to send SMS with ${providerName}`
        );

        const result = await provider.send(smsData);

        this.logger.info(
          { provider: providerName, messageId: result.messageId, to: smsData.to },
          `SMS sent successfully via ${providerName}`
        );

        return { ...result, provider: providerName };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.logger.warn(
          {
            provider: providerName,
            error: lastError.message,
            smsId: smsData.id,
            to: smsData.to,
            attempt: i + 1,
            totalProviders: this.providers.length,
          },
          `Failed to send SMS with ${providerName}, trying next provider...`
        );

        // Continue to next provider
        if (i < this.providers.length - 1) {
          continue;
        }
      }
    }

    // All providers failed
    throw new Error(
      `All SMS providers failed. Last error: ${lastError?.message}. Configured providers: ${Array.from(this.providerNames.values()).join(', ')}`
    );
  }
}

/**
 * Factory to create provider strategy based on configuration
 * Priority order: Africa's Talking (cheapest) → Twilio → Vonage (fallback)
 */
export class SMSProviderFactory {
  static createStrategy(config: any, logger: pino.Logger): SMSProviderStrategy {
    const strategy = new SMSProviderStrategy(logger);

    // 1. Africa's Talking (CHEAPEST - ~$0.008-0.15 per SMS depending on region)
    if (config.AFRICAS_TALKING_API_KEY && config.AFRICAS_TALKING_USERNAME) {
      strategy.addProvider(new AfricasTalkingProvider(logger), "Africa's Talking");
    }

    // 2. Twilio ($0.0075 per SMS in US, more expensive in other regions)
    if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN && config.TWILIO_PHONE_NUMBER) {
      strategy.addProvider(new TwilioProvider(logger), 'Twilio');
    }

    // 3. Vonage/Nexmo ($0.04-0.15 per SMS depending on region)
    if (config.VONAGE_API_KEY && config.VONAGE_API_SECRET) {
      strategy.addProvider(new VonageProvider(logger), 'Vonage');
    }

    logger.info(
      { totalProviders: strategy['providers'].length },
      'SMS Provider Strategy initialized with cost-optimized provider priority'
    );

    return strategy;
  }
}
