import { FastifyRequest, FastifyReply } from 'fastify';
import { appSettingsService } from '../services/app-settings.service';
import { ApiResponseHelper } from '../utils';
import { logger } from '../config/logger';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

/**
 * Endpoint 1: Get App Settings
 */
export async function getAppSettings(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = req.params as { appId: string };
    const accountId = req.headers['x-account-id'] as string;

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const settings = await appSettingsService.getSettings(appId);

    return ApiResponseHelper.success(reply, 'App settings retrieved successfully', {
      appId,
      name: (settings as any)?.app?.name || '',
      environment: (settings as any)?.app?.environment || 'development',
      description: settings?.description || '',
      status: (settings as any)?.app?.status || 'active',
      allowedDomains: settings?.allowedDomains || [],
      createdAt: settings?.createdAt,
      updatedAt: settings?.updatedAt,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to get app settings');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 2: Update App General Settings
 */
export async function updateAppSettings(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = req.params as { appId: string };
    const accountId = req.headers['x-account-id'] as string;
    const body = req.body as { description?: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const updated = await appSettingsService.updateSettings(appId, body);

    return ApiResponseHelper.success(reply, 'App settings updated successfully', {
      appId,
      description: updated.description,
      updatedAt: updated.updatedAt,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to update app settings');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 3: Update Allowed Domains
 */
export async function updateAllowedDomains(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = req.params as { appId: string };
    const accountId = req.headers['x-account-id'] as string;
    const body = req.body as { allowedDomains: string[] };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    if (!body.allowedDomains || !Array.isArray(body.allowedDomains)) {
      return ApiResponseHelper.badRequest(reply, 'allowedDomains must be an array');
    }

    const updated = await appSettingsService.updateAllowedDomains(appId, body.allowedDomains);

    return ApiResponseHelper.success(reply, 'Allowed domains updated successfully', {
      appId,
      allowedDomains: updated.allowedDomains,
      updatedAt: updated.updatedAt,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to update allowed domains');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 4: List Webhooks
 */
export async function listWebhooks(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = req.params as { appId: string };
    const accountId = req.headers['x-account-id'] as string;

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const webhooks = await appSettingsService.listWebhooks(appId);

    return ApiResponseHelper.success(reply, 'Webhooks retrieved successfully', {
      appId,
      webhooks: webhooks.map((w: any) => ({
        id: w.id,
        appId: w.app_id,
        url: w.url,
        events: w.events,
        headers: w.headers,
        isActive: w.isActive,
        retryPolicy: {
          maxRetries: w.maxRetries,
          retryDelay: w.retryDelay,
          backoffMultiplier: w.backoffMultiplier,
        },
        failureCount: w.failureCount,
        lastError: w.lastError,
        lastTriggeredAt: w.lastTriggeredAt,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      total: webhooks.length,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to list webhooks');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 5: Create Webhook
 */
export async function createWebhook(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = req.params as { appId: string };
    const accountId = req.headers['x-account-id'] as string;
    const body = req.body as any;

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const webhook = await appSettingsService.createWebhook(appId, body);

    return ApiResponseHelper.success(
      reply,
      'Webhook created successfully',
      {
        id: webhook.id,
        appId: webhook.app_id,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt,
      },
      201
    );
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to create webhook');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 6: Update Webhook
 */
export async function updateWebhook(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, webhookId } = req.params as { appId: string; webhookId: string };
    const accountId = req.headers['x-account-id'] as string;
    const body = req.body as any;

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const webhook = await appSettingsService.updateWebhook(webhookId, appId, body);

    return ApiResponseHelper.success(reply, 'Webhook updated successfully', {
      id: webhook.id,
      appId: webhook.app_id,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      updatedAt: webhook.updatedAt,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to update webhook');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 7: Delete Webhook
 */
export async function deleteWebhook(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, webhookId } = req.params as { appId: string; webhookId: string };
    const accountId = req.headers['x-account-id'] as string;

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const webhook = await appSettingsService.deleteWebhook(webhookId, appId);

    return ApiResponseHelper.success(reply, 'Webhook deleted successfully', {
      id: webhook.id,
      deletedAt: new Date(),
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to delete webhook');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 8: Test Webhook
 */
export async function testWebhook(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, webhookId } = req.params as { appId: string; webhookId: string };
    const accountId = req.headers['x-account-id'] as string;
    const body = req.body as { event: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    if (!body.event) {
      return ApiResponseHelper.badRequest(reply, 'Event type is required');
    }

    const result = await appSettingsService.testWebhook(webhookId, appId, body.event);

    return ApiResponseHelper.success(reply, 'Webhook test sent successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to test webhook');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Bonus: Get Webhook Logs
 */
export async function getWebhookLogs(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, webhookId } = req.params as { appId: string; webhookId: string };
    const accountId = req.headers['x-account-id'] as string;
    const query = req.query as {
      page?: string;
      limit?: string;
      status?: string;
    };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);

    const { logs, total } = await appSettingsService.getWebhookLogs(webhookId, appId, {
      page,
      limit,
      status: query.status,
    });

    return ApiResponseHelper.success(reply, 'Webhook logs retrieved successfully', {
      webhookId,
      logs: logs.map((l: any) => ({
        id: l.id,
        event: l.event,
        status: l.status,
        statusCode: l.statusCode,
        responseTime: l.responseTime,
        payload: l.payload,
        response: l.response,
        attemptNumber: l.attemptNumber,
        nextRetryAt: l.nextRetryAt,
        timestamp: l.timestamp,
      })),
      total,
      page,
      limit,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to get webhook logs');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}
