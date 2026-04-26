import type { FastifyInstance } from 'fastify';
import {
  listAppNotificationLogs,
  getAppNotificationLog,
  exportNotificationLogs,
} from '../controllers/notification-logs.controller';
import { validateBaseToken } from '../middlewares/auth.middleware';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import {
  ListAppNotificationLogsSchema,
  GetAppNotificationLogSchema,
  ExportNotificationLogsSchema,
} from '../schemas/routes/notification-logs.schema';

export async function registerNotificationLogsRoutes(app: FastifyInstance) {
  // List App Notification Logs
  app.get(
    '/organizations/:orgId/apps/:appId/notifications',
    {
      onRequest: [validateBaseToken],
      schema: ListAppNotificationLogsSchema,
    },
    asyncWrapper(listAppNotificationLogs)
  );

  // Export Notification Logs (before :notificationId route)
  app.get(
    '/organizations/:orgId/apps/:appId/notifications/export',
    {
      onRequest: [validateBaseToken],
      schema: ExportNotificationLogsSchema,
    },
    asyncWrapper(exportNotificationLogs)
  );

  // Get Single App Notification Log
  app.get(
    '/organizations/:orgId/apps/:appId/notifications/:notificationId',
    {
      onRequest: [validateBaseToken],
      schema: GetAppNotificationLogSchema,
    },
    asyncWrapper(getAppNotificationLog)
  );
}
