import pino from 'pino';
import { MainSMTPProvider } from './main-smtp';
import { SendGridProvider } from './sendgrid';
import { GmailProvider } from './gmail.provider';
import { AppEmailProviderRepository } from '../../../api/src/repositories/app-email-provider.repository';

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
 * Checks app-specific email provider config first, falls back to defaults
 */
export class EmailProviderFactory {
  static async createStrategy(appId: string, config: any, logger: pino.Logger): Promise<EmailProviderStrategy> {
    const strategy = new EmailProviderStrategy(logger);
    const addedProviders = new Set<string>();

    try {
      // Check if app has configured email provider
      const appEmailConfig = await AppEmailProviderRepository.findByAppId(appId);

      if (appEmailConfig && appEmailConfig.is_active) {
        logger.debug({ appId, provider: appEmailConfig.provider }, 'Using configured email provider for app');

        // Add configured provider first (highest priority)
        switch (appEmailConfig.provider) {
          case 'gmail':
            strategy.addProvider(new GmailProvider(logger));
            addedProviders.add('GmailProvider');
            logger.info({ appId }, 'Added Gmail provider (app-configured)');
            break;

          case 'custom_domain':
          case 'notify':
            // Use MainSMTPProvider for custom domain and default notify
            if (config.SMTP_HOST && config.SMTP_PORT) {
              strategy.addProvider(new MainSMTPProvider(logger));
              addedProviders.add('MainSMTPProvider');
              logger.info({ appId }, 'Added Main SMTP provider (app-configured)');
            }
            break;

          case 'sendgrid':
            if (config.SENDGRID_API_KEY) {
              strategy.addProvider(new SendGridProvider(logger));
              addedProviders.add('SendGridProvider');
              logger.info({ appId }, 'Added SendGrid provider (app-configured)');
            }
            break;

          default:
            logger.warn({ appId, provider: appEmailConfig.provider }, 'Unknown provider type, using defaults');
            break;
        }
      } else {
        logger.debug({ appId }, 'No configured provider for app, using defaults');
      }
    } catch (error) {
      logger.warn({ appId, error }, 'Failed to fetch app email config, using defaults');
    }

    // Add fallback providers
    // If no configured provider or missing credentials, add MainSMTP
    if (!addedProviders.has('MainSMTPProvider')) {
      if (config.SMTP_HOST && config.SMTP_PORT) {
        strategy.addProvider(new MainSMTPProvider(logger));
        addedProviders.add('MainSMTPProvider');
        logger.info('Added Main SMTP provider (fallback)');
      }
    }

    // Add SendGrid as final fallback
    if (!addedProviders.has('SendGridProvider')) {
      if (config.SENDGRID_API_KEY) {
        strategy.addProvider(new SendGridProvider(logger));
        addedProviders.add('SendGridProvider');
        logger.info('Added SendGrid provider (fallback)');
      }
    }

    return strategy;
  }
}
