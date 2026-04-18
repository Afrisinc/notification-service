import pino from 'pino';
import { MainSMTPProvider } from './main-smtp';
import { SendGridProvider } from './sendgrid';
import { GmailProvider } from './gmail.provider';

export interface IEmailProvider {
  send(emailData: any): Promise<{ messageId: string }>;
}

/**
 * Email Provider Strategy with fallback support
 * Tries providers in order, falls back on failure
 */
export class EmailProviderStrategy {
  private providers: IEmailProvider[] = [];

  constructor(private logger: pino.Logger) {}

  /**
   * Add a provider to the strategy (in priority order)
   */
  addProvider(provider: IEmailProvider): void {
    this.providers.push(provider);
  }

  /**
   * Send email with fallback to next provider on failure
   */
  async send(emailData: any): Promise<{ messageId: string }> {
    if (this.providers.length === 0) {
      throw new Error('No email providers configured');
    }

    let lastError: Error | null = null;

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      const providerName = provider.constructor.name;

      try {
        this.logger.debug({ provider: providerName, emailId: emailData.id }, `Attempting to send with ${providerName}`);
        const result = await provider.send(emailData);
        this.logger.info(
          { provider: providerName, messageId: result.messageId },
          `Email sent successfully via ${providerName}`
        );
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          { provider: providerName, error: lastError.message, emailId: emailData.id },
          `Failed to send with ${providerName}, trying next provider...`
        );

        // Continue to next provider
        if (i < this.providers.length - 1) {
          continue;
        }
      }
    }

    // All providers failed
    throw new Error(`All email providers failed. Last error: ${lastError?.message}`);
  }
}

/**
 * Factory to create provider strategy based on configuration
 */
export class EmailProviderFactory {
  static createStrategy(config: any, logger: pino.Logger): EmailProviderStrategy {
    const strategy = new EmailProviderStrategy(logger);

    // Add providers in priority order
    // Gmail per-app as highest priority (if configured)
    strategy.addProvider(new GmailProvider(logger));
    logger.info('Added Gmail provider (per-app priority)');

    // Main SMTP (Postfix) as primary
    if (config.SMTP_HOST && config.SMTP_PORT) {
      strategy.addProvider(new MainSMTPProvider(logger));
      logger.info('Added Main SMTP provider (Postfix)');
    }

    // SendGrid as fallback
    if (config.SENDGRID_API_KEY) {
      strategy.addProvider(new SendGridProvider(logger));
      logger.info('Added SendGrid provider as fallback');
    }

    return strategy;
  }
}
