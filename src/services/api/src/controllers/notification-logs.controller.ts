import { FastifyRequest, FastifyReply } from 'fastify';
import { notificationLogsService } from '../services/notification-logs.service';
import { ApiResponseHelper } from '../utils';
import pino from 'pino';

const logger = pino();

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

export async function listAppNotificationLogs(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };
    const query = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      channel?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      campaignId?: string;
      templateId?: string;
      provider?: string;
    };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const result = await notificationLogsService.listAppLogs(appId, {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      status: query.status,
      channel: query.channel,
      search: query.search,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      campaignId: query.campaignId,
      templateId: query.templateId,
      provider: query.provider,
    });

    return ApiResponseHelper.success(reply, 'Notification logs retrieved successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to list app notification logs');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function getAppNotificationLog(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId, notificationId } = req.params as { appId: string; notificationId: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const log = await notificationLogsService.getNotificationLog(appId, notificationId);

    return ApiResponseHelper.success(reply, 'Notification log retrieved successfully', log);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to get notification log');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function exportNotificationLogs(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };
    const query = req.query as {
      format?: string;
      status?: string;
      channel?: string;
      dateFrom?: string;
      dateTo?: string;
      fields?: string;
    };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const format = query.format || 'csv';
    const logs = await notificationLogsService.getLogsForExport(appId, {
      status: query.status,
      channel: query.channel,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    });

    if (format === 'json') {
      const filename = `notification-logs-${new Date().toISOString().split('T')[0]}.json`;
      return reply.header('Content-Disposition', `attachment; filename=${filename}`).send(logs);
    }

    // CSV export
    if (logs.length === 0) {
      const filename = `notification-logs-${new Date().toISOString().split('T')[0]}.csv`;
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename=${filename}`)
        .send('id,recipient,templateName,channel,status,sentAt,deliveredAt,errorMessage\n');
    }

    const csvContent = convertToCsv(logs, query.fields?.split(','));
    const filename = `notification-logs-${new Date().toISOString().split('T')[0]}.csv`;

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename=${filename}`)
      .send(csvContent);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to export logs');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function listAllNotificationLogs(req: FastifyRequest, reply: FastifyReply) {
  try {
    const query = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      channel?: string;
      dateFrom?: string;
      dateTo?: string;
      appId?: string;
    };

    const result = await notificationLogsService.listAllLogs({
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      status: query.status,
      channel: query.channel,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      appId: query.appId,
    });

    return ApiResponseHelper.success(reply, 'Notification logs retrieved successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to list notification logs');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function getNotificationStatus(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { notificationId } = req.params as { notificationId: string };

    const status = await notificationLogsService.getNotificationStatus(notificationId);

    return ApiResponseHelper.success(reply, 'Notification status retrieved successfully', status);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to get notification status');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

function convertToCsv(logs: any[], fields?: string[]): string {
  const defaultFields = [
    'id',
    'recipient',
    'templateName',
    'channel',
    'status',
    'sentAt',
    'deliveredAt',
    'errorMessage',
  ];
  const fieldsToUse = fields || defaultFields;

  const headers = fieldsToUse.join(',');
  const rows = logs.map((log: any) => {
    return fieldsToUse
      .map((field) => {
        let value = log[field];
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
          value = `"${value}"`;
        }
        return value ?? '';
      })
      .join(',');
  });

  return [headers, ...rows].join('\n');
}
