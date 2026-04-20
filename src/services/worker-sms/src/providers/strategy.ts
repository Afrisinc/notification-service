import pino from 'pino';
import { prismaRead } from '@shared/database';
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
   * Includes professional queue deduplication and idempotency checks
   */
  async send(smsData: any): Promise<{ messageId: string; provider: string }> {
    if (this.providers.length === 0) {
      throw new Error(
        "No SMS providers configured. Please configure at least one SMS provider (Africa's Talking, Twilio, or Vonage)"
      );
    }

    const smsId = smsData.id || smsData.notificationId || 'unknown';
    const smsTo = smsData.to || smsData.recipient || 'unknown';

    // PROFESSIONAL QUEUE DEDUPLICATION: Check notification logs before sending
    try {
      const existingSentLog = await prismaRead.notificationLog.findFirst({
        where: {
          notificationId: smsId,
          status: 'SENT',
        },
      });

      if (existingSentLog) {
        const responseData = existingSentLog.response as any;
        this.logger.warn(
          {
            smsId,
            to: smsTo,
            messageId: responseData?.messageId,
            provider: existingSentLog.provider,
            sentAt: existingSentLog.createdAt,
          },
          '⏭️ [SMS STRATEGY] SMS already sent successfully - skipping from queue (idempotency)'
        );

        // Return the previous successful result
        return {
          messageId: responseData?.messageId || 'cached',
          provider: existingSentLog.provider || 'unknown',
        };
      }

      // Check for excessive failed attempts
      const failedAttempts = await prismaRead.notificationLog.count({
        where: {
          notificationId: smsId,
          status: 'FAILED',
        },
      });

      if (failedAttempts >= 3) {
        this.logger.error(
          {
            smsId,
            to: smsTo,
            failedAttempts,
            maxRetries: 3,
          },
          '🚫 [SMS STRATEGY] Max retry attempts exceeded - notification will be marked for manual review'
        );
        throw new Error(`SMS delivery failed after ${failedAttempts} attempts. Notification: ${smsId}`);
      }
    } catch (checkError) {
      if (checkError instanceof Error && checkError.message.includes('Max retry')) {
        throw checkError; // Re-throw max retry errors
      }

      this.logger.warn(
        {
          smsId,
          error: checkError instanceof Error ? checkError.message : checkError,
        },
        '⚠️ [SMS STRATEGY] Idempotency check encountered error, proceeding with send'
      );
      // Continue with sending if check fails - don't block
    }

    this.logger.info(
      {
        smsId,
        to: smsTo,
        totalProviders: this.providers.length,
        providers: Array.from(this.providerNames.values()),
      },
      '📤 [SMS STRATEGY] Starting multi-provider SMS sending attempt'
    );

    let lastError: Error | null = null;

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      const providerName = this.providerNames.get(provider) || provider.constructor.name;

      try {
        this.logger.info(
          {
            provider: providerName,
            smsId,
            to: smsTo,
            attempt: i + 1,
            totalProviders: this.providers.length,
          },
          `📤 [SMS STRATEGY] Attempting to send SMS with ${providerName}`
        );

        const result = await provider.send(smsData);

        this.logger.info(
          {
            provider: providerName,
            messageId: result.messageId,
            to: smsTo,
            smsId,
            attempt: i + 1,
          },
          `✅ [SMS STRATEGY] SMS sent successfully via ${providerName}`
        );

        return { ...result, provider: providerName };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.logger.warn(
          {
            provider: providerName,
            error: lastError.message,
            smsId,
            to: smsTo,
            attempt: i + 1,
            totalProviders: this.providers.length,
            nextProvider: i < this.providers.length - 1 ? this.providerNames.get(this.providers[i + 1]) : 'none',
          },
          `⚠️ [SMS STRATEGY] Failed to send SMS with ${providerName}, attempting next provider...`
        );

        // Continue to next provider
        if (i < this.providers.length - 1) {
          continue;
        }
      }
    }

    // All providers failed
    const failureMessage = `All SMS providers failed. Last error: ${lastError?.message}. Configured providers: ${Array.from(this.providerNames.values()).join(', ')}`;

    this.logger.error(
      {
        smsId,
        to: smsTo,
        lastError: lastError?.message,
        providers: Array.from(this.providerNames.values()),
      },
      `🚫 [SMS STRATEGY] ${failureMessage}`
    );

    throw new Error(failureMessage);
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
