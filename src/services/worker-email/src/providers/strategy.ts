import pino from 'pino';
import { MainSMTPProvider } from './main-smtp';
import { SendGridProvider } from './sendgrid';
import { GmailProvider } from './gmail.provider';
import { AppEmailProviderRepository } from '../../../api/src/repositories/app-email-provider.repository';
import { getCircuitBreaker, circuitBreakers_config, CircuitState } from '@shared/utils/circuit-breaker';
import { adminAlerts } from '../../../api/src/services/admin-alerts.service';

export interface IEmailProvider {
  send(emailData: any): Promise<{ messageId: string }>;
}

interface WrappedProvider {
  provider: IEmailProvider;
  name: string;
  circuitBreaker: ReturnType<typeof getCircuitBreaker>;
}

export class EmailProviderStrategy {
  private readonly providers: WrappedProvider[] = [];

  constructor(private readonly logger: pino.Logger) {}

  addProvider(provider: IEmailProvider, name: string): void {
    const providerKey = name.toLowerCase().replace(/provider$/i, '');
    const config = circuitBreakers_config[providerKey as keyof typeof circuitBreakers_config] || {
      name: providerKey,
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 15000,
      resetTimeout: 60000,
    };

    const circuitBreaker = getCircuitBreaker(config.name, {
      ...config,
      onStateChange: (from, to) => {
        this.logger.warn({ provider: name, from, to }, `Circuit breaker state changed for ${name}`);
      },
      onOpen: (failures) => {
        adminAlerts.circuitBreakerOpen(name, failures);
      },
      onRecover: () => {
        adminAlerts.circuitBreakerRecovered(name);
      },
    });

    this.providers.push({ provider, name, circuitBreaker });
  }

  async send(emailData: any): Promise<{ messageId: string }> {
    if (this.providers.length === 0) {
      throw new Error('No email providers configured');
    }

    const availableProviders = this.providers.filter((p) => p.circuitBreaker.isAvailable());

    if (availableProviders.length === 0) {
      const states = this.providers.map((p) => `${p.name}: ${p.circuitBreaker.getState()}`).join(', ');
      throw new Error(`All email providers are unavailable. Circuit states: ${states}`);
    }

    let lastError: Error | null = null;

    for (const { provider, name, circuitBreaker } of availableProviders) {
      try {
        this.logger.debug({ provider: name, emailId: emailData.id }, `Attempting to send with ${name}`);

        const result = await circuitBreaker.execute(() => provider.send(emailData));

        this.logger.info({ provider: name, messageId: result.messageId }, `Email sent successfully via ${name}`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          {
            provider: name,
            error: lastError.message,
            emailId: emailData.id,
            circuitState: circuitBreaker.getState(),
          },
          `Failed to send with ${name}, trying next provider...`
        );
      }
    }

    throw new Error(`All available email providers failed. Last error: ${lastError?.message}`);
  }

  getProviderStatuses(): Array<{ name: string; available: boolean; state: CircuitState }> {
    return this.providers.map((p) => ({
      name: p.name,
      available: p.circuitBreaker.isAvailable(),
      state: p.circuitBreaker.getState(),
    }));
  }
}

export class EmailProviderFactory {
  static async createStrategy(appId: string, config: any, logger: pino.Logger): Promise<EmailProviderStrategy> {
    const strategy = new EmailProviderStrategy(logger);
    const addedProviders = new Set<string>();

    try {
      const appEmailConfig = await AppEmailProviderRepository.findByAppId(appId);

      if (appEmailConfig?.is_active) {
        logger.debug({ appId, provider: appEmailConfig.provider }, 'Using configured email provider for app');

        switch (appEmailConfig.provider) {
          case 'gmail':
            strategy.addProvider(new GmailProvider(logger), 'Gmail');
            addedProviders.add('Gmail');
            logger.info({ appId }, 'Added Gmail provider (app-configured)');
            break;

          case 'custom_domain':
          case 'notify':
            if (config.SMTP_HOST && config.SMTP_PORT) {
              strategy.addProvider(new MainSMTPProvider(logger), 'SMTP');
              addedProviders.add('SMTP');
              logger.info({ appId }, 'Added Main SMTP provider (app-configured)');
            }
            break;

          case 'sendgrid':
            if (config.SENDGRID_API_KEY) {
              strategy.addProvider(new SendGridProvider(logger), 'SendGrid');
              addedProviders.add('SendGrid');
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

    if (!addedProviders.has('SMTP') && config.SMTP_HOST && config.SMTP_PORT) {
      strategy.addProvider(new MainSMTPProvider(logger), 'SMTP');
      addedProviders.add('SMTP');
      logger.info('Added Main SMTP provider (fallback)');
    }

    if (!addedProviders.has('SendGrid') && config.SENDGRID_API_KEY) {
      strategy.addProvider(new SendGridProvider(logger), 'SendGrid');
      addedProviders.add('SendGrid');
      logger.info('Added SendGrid provider (fallback)');
    }

    return strategy;
  }
}
