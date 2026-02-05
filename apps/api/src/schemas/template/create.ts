/**
 * Schema for POST /templates endpoint
 * Create a new template
 */

export const createTemplateRequestBody = {
  type: 'object',
  required: ['code', 'channel', 'content', 'language'],
  properties: {
    code: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '^[A-Z_]+$',
      description: 'Unique template code (uppercase with underscores)',
    },
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP'],
      description: 'Notification channel this template is for',
    },
    subject: {
      type: 'string',
      description: 'Email subject (optional, required for EMAIL channel)',
    },
    content: {
      type: 'string',
      minLength: 1,
      description: 'Template content with {{variable}} placeholders',
    },
    language: {
      type: 'string',
      minLength: 2,
      maxLength: 5,
      description: 'Language code (ISO 639-1)',
    },
    description: {
      type: 'string',
      description: 'Optional template description',
    },
  },
};

export const createTemplateResponseBody = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique template identifier',
    },
    code: {
      type: 'string',
      description: 'Template code',
    },
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP'],
      description: 'Notification channel',
    },
    active: {
      type: 'boolean',
      description: 'Whether template is active',
    },
  },
  required: ['id', 'code', 'channel', 'active'],
};

export const createTemplateSchema = {
  description: 'Create a new notification template',
  tags: ['Templates'],
  body: createTemplateRequestBody,
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: createTemplateResponseBody,
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
    409: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};
