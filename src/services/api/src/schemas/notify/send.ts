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

const attachmentSchema = {
  type: 'object',
  description: 'File attachment for email notifications',
  required: ['filename'],
  properties: {
    filename: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'Name of the file (e.g., invoice.pdf)',
    },
    url: {
      type: 'string',
      format: 'uri',
      description: 'URL to fetch the file from (HTTPS required)',
    },
    content: {
      type: 'string',
      description: 'Base64 encoded file content',
    },
    contentType: {
      type: 'string',
      description: 'MIME type (e.g., application/pdf). Auto-detected if not provided',
    },
  },
};

export const sendNotificationRequestBody = {
  type: 'object',
  description:
    'Request to send a single notification. app_id is required when using JWT auth; omit when using an API key (app is derived from the key).',
  required: ['channel', 'recipient', 'payload'],
  properties: {
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'],
      description: 'Notification channel (accepts lowercase or uppercase, will be normalized to uppercase)',
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
        'Template ID (UUID) - the specific template instance to use. Must be a valid UUID format (e.g., "550e8400-e29b-41d4-a716-446655440000"). Provides better tracking and analytics for app notification usage',
    },
    app_id: {
      type: 'string',
      format: 'uuid',
      description:
        'App/Product ID - Required for tracking which app sent the notification for professional usage analytics. Must be a valid UUID format',
    },
    payload: {
      type: 'object',
      description:
        'Dynamic variables for template interpolation. When using templateId, payload is optional with any variables the template needs. When no templateId is provided, payload MUST contain a "message" field',
    },
    priority: {
      type: 'string',
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
      description: 'Notification priority level',
    },
    attachments: {
      type: 'array',
      maxItems: 10,
      description: 'File attachments for EMAIL channel (max 10 files, 10MB total)',
      items: attachmentSchema,
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
