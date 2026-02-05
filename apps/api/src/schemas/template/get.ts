/**
 * Schema for GET /templates/:id endpoint
 * Retrieve a specific template
 */

export const templateResponseBody = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique template identifier',
    },
    code: {
      type: 'string',
      description: 'Template code identifier',
    },
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP'],
      description: 'Notification channel',
    },
    subject: {
      type: 'string',
      description: 'Email subject (for EMAIL channel)',
    },
    content: {
      type: 'string',
      description: 'Template content with placeholders',
    },
    language: {
      type: 'string',
      description: 'Language code',
    },
    active: {
      type: 'boolean',
      description: 'Whether template is active',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'When template was created',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When template was last updated',
    },
  },
  required: ['id', 'code', 'channel', 'content', 'language', 'active', 'createdAt', 'updatedAt'],
};

export const getTemplateSchema = {
  description: 'Get a specific template by ID',
  tags: ['Templates'],
  params: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Template ID',
      },
    },
    required: ['id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: templateResponseBody,
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
