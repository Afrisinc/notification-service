import { standardErrorResponses } from '../common/error-responses';

const notificationLogObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    appId: { type: 'string', format: 'uuid' },
    recipient: { type: 'string' },
    templateId: { type: 'string', format: 'uuid' },
    templateName: { type: 'string' },
    channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WHATSAPP'] },
    status: { type: 'string', enum: ['DELIVERED', 'FAILED', 'PENDING', 'BOUNCED', 'QUEUED'] },
    provider: { type: 'string' },
    providerMessageId: { type: ['string', 'null'] },
    sentAt: { type: ['string', 'null'], format: 'date-time' },
    deliveredAt: { type: ['string', 'null'], format: 'date-time' },
    openedAt: { type: ['string', 'null'], format: 'date-time' },
    clickedAt: { type: ['string', 'null'], format: 'date-time' },
    bounceType: { type: ['string', 'null'] },
    errorMessage: { type: ['string', 'null'] },
    errorCode: { type: ['string', 'null'] },
    campaignId: { type: ['string', 'null'], format: 'uuid' },
    metadata: { type: 'object' },
  },
};

export const ListAppNotificationLogsSchema = {
  description: 'List notification logs for an app with pagination, filtering, and search',
  tags: ['Notifications', 'Logs'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
    },
    required: ['appId'],
  },
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', default: 1, description: 'Page number' },
      limit: { type: 'integer', default: 50, maximum: 100, description: 'Items per page' },
      status: { type: 'string', description: 'Filter by status (comma-separated)' },
      channel: { type: 'string', description: 'Filter by channel (comma-separated)' },
      search: { type: 'string', description: 'Search by recipient or template name' },
      dateFrom: { type: 'string', format: 'date-time', description: 'Filter from date' },
      dateTo: { type: 'string', format: 'date-time', description: 'Filter to date' },
      campaignId: { type: 'string', format: 'uuid', description: 'Filter by campaign ID' },
      templateId: { type: 'string', format: 'uuid', description: 'Filter by template ID' },
      provider: { type: 'string', description: 'Filter by provider' },
    },
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            appId: { type: 'string', format: 'uuid' },
            notifications: { type: 'array', items: notificationLogObject },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
            summary: {
              type: 'object',
              properties: {
                totalCount: { type: 'integer' },
                deliveredCount: { type: 'integer' },
                failedCount: { type: 'integer' },
                pendingCount: { type: 'integer' },
                bouncedCount: { type: 'integer' },
                deliveryRate: { type: 'integer' },
                failureRate: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const GetAppNotificationLogSchema = {
  description: 'Get a single notification log with full details',
  tags: ['Notifications', 'Logs'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      notificationId: { type: 'string', format: 'uuid', description: 'Notification ID' },
    },
    required: ['appId', 'notificationId'],
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            ...notificationLogObject.properties,
            recipientType: { type: 'string' },
            templateCode: { type: 'string' },
            attemptCount: { type: 'integer' },
            lastRetryAt: { type: ['string', 'null'], format: 'date-time' },
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                  details: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const ExportNotificationLogsSchema = {
  description: 'Export notification logs as CSV or JSON',
  tags: ['Notifications', 'Logs'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
    },
    required: ['appId'],
  },
  querystring: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['csv', 'json'], default: 'csv' },
      status: { type: 'string', description: 'Filter by status' },
      channel: { type: 'string', description: 'Filter by channel' },
      dateFrom: { type: 'string', format: 'date-time' },
      dateTo: { type: 'string', format: 'date-time' },
      fields: { type: 'string', description: 'Comma-separated fields to include' },
    },
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'string',
      description: 'File download (CSV or JSON)',
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const ListAllNotificationLogsSchema = {
  description: 'List notification logs across all apps (org-level access)',
  tags: ['Notifications', 'Logs'],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', default: 1 },
      limit: { type: 'integer', default: 50, maximum: 100 },
      status: { type: 'string', description: 'Filter by status' },
      channel: { type: 'string', description: 'Filter by channel' },
      dateFrom: { type: 'string', format: 'date-time' },
      dateTo: { type: 'string', format: 'date-time' },
      appId: { type: 'string', format: 'uuid', description: 'Filter by app' },
    },
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            notifications: { type: 'array', items: notificationLogObject },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const GetNotificationStatusSchema = {
  description: 'Get real-time status of a notification (public endpoint)',
  tags: ['Notifications', 'Logs'],
  params: {
    type: 'object',
    properties: {
      notificationId: { type: 'string', format: 'uuid', description: 'Notification ID' },
    },
    required: ['notificationId'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            recipient: { type: 'string' },
            channel: { type: 'string' },
            sentAt: { type: ['string', 'null'], format: 'date-time' },
            deliveredAt: { type: ['string', 'null'], format: 'date-time' },
            openedAt: { type: ['string', 'null'], format: 'date-time' },
            clickedAt: { type: ['string', 'null'], format: 'date-time' },
            errorMessage: { type: ['string', 'null'] },
            provider: { type: 'string' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
};
