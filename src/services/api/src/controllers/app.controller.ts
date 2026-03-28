import { FastifyRequest, FastifyReply } from 'fastify';
import { appService, CreateAppRequest } from '../services/app.service';
import { AppOverviewService } from '../services/app-overview.service';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { ApiResponseHelper } from '../utils';
import { logger } from '../config/logger';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

export async function createApp(req: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (req as any).user?.id;
    const accountId = req.headers['x-account-id'] as string;

    if (!userId || !accountId) {
      return ApiResponseHelper.unauthorized(reply, 'User or account information not found');
    }

    const body = req.body as CreateAppRequest;

    // Use the account from header for security
    body.account_id = accountId;

    const app = await appService.createApp(body);

    logger.info({ userId, accountId, appId: app.id, appName: app.name }, 'App created successfully');

    // Track usage
    await UsageTrackingService.recordUsage(accountId, app.id, 'apps', 1);

    return ApiResponseHelper.success(reply, 'App created successfully', app, 201);
  } catch (err: unknown) {
    logger.error({ error: getErrorMessage(err) }, 'Failed to create app');
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function getApp(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const app = await appService.getApp(appId, accountId);

    return ApiResponseHelper.success(reply, 'App retrieved successfully', app);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function listApps(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const apps = await appService.listAppsByAccount(accountId);

    return ApiResponseHelper.success(reply, 'Apps retrieved successfully', {
      account_id: accountId,
      apps,
      total: apps.length,
    });
  } catch (err: unknown) {
    return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
  }
}

export async function updateApp(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };
    const body = req.body as { name?: string; environment?: string; status?: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const app = await appService.updateApp(appId, accountId, body);

    logger.info({ accountId, appId }, 'App updated successfully');

    return ApiResponseHelper.success(reply, 'App updated successfully', app);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function deleteApp(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    await appService.deleteApp(appId, accountId);

    logger.info({ accountId, appId }, 'App deleted successfully');

    return ApiResponseHelper.success(reply, 'App deleted successfully', { id: appId });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function rotateApiKey(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const newApiKey = await appService.rotateApiKey(appId, accountId);

    logger.info({ accountId, appId }, 'API key rotated successfully');

    return ApiResponseHelper.success(reply, 'API key rotated successfully', {
      id: appId,
      api_key: newApiKey,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function getAppsByOrganization(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId } = req.params as { orgId: string };

    const apps = await appService.getAppsByOrganization(orgId);

    logger.info({ orgId, appCount: apps.length }, 'Organization apps retrieved successfully');

    return ApiResponseHelper.success(reply, 'Organization apps retrieved successfully', {
      organization_id: orgId,
      apps,
      total: apps.length,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function createAppTemplate(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const userId = (req as any).user?.id;
    const { appId } = req.params as { appId: string };
    const body = req.body as any;

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    if (!userId) {
      return ApiResponseHelper.unauthorized(reply, 'User information not found');
    }

    const result = await appService.createAppTemplate(appId, accountId, userId, body);

    return ApiResponseHelper.success(reply, 'Template created/installed on app successfully', result, 201);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    if (errorMessage.includes('already installed')) {
      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
    if (errorMessage.includes('Invalid reference')) {
      return ApiResponseHelper.badRequest(reply, 'Failed to create template: User reference invalid');
    }
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function updateAppTemplate(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId, templateId } = req.params as { appId: string; templateId: string };
    const body = req.body as any;

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const result = await appService.updateAppTemplate(appId, templateId, accountId, body);

    return ApiResponseHelper.success(reply, 'Template updated successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function deleteAppTemplate(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const userId = (req as any).user?.id;
    const { appId, templateId } = req.params as { appId: string; templateId: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    if (!userId) {
      return ApiResponseHelper.unauthorized(reply, 'User information not found');
    }

    const result = await appService.deleteAppTemplate(appId, templateId, accountId, userId);

    return ApiResponseHelper.success(reply, result.message, {}, 200);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized') || errorMessage.includes('creator')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function getAppTemplateById(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId, templateId } = req.params as { appId: string; templateId: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const result = await appService.getAppTemplateById(appId, templateId, accountId);

    return ApiResponseHelper.success(reply, 'App template retrieved successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function getAppTemplates(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const result = await appService.getAppTemplates(appId, accountId);

    return ApiResponseHelper.success(reply, 'App templates retrieved successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function getAppOverview(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };
    const query = req.query as {
      startDate?: string;
      endDate?: string;
      channels?: string;
    };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    // Parse filters
    const filters: {
      startDate?: Date;
      endDate?: Date;
      channels?: string[];
    } = {};

    if (query.startDate) {
      filters.startDate = new Date(query.startDate);
    }

    if (query.endDate) {
      filters.endDate = new Date(query.endDate);
    }

    if (query.channels) {
      filters.channels = query.channels
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c);
    }

    const overviewService = new AppOverviewService();
    const overview = await overviewService.getAppOverview(appId, accountId, filters);

    return ApiResponseHelper.success(reply, 'App overview retrieved successfully', overview);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}
