export const sendNotificationSchema = {
  type: 'object',
  required: ['channel', 'recipient', 'templateCode', 'payload'],
  properties: {
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP'],
      description: 'Notification channel',
    },
    recipient: {
      type: 'string',
      minLength: 1,
      description: 'Recipient email, phone number, or user ID',
    },
    templateCode: {
      type: 'string',
      minLength: 1,
      description: 'Template code to use for this notification',
    },
    payload: {
      type: 'object',
      description: 'Dynamic variables for template interpolation',
    },
    priority: {
      type: 'string',
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
      description: 'Notification priority',
    },
  },
};

export const sendNotificationResponseSchema = {
  type: 'object',
  properties: {
    notificationId: {
      type: 'string',
      format: 'uuid',
    },
    status: {
      type: 'string',
      enum: ['PENDING', 'QUEUED', 'SENT', 'FAILED'],
    },
  },
};

export const bulkNotificationSchema = {
  type: 'object',
  required: ['notifications'],
  properties: {
    notifications: {
      type: 'array',
      minItems: 1,
      maxItems: 1000,
      items: sendNotificationSchema,
    },
  },
};

export const bulkNotificationResponseSchema = {
  type: 'object',
  properties: {
    accepted: {
      type: 'integer',
    },
    rejected: {
      type: 'integer',
    },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          error: { type: 'string' },
        },
      },
    },
  },
};

export const notificationStatusResponseSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP'],
    },
    recipient: {
      type: 'string',
    },
    status: {
      type: 'string',
      enum: ['PENDING', 'QUEUED', 'SENT', 'FAILED'],
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
};

export const notificationListResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: notificationStatusResponseSchema,
    },
    meta: {
      type: 'object',
      properties: {
        limit: { type: 'integer' },
        offset: { type: 'integer' },
        total: { type: 'integer' },
      },
    },
  },
};
