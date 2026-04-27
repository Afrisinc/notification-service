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
  const { orgId } = req.params as { orgId: string };
  const userId = (req as any).user?.id;

  try {
    if (!userId) {
      return ApiResponseHelper.unauthorized(reply, 'User information not found');
    }

    const body = req.body as CreateAppRequest;
    
    const app = await appService.createApp(body, orgId, userId);

    logger.info({ userId, orgId, appId: app.id, appName: app.name }, 'App created successfully');

    // Track usage using the app's account_id
    await UsageTrackingService.recordUsage(app.account_id, app.id, 'apps', 1);

    return ApiResponseHelper.success(reply, 'App created successfully', app, 201);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to create app');
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    throw err;
  }
}

export async function getApp(req: FastifyRequest, reply: FastifyReply) {
  const { orgId, appId } = req.params as { orgId: string; appId: string };

  try {
    const app = await appService.getAppByOrganization(appId, orgId);
    return ApiResponseHelper.success(reply, 'App retrieved successfully', app);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    throw err; // Re-throw for asyncWrapper to handle
  }
}

export async function listApps(req: FastifyRequest, reply: FastifyReply) {
  const { orgId } = req.params as { orgId: string };

  try {
    const apps = await appService.getAppsByOrganization(orgId);

    return ApiResponseHelper.success(reply, 'Apps retrieved successfully', {
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
    throw err;
  }
}

export async function updateApp(req: FastifyRequest, reply: FastifyReply) {
  const { orgId, appId } = req.params as { orgId: string; appId: string };
  const body = req.body as { name?: string; environment?: string; status?: string };

  try {
    const app = await appService.updateApp(appId, orgId, body);

    logger.info({ orgId, appId }, 'App updated successfully');

    return ApiResponseHelper.success(reply, 'App updated successfully', app);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    throw err;
  }
}

export async function deleteApp(req: FastifyRequest, reply: FastifyReply) {
  const { orgId, appId } = req.params as { orgId: string; appId: string };

  try {
    await appService.deleteApp(appId, orgId);

    logger.info({ orgId, appId }, 'App deleted successfully');

    return ApiResponseHelper.success(reply, 'App deleted successfully', { id: appId });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('Unauthorized')) {
      return ApiResponseHelper.forbidden(reply, errorMessage);
    }
    throw err;
  }
}

export async function rotateApiKey(req: FastifyRequest, reply: FastifyReply) {
  const { orgId, appId } = req.params as { orgId: string; appId: string };

  try {
    const newApiKey = await appService.rotateApiKey(appId, orgId);

    logger.info({ orgId, appId }, 'API key rotated successfully');

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
    throw err;
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

export async function getAppsByOrganizationDetails(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId } = req.params as { orgId: string };
    const { search } = req.query as { search?: string };

    const apps = await appService.getAppsByOrganizationDetails(orgId, search);

    logger.info({ orgId, appCount: apps.length, search }, 'Organization apps (details only) retrieved successfully');

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
  const userId = (req as any).user?.id;
  const { orgId, appId } = req.params as { orgId: string; appId: string };
  const body = req.body as any;

  if (!userId) {
    throw new Error('User information not found');
  }

  const result = await appService.createAppTemplate(appId, orgId, userId, body);

  return ApiResponseHelper.success(reply, 'Template created/installed on app successfully', result, 201);
}

export async function updateAppTemplate(req: FastifyRequest, reply: FastifyReply) {
  const { orgId, appId, templateId } = req.params as { orgId: string; appId: string; templateId: string };
  const body = req.body as any;

  const result = await appService.updateAppTemplate(appId, templateId, orgId, body);

  return ApiResponseHelper.success(reply, 'Template updated successfully', result);
}

export async function deleteAppTemplate(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req as any).user?.id;
  const { orgId, appId, templateId } = req.params as { orgId: string; appId: string; templateId: string };

  if (!userId) {
    throw new Error('User information not found');
  }

  const result = await appService.deleteAppTemplate(appId, templateId, orgId, userId);

  return ApiResponseHelper.success(reply, result.message, {}, 200);
}

export async function getAppTemplateById(req: FastifyRequest, reply: FastifyReply) {
  const { orgId, appId, templateId } = req.params as { orgId: string; appId: string; templateId: string };

  const result = await appService.getAppTemplateById(appId, templateId, orgId);

  return ApiResponseHelper.success(reply, 'App template retrieved successfully', result);
}

export async function getAppTemplates(req: FastifyRequest, reply: FastifyReply) {
  const { orgId, appId } = req.params as { orgId: string; appId: string };

  const result = await appService.getAppTemplates(appId, orgId);

  return ApiResponseHelper.success(reply, 'App templates retrieved successfully', result);
}

export async function getAppOverview(req: FastifyRequest, reply: FastifyReply) {
  const { orgId, appId } = req.params as { orgId: string; appId: string };
  const query = req.query as {
    startDate?: string;
    endDate?: string;
    channels?: string;
  };

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
  const overview = await overviewService.getAppOverview(appId, orgId, filters);

  return ApiResponseHelper.success(reply, 'App overview retrieved successfully', overview);
}
