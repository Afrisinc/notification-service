import { FastifyRequest, FastifyReply } from 'fastify';
import { appService, CreateAppRequest } from '../services/app.service';
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

export async function getAppNotifications(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };
    const query = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);

    const notifications = await appService.getAppNotifications(appId, accountId, page, limit, {
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return ApiResponseHelper.success(reply, 'Notifications retrieved successfully', notifications);
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
