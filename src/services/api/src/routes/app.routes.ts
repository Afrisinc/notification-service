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
  getAppNotifications,
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
      schema: {
        params: {
          type: 'object',
          properties: {
            appId: { type: 'string', description: 'App ID' },
          },
          required: ['appId'],
        },
        body: {
          type: 'object',
          properties: {
            template_id: { type: 'string', description: 'Template ID to install' },
            customizations: { type: 'object', description: 'Custom overrides for this installation' },
            status: {
              type: 'string',
              enum: ['active', 'archived', 'disabled'],
              description: 'Installation status',
              default: 'active',
            },
          },
          required: ['template_id'],
        },
        tags: ['Applications', 'Templates'],
        summary: 'Install template on app',
        description: 'Install a template on a specific app with optional customizations',
      },
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

  // Get App Notifications/Logs
  app.get(
    '/apps/:appId/notifications',
    {
      onRequest: [validateBaseToken],
      schema: {
        tags: ['Applications', 'Notifications'],
        summary: 'Get app notification logs',
        description: 'Retrieve notification delivery logs for a specific app with pagination and filtering',
      },
    },
    getAppNotifications
  );
}
