import { prismaRead, prismaWrite } from '@shared/database';

export class AppSettingsRepository {
  /**
   * Get settings for an app
   */
  async getSettings(appId: string) {
    return prismaRead.appSettings.findUnique({
      where: { app_id: appId },
      include: {
        webhooks: true,
        app: {
          select: {
            name: true,
            environment: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Create or get app settings
   */
  async upsertSettings(appId: string) {
    return prismaWrite.appSettings.upsert({
      where: { app_id: appId },
      update: {},
      create: {
        app_id: appId,
        description: '',
        allowedDomains: [],
      },
    });
  }

  /**
   * Update app settings
   */
  async updateSettings(
    appId: string,
    data: {
      description?: string;
      allowedDomains?: string[];
    }
  ) {
    return prismaWrite.appSettings.update({
      where: { app_id: appId },
      data,
    });
  }

  /**
   * Update allowed domains
   */
  async updateAllowedDomains(appId: string, domains: string[]) {
    return prismaWrite.appSettings.update({
      where: { app_id: appId },
      data: { allowedDomains: domains },
    });
  }

  /**
   * List webhooks for an app
   */
  async listWebhooks(appId: string) {
    const settings = await prismaRead.appSettings.findUnique({
      where: { app_id: appId },
      include: {
        webhooks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return settings?.webhooks || [];
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(webhookId: string, appId: string) {
    return prismaRead.webhook.findFirst({
      where: {
        id: webhookId,
        app_id: appId,
      },
    });
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
    // Ensure settings exist
    const settings = await this.upsertSettings(appId);

    return prismaWrite.webhook.create({
      data: {
        app_id: appId,
        appSettings_id: settings.id,
        url: data.url,
        events: data.events,
        headers: data.headers || {},
        isActive: data.isActive !== false,
        maxRetries: data.maxRetries || 5,
        retryDelay: data.retryDelay || 300,
        backoffMultiplier: data.backoffMultiplier || 2,
      },
    });
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: string,
    appId: string,
    data: {
      url?: string;
      events?: string[];
      headers?: Record<string, string>;
      isActive?: boolean;
      maxRetries?: number;
      retryDelay?: number;
      backoffMultiplier?: number;
    }
  ) {
    return prismaWrite.webhook.update({
      where: { id: webhookId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string, appId: string) {
    return prismaWrite.webhook.delete({
      where: { id: webhookId },
    });
  }

  /**
   * Record webhook log
   */
  async logWebhookCall(
    webhookId: string,
    data: {
      event: string;
      status: string;
      statusCode?: number;
      responseTime: number;
      payload: Record<string, any>;
      response?: string;
      attemptNumber: number;
    }
  ) {
    return prismaWrite.webhookLog.create({
      data: {
        webhook_id: webhookId,
        ...data,
      },
    });
  }

  /**
   * Get webhook logs
   */
  async getWebhookLogs(
    webhookId: string,
    filters: {
      page: number;
      limit: number;
      status?: string;
    }
  ) {
    const skip = (filters.page - 1) * filters.limit;
    const where: any = { webhook_id: webhookId };

    if (filters.status) {
      where.status = filters.status;
    }

    const [logs, total] = await Promise.all([
      prismaRead.webhookLog.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { timestamp: 'desc' },
      }),
      prismaRead.webhookLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Update webhook failure tracking
   */
  async updateWebhookFailure(webhookId: string, error: string) {
    return prismaWrite.webhook.update({
      where: { id: webhookId },
      data: {
        failureCount: { increment: 1 },
        lastError: error,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Reset webhook failure tracking
   */
  async resetWebhookFailure(webhookId: string) {
    return prismaWrite.webhook.update({
      where: { id: webhookId },
      data: {
        failureCount: 0,
        lastError: null,
        lastTriggeredAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

export const appSettingsRepository = new AppSettingsRepository();
