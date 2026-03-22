import type { FastifyInstance } from 'fastify';
import {
  getAppSettings,
  updateAppSettings,
  updateAllowedDomains,
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookLogs,
} from '../controllers/app-settings.controller';
import { validateBaseToken } from '../middlewares/auth.middleware';
import {
  GetAppSettingsSchema,
  UpdateAppSettingsSchema,
  UpdateAllowedDomainsSchema,
  ListWebhooksSchema,
  CreateWebhookSchema,
  UpdateWebhookSchema,
  DeleteWebhookSchema,
  TestWebhookSchema,
  GetWebhookLogsSchema,
} from '../schemas/routes/app-settings.schema';

export async function registerAppSettingsRoutes(app: FastifyInstance) {
  // Get App Settings
  app.get(
    '/apps/:appId/settings',
    {
      onRequest: [validateBaseToken],
      schema: GetAppSettingsSchema,
    },
    getAppSettings
  );

  // Update App General Settings
  app.patch(
    '/apps/:appId/settings',
    {
      onRequest: [validateBaseToken],
      schema: UpdateAppSettingsSchema,
    },
    updateAppSettings
  );

  // Update Allowed Domains
  app.put(
    '/apps/:appId/settings/domains',
    {
      onRequest: [validateBaseToken],
      schema: UpdateAllowedDomainsSchema,
    },
    updateAllowedDomains
  );

  // List Webhooks (before :webhookId to avoid route collision)
  app.get(
    '/apps/:appId/webhooks',
    {
      onRequest: [validateBaseToken],
      schema: ListWebhooksSchema,
    },
    listWebhooks
  );

  // Create Webhook
  app.post(
    '/apps/:appId/webhooks',
    {
      onRequest: [validateBaseToken],
      schema: CreateWebhookSchema,
    },
    createWebhook
  );

  // Test Webhook (before :webhookId to avoid route collision)
  app.post(
    '/apps/:appId/webhooks/:webhookId/test',
    {
      onRequest: [validateBaseToken],
      schema: TestWebhookSchema,
    },
    testWebhook
  );

  // Get Webhook Logs (before PUT/DELETE to avoid route collision)
  app.get(
    '/apps/:appId/webhooks/:webhookId/logs',
    {
      onRequest: [validateBaseToken],
      schema: GetWebhookLogsSchema,
    },
    getWebhookLogs
  );

  // Update Webhook
  app.put(
    '/apps/:appId/webhooks/:webhookId',
    {
      onRequest: [validateBaseToken],
      schema: UpdateWebhookSchema,
    },
    updateWebhook
  );

  // Delete Webhook
  app.delete(
    '/apps/:appId/webhooks/:webhookId',
    {
      onRequest: [validateBaseToken],
      schema: DeleteWebhookSchema,
    },
    deleteWebhook
  );
}
