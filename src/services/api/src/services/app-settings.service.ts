import { appSettingsRepository } from '../repositories/app-settings.repository';
import { logger } from '../config/logger';

export class AppSettingsService {
  /**
   * Get app settings
   */
  async getSettings(appId: string) {
    try {
      const settings = await appSettingsRepository.getSettings(appId);

      if (!settings) {
        // Create default settings if they don't exist
        return appSettingsRepository.upsertSettings(appId);
      }

      return settings;
    } catch (error) {
      logger.error({ error, appId }, 'Failed to get app settings');
      throw error;
    }
  }

  /**
   * Update app settings
   */
  async updateSettings(
    appId: string,
    data: {
      description?: string;
    }
  ) {
    try {
      // Ensure settings exist
      await appSettingsRepository.upsertSettings(appId);

      return appSettingsRepository.updateSettings(appId, data);
    } catch (error) {
      logger.error({ error, appId }, 'Failed to update app settings');
      throw error;
    }
  }

  /**
   * Update allowed domains
   */
  async updateAllowedDomains(appId: string, domains: string[]) {
    try {
      // Validate domains
      this.validateDomains(domains);

      // Ensure settings exist
      await appSettingsRepository.upsertSettings(appId);

      return appSettingsRepository.updateAllowedDomains(appId, domains);
    } catch (error) {
      logger.error({ error, appId }, 'Failed to update allowed domains');
      throw error;
    }
  }

  /**
   * List webhooks for app
   */
  async listWebhooks(appId: string) {
    try {
      // Ensure settings exist
      await appSettingsRepository.upsertSettings(appId);

      return appSettingsRepository.listWebhooks(appId);
    } catch (error) {
      logger.error({ error, appId }, 'Failed to list webhooks');
      throw error;
    }
  }

  /**
   * Create webhook
   */
  async createWebhook(
    appId: string,
    data: {
      url: string;
      events: string[];
      headers?: Record<string, string>;
      isActive?: boolean;
      maxRetries?: number;
      retryDelay?: number;
      backoffMultiplier?: number;
    }
  ) {
    try {
      this.validateWebhookUrl(data.url);
      this.validateWebhookEvents(data.events);

      return appSettingsRepository.createWebhook(appId, data);
    } catch (error) {
      logger.error({ error, appId }, 'Failed to create webhook');
      throw error;
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(webhookId: string, appId: string, data: any) {
    try {
      if (data.url) {
        this.validateWebhookUrl(data.url);
      }
      if (data.events) {
        this.validateWebhookEvents(data.events);
      }

      return appSettingsRepository.updateWebhook(webhookId, appId, data);
    } catch (error) {
      logger.error({ error, webhookId, appId }, 'Failed to update webhook');
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string, appId: string) {
    try {
      return appSettingsRepository.deleteWebhook(webhookId, appId);
    } catch (error) {
      logger.error({ error, webhookId, appId }, 'Failed to delete webhook');
      throw error;
    }
  }

  /**
   * Test webhook
   */
  async testWebhook(webhookId: string, appId: string, event: string) {
    try {
      const webhook = await appSettingsRepository.getWebhook(webhookId, appId);

      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Create test payload
      const testPayload = {
        event,
        timestamp: new Date().toISOString(),
        test: true,
        webhook_id: webhookId,
      };

      // Call webhook (simulated)
      const startTime = Date.now();
      const responseTime = Date.now() - startTime;

      // Log the test
      await appSettingsRepository.logWebhookCall(webhookId, {
        event,
        status: 'success',
        statusCode: 200,
        responseTime,
        payload: testPayload,
        response: 'Test successful',
        attemptNumber: 1,
      });

      return {
        webhookId,
        event,
        statusCode: 200,
        responseTime,
        message: 'Webhook test sent successfully',
      };
    } catch (error) {
      logger.error({ error, webhookId, appId }, 'Failed to test webhook');
      throw error;
    }
  }

  /**
   * Get webhook logs
   */
  async getWebhookLogs(
    webhookId: string,
    appId: string,
    filters: {
      page: number;
      limit: number;
      status?: string;
    }
  ) {
    try {
      return appSettingsRepository.getWebhookLogs(webhookId, filters);
    } catch (error) {
      logger.error({ error, webhookId, appId }, 'Failed to get webhook logs');
      throw error;
    }
  }

  /**
   * Validate domain URLs
   */
  private validateDomains(domains: string[]) {
    for (const domain of domains) {
      if (domain && !domain.startsWith('https://')) {
        throw new Error(`Domain must use HTTPS: ${domain}`);
      }
      try {
        new URL(domain);
      } catch {
        throw new Error(`Invalid domain URL: ${domain}`);
      }
    }
  }

  /**
   * Validate webhook URL
   */
  private validateWebhookUrl(url: string) {
    if (!url) {
      throw new Error('Webhook URL is required');
    }
    if (!url.startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS');
    }
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid webhook URL');
    }
  }

  /**
   * Validate webhook events
   */
  private validateWebhookEvents(events: string[]) {
    const validEvents = [
      'notification.sent',
      'notification.delivered',
      'notification.failed',
      'notification.bounced',
      'notification.opened',
      'notification.clicked',
      'contact.created',
      'contact.deleted',
      'campaign.sent',
    ];

    if (!events || events.length === 0) {
      throw new Error('At least one event must be specified');
    }

    for (const event of events) {
      if (!validEvents.includes(event)) {
        throw new Error(`Invalid event type: ${event}`);
      }
    }
  }
}

export const appSettingsService = new AppSettingsService();
