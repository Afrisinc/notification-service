/**
 * Schema for POST /notify/send endpoint
 * Send a single notification using template ID
 *
 * ⚠️  IMPORTANT: Template ID Format
 * The templateId field must be a valid UUID (universally unique identifier)
 * This refers to the specific template instance installed on the app
 *
 * Why Template ID instead of Code?
 * - Better tracking: Know exactly which template version was used
 * - Analytics: Track per-template usage and performance
 * - Multi-language: Same code can have multiple language versions (different IDs)
 * - Versioning: Track which template version sent the notification
 *
 * Example templateId: 'ee62bf5a-f672-444c-93a0-8d1620e69731'
 */

export const sendNotificationRequestBody = {
  type: 'object',
  description: 'Request to send a single notification',
  required: ['channel', 'recipient', 'app_id', 'payload'],
  properties: {
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'],
      description: 'Notification channel',
    },
    recipient: {
      type: 'string',
      minLength: 1,
      description: 'Recipient email, phone number, or user ID',
    },
    templateId: {
      type: 'string',
      format: 'uuid',
      description:
        'Template ID (UUID) - the specific template instance to use. Provides better tracking and analytics for app notification usage',
    },
    app_id: {
      type: 'string',
      format: 'uuid',
      description:
        'App/Product ID - Required for tracking which app sent the notification for professional usage analytics',
    },
    payload: {
      type: 'object',
      description: 'Dynamic variables for template interpolation',
    },
    priority: {
      type: 'string',
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
      description: 'Notification priority level',
    },
  },
};

export const sendNotificationResponseBody = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique notification identifier',
    },
    status: {
      type: 'string',
      enum: ['PENDING', 'QUEUED', 'SENT', 'FAILED'],
      description: 'Current notification status',
    },
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'],
      description: 'Notification channel',
    },
    created_at: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp when notification was created',
    },
  },
  required: ['id', 'status', 'channel', 'created_at'],
};

export const sendNotificationSchema = {
  description: 'Send a single notification',
  tags: ['Notifications'],
  body: sendNotificationRequestBody,
  response: {
    202: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: sendNotificationResponseBody,
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
    401: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};

/**
 * Schema for POST /notify/send-with-key endpoint
 * Send notification using API key instead of JWT token
 * App ID is automatically extracted from the API key
 */
export const sendNotificationWithKeyRequestBody = {
  type: 'object',
  description: 'Request to send notification with API key',
  required: ['channel', 'recipient', 'templateId', 'payload'],
  properties: {
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'],
      description: 'Notification channel',
    },
    recipient: {
      type: 'string',
      minLength: 1,
      description: 'Recipient email, phone number, or user ID',
    },
    templateId: {
      type: 'string',
      format: 'uuid',
      description: 'Template ID (UUID) - the specific template instance to use',
    },
    payload: {
      type: 'object',
      description: 'Dynamic variables for template interpolation',
    },
    priority: {
      type: 'string',
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
      description: 'Notification priority level',
    },
  },
};

export const sendNotificationWithKeySchema = {
  description: 'Send notification using API key (app_id extracted from key)',
  tags: ['Notifications'],
  body: sendNotificationWithKeyRequestBody,
  response: {
    202: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: sendNotificationResponseBody,
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
    401: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};
