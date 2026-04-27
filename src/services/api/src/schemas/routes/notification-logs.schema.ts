import { standardErrorResponses } from '../common/error-responses';

const notificationLogObject = {
  type: 'object',
  description: 'Notification log object - optional fields only present when values exist',
  properties: {
    id: { type: 'string', format: 'uuid', description: 'Notification ID' },
    appId: { type: 'string', format: 'uuid', description: 'App ID' },
    accountId: { type: 'string', format: 'uuid', description: 'Account ID that owns the notification' },
    recipient: { type: 'string', description: 'Recipient email, phone number, or user ID' },
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WHATSAPP'],
      description: 'Notification delivery channel',
    },
    status: {
      type: 'string',
      enum: ['PENDING', 'DELIVERED', 'FAILED', 'BOUNCED', 'SENT'],
      description: 'Notification status (normalized, QUEUED → PENDING)',
    },
    deliveryState: {
      type: 'string',
      enum: ['PENDING_QUEUE', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED'],
      description:
        'Delivery state for queue management: PENDING_QUEUE (awaiting send), SENT (sent to provider), or terminal state',
    },
    source: { type: 'string', description: 'How notification was triggered (api, ui, automation, webhook, etc.)' },
    provider: { type: 'string', description: 'Delivery provider (internal, sendgrid, twilio, etc.)' },
    createdAt: { type: 'string', format: 'date-time', description: 'When notification was created (ISO 8601)' },
    sentAt: {
      type: 'string',
      format: 'date-time',
      description: 'When notification was sent to provider (ISO 8601). Null if not yet sent.',
    },
    retryCount: { type: 'integer', description: 'Number of delivery retry attempts made' },
    templateId: { type: 'string', format: 'uuid', description: '(Optional) Template ID if from a template' },
    templateCode: { type: 'string', description: '(Optional) Template code/identifier if from a template' },
    subject: { type: 'string', description: '(Optional) Email subject or message title' },
    providerMessageId: {
      type: 'string',
      description: '(Optional) Provider message ID for tracking with external service',
    },
    deliveredAt: {
      type: 'string',
      format: 'date-time',
      description: '(Optional) When recipient received the notification',
    },
    openedAt: {
      type: 'string',
      format: 'date-time',
      description: '(Optional) When recipient opened the notification (email/SMS)',
    },
    clickedAt: {
      type: 'string',
      format: 'date-time',
      description: '(Optional) When recipient clicked a link in the notification',
    },
    bounceType: {
      type: 'string',
      enum: ['hard', 'soft'],
      description: '(Optional) Type of bounce: hard (permanent) or soft (temporary)',
    },
    errorMessage: { type: 'string', description: '(Optional) Error message if delivery failed' },
    errorCode: { type: 'string', description: '(Optional) Error code if delivery failed' },
  },
  required: [
    'id',
    'appId',
    'accountId',
    'recipient',
    'channel',
    'status',
    'deliveryState',
    'source',
    'provider',
    'createdAt',
    'sentAt',
    'retryCount',
  ],
};

export const ListAppNotificationLogsSchema = {
  description: 'List notification logs for an app with pagination, filtering, and search',
  tags: ['Notifications', 'Logs'],
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', description: 'Organization ID' },
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
    },
    required: ['orgId', 'appId'],
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
              description: 'Statistics based on the filtered results (respects all active filters)',
              properties: {
                totalCount: { type: 'integer', description: 'Total notifications matching filters' },
                deliveredCount: { type: 'integer', description: 'Count of delivered notifications' },
                failedCount: { type: 'integer', description: 'Count of failed notifications' },
                pendingCount: { type: 'integer', description: 'Count of pending (not yet sent) notifications' },
                bouncedCount: { type: 'integer', description: 'Count of bounced notifications' },
                deliveryRate: { type: 'integer', description: 'Percentage of delivered notifications (0-100)' },
                failureRate: { type: 'integer', description: 'Percentage of failed notifications (0-100)' },
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
      orgId: { type: 'string', description: 'Organization ID' },
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      notificationId: { type: 'string', format: 'uuid', description: 'Notification ID' },
    },
    required: ['orgId', 'appId', 'notificationId'],
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
      orgId: { type: 'string', description: 'Organization ID' },
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
    },
    required: ['orgId', 'appId'],
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
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', description: 'Organization ID' },
    },
    required: ['orgId'],
  },
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
            id: { type: 'string', format: 'uuid', description: 'Notification ID' },
            status: {
              type: 'string',
              enum: ['PENDING', 'DELIVERED', 'FAILED', 'BOUNCED', 'SENT'],
              description: 'Current notification status',
            },
            recipient: { type: 'string', description: 'Recipient email, phone, or user ID' },
            channel: {
              type: 'string',
              enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WHATSAPP'],
              description: 'Notification channel',
            },
            sentAt: { type: ['string', 'null'], format: 'date-time', description: 'When notification was sent' },
            createdAt: { type: ['string', 'null'], format: 'date-time', description: 'When notification was created' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
};
