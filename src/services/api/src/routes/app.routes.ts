import type { FastifyInstance } from 'fastify';
import {
  createApp,
  getApp,
  listApps,
  updateApp,
  deleteApp,
  rotateApiKey,
  getAppsByOrganization,
  getAppTemplates,
  getAppTemplateById,
  createAppTemplate,
  updateAppTemplate,
  deleteAppTemplate,
  getAppOverview,
} from '../controllers/app.controller';
import { validateBaseToken } from '../middlewares/auth.middleware';
import {
  CreateAppRouteSchema,
  ListAppsRouteSchema,
  GetAppRouteSchema,
  UpdateAppRouteSchema,
  DeleteAppRouteSchema,
  RotateApiKeyRouteSchema,
  GetAppsByOrgRouteSchema,
} from '../schemas';
import { CreateAppTemplateRouteSchema } from '../schemas/routes/app.schema';
import { GetAppOverviewSchema } from '../schemas/routes/app-overview.schema';

export async function registerAppRoutes(app: FastifyInstance) {
  // Create App
  app.post(
    '/apps',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...CreateAppRouteSchema,
        tags: ['Applications'],
        summary: 'Create a new application',
        description: 'Create a new application within your account',
      },
    },
    createApp
  );

  // List Apps
  app.get(
    '/apps',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...ListAppsRouteSchema,
        tags: ['Applications'],
        summary: 'List all applications',
        description: 'Retrieve all applications for the current account',
      },
    },
    listApps
  );

  // Get App
  app.get(
    '/apps/:appId',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...GetAppRouteSchema,
        tags: ['Applications'],
        summary: 'Get application details',
        description: 'Retrieve details of a specific application',
      },
    },
    getApp
  );

  // Update App
  app.patch(
    '/apps/:appId',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...UpdateAppRouteSchema,
        tags: ['Applications'],
        summary: 'Update application',
        description: 'Update application details (name, environment, status)',
      },
    },
    updateApp
  );

  // Delete App
  app.delete(
    '/apps/:appId',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...DeleteAppRouteSchema,
        tags: ['Applications'],
        summary: 'Delete application',
        description: 'Delete an application and all its associated data',
      },
    },
    deleteApp
  );

  // Rotate API Key
  app.post(
    '/apps/:appId/rotate-key',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...RotateApiKeyRouteSchema,
        tags: ['Applications'],
        summary: 'Rotate API key',
        description: 'Generate a new API key for the application',
      },
    },
    rotateApiKey
  );

  // Get Apps by Organization
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
    '/apps/:appId/templates',
    {
      onRequest: [validateBaseToken],
      schema: CreateAppTemplateRouteSchema,
    },
    createAppTemplate
  );

  // Get App Templates
  app.get(
    '/apps/:appId/templates',
    {
      onRequest: [validateBaseToken],
      schema: {
        tags: ['Applications', 'Templates'],
        summary: 'Get app templates',
        description: 'Retrieve all templates installed on a specific app',
      },
    },
    getAppTemplates
  );

  // Get App Template by ID
  app.get(
    '/apps/:appId/templates/:templateId',
    {
      onRequest: [validateBaseToken],
      schema: {
        params: {
          type: 'object',
          properties: {
            appId: { type: 'string', description: 'App ID' },
            templateId: { type: 'string', description: 'Template ID' },
          },
          required: ['appId', 'templateId'],
        },
        tags: ['Applications', 'Templates'],
        summary: 'Get app template details',
        description: 'Retrieve details of a specific template installed on an app',
      },
    },
    getAppTemplateById
  );

  // Update App Template
  app.put(
    '/apps/:appId/templates/:templateId',
    {
      onRequest: [validateBaseToken],
      schema: {
        params: {
          type: 'object',
          properties: {
            appId: { type: 'string', description: 'App ID' },
            templateId: { type: 'string', description: 'Template ID' },
          },
          required: ['appId', 'templateId'],
        },
        body: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Email subject' },
            content: { type: 'string', description: 'Template content (HTML)' },
            description: { type: 'string', description: 'Template description' },
            design_json: { type: 'object', description: 'Design configuration' },
            editor_type: {
              type: 'string',
              enum: ['visual', 'code'],
              description: 'Editor type',
            },
            code: { type: 'string', description: 'Template code' },
            channel: { type: 'string', description: 'Notification channel' },
            language: { type: 'string', description: 'Language code' },
          },
        },
        tags: ['Applications', 'Templates'],
        summary: 'Update app template',
        description: 'Update an existing template on an app',
      },
    },
    updateAppTemplate
  );

  // Delete App Template
  app.delete(
    '/apps/:appId/templates/:templateId',
    {
      onRequest: [validateBaseToken],
      schema: {
        params: {
          type: 'object',
          properties: {
            appId: { type: 'string', description: 'App ID' },
            templateId: { type: 'string', description: 'Template ID' },
          },
          required: ['appId', 'templateId'],
        },
        tags: ['Applications', 'Templates'],
        summary: 'Delete app template',
        description: 'Delete a template from an app (only template owner can delete)',
      },
    },
    deleteAppTemplate
  );

  // Get App Overview
  app.get(
    '/apps/:appId/overview',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...GetAppOverviewSchema,
        tags: ['Applications', 'Analytics'],
        summary: 'Get app overview with statistics',
        description: 'Retrieve app overview including stats, chart data, and recent activity',
      },
    },
    getAppOverview
  );
}
