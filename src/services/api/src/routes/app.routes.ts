import type { FastifyInstance } from 'fastify';
import {
  createApp,
  getApp,
  listApps,
  updateApp,
  deleteApp,
  rotateApiKey,
  getAppsByOrganization,
  getAppsByOrganizationDetails,
  getAppTemplates,
  getAppTemplateById,
  createAppTemplate,
  updateAppTemplate,
  deleteAppTemplate,
  getAppOverview,
} from '../controllers/app.controller';
import { validateBaseToken } from '../middlewares/auth.middleware';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { planGuards } from '../guards/plan-guard';
import {
  CreateAppRouteSchema,
  ListAppsRouteSchema,
  GetAppRouteSchema,
  UpdateAppRouteSchema,
  DeleteAppRouteSchema,
  RotateApiKeyRouteSchema,
  GetAppsByOrgRouteSchema,
} from '../schemas';
import {
  CreateAppTemplateRouteSchema,
  GetAppsByOrganizationDetailsSchema,
  GetAppTemplatesParamsSchema,
  GetAppTemplateByIdParamsSchema,
  UpdateAppTemplateParamsSchema,
  DeleteAppTemplateParamsSchema,
  UpdateAppTemplateBodySchema,
} from '../schemas/routes/app.schema';
import { GetAppOverviewSchema } from '../schemas/routes/app-overview.schema';

export async function registerAppRoutes(app: FastifyInstance) {
  // Create App
  app.post(
    '/organizations/:orgId/apps',
    {
      onRequest: [validateBaseToken],
      preHandler: [planGuards.checkEntityLimit('apps')],
      schema: {
        ...CreateAppRouteSchema,
        tags: ['Applications'],
        summary: 'Create a new application',
        description: 'Create a new application within your organization',
      },
    },
    asyncWrapper(createApp)
  );

  // List Apps (organization-based, replaces old /apps endpoint)
  app.get(
    '/organizations/:orgId/apps-list',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...ListAppsRouteSchema,
        tags: ['Applications'],
        summary: 'List all applications in organization',
        description: 'Retrieve all applications for the organization',
      },
    },
    asyncWrapper(listApps)
  );
  // Get App
  app.get(
    '/organizations/:orgId/apps/:appId',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...GetAppRouteSchema,
        tags: ['Applications'],
        summary: 'Get application details',
        description: 'Retrieve details of a specific application',
      },
    },
    asyncWrapper(getApp)
  );

  // Update App
  app.patch(
    '/organizations/:orgId/apps/:appId',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...UpdateAppRouteSchema,
        tags: ['Applications'],
        summary: 'Update application',
        description: 'Update application details (name, environment, status)',
      },
    },
    asyncWrapper(updateApp)
  );

  // Delete App
  app.delete(
    '/organizations/:orgId/apps/:appId',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...DeleteAppRouteSchema,
        tags: ['Applications'],
        summary: 'Delete application',
        description: 'Delete an application and all its associated data',
      },
    },
    asyncWrapper(deleteApp)
  );

  // Rotate API Key
  app.post(
    '/organizations/:orgId/apps/:appId/rotate-key',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...RotateApiKeyRouteSchema,
        tags: ['Applications'],
        summary: 'Rotate API key',
        description: 'Generate a new API key for the application',
      },
    },
    asyncWrapper(rotateApiKey)
  );

  // Get Apps by Organization (details only, no metrics) - MUST come before generic /organizations/:orgId/apps
  app.get(
    '/organizations/:orgId/apps/details',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...GetAppsByOrganizationDetailsSchema,
      },
    },
    asyncWrapper(getAppsByOrganizationDetails)
  );

  // Get Apps by Organization (with metrics)
  app.get(
    '/organizations/:orgId/apps',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...GetAppsByOrgRouteSchema,
        tags: ['Applications', 'Organizations'],
        summary: 'Get organization apps',
        description: 'Retrieve all applications for a specific organization with metrics',
      },
    },
    getAppsByOrganization
  );

  // Create/Install App Template
  app.post(
    '/organizations/:orgId/apps/:appId/templates',
    {
      onRequest: [validateBaseToken],
      preHandler: [planGuards.checkEntityLimit('templates')],
      schema: CreateAppTemplateRouteSchema,
    },
    asyncWrapper(createAppTemplate)
  );

  // Get App Templates
  app.get(
    '/organizations/:orgId/apps/:appId/templates',
    {
      onRequest: [validateBaseToken],
      schema: {
        params: GetAppTemplatesParamsSchema,
        tags: ['Applications', 'Templates'],
        summary: 'Get app templates',
        description: 'Retrieve all templates installed on a specific app',
      },
    },
    asyncWrapper(getAppTemplates)
  );

  // Get App Template by ID
  app.get(
    '/organizations/:orgId/apps/:appId/templates/:templateId',
    {
      onRequest: [validateBaseToken],
      schema: {
        params: GetAppTemplateByIdParamsSchema,
        tags: ['Applications', 'Templates'],
        summary: 'Get app template details',
        description: 'Retrieve details of a specific template installed on an app',
      },
    },
    asyncWrapper(getAppTemplateById)
  );

  // Update App Template
  app.put(
    '/organizations/:orgId/apps/:appId/templates/:templateId',
    {
      onRequest: [validateBaseToken],
      schema: {
        params: UpdateAppTemplateParamsSchema,
        body: UpdateAppTemplateBodySchema,
        tags: ['Applications', 'Templates'],
        summary: 'Update app template',
        description: 'Update an existing template on an app',
      },
    },
    asyncWrapper(updateAppTemplate)
  );

  // Delete App Template
  app.delete(
    '/organizations/:orgId/apps/:appId/templates/:templateId',
    {
      onRequest: [validateBaseToken],
      schema: {
        params: DeleteAppTemplateParamsSchema,
        tags: ['Applications', 'Templates'],
        summary: 'Delete app template',
        description: 'Delete a template from an app (only template owner can delete)',
      },
    },
    asyncWrapper(deleteAppTemplate)
  );

  // Get App Overview
  app.get(
    '/organizations/:orgId/apps/:appId/overview',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...GetAppOverviewSchema,
        tags: ['Applications', 'Analytics'],
        summary: 'Get app overview with statistics',
        description: 'Retrieve app overview including stats, chart data, and recent activity',
      },
    },
    asyncWrapper(getAppOverview)
  );
}
