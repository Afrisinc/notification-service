/**
 * Schema for GET /templates/:id endpoint
 * Retrieve a specific template
 */

import { templateHeaders } from '../common';

export const templateResponseBody = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique template identifier',
    },
    slug: {
      type: 'string',
      description: 'Template slug (code)',
    },
    name: {
      type: 'string',
      description: 'Template name',
    },
    description: {
      type: 'string',
      description: 'Template description',
    },
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'],
      description: 'Notification channel',
    },
    category: {
      type: 'string',
      enum: ['AUTH', 'TRANSACTIONAL', 'MARKETING', 'NOTIFICATION'],
      description: 'Template category',
    },
    author: {
      type: 'string',
      description: 'Template author',
    },
    isFree: {
      type: 'boolean',
      description: 'Whether template is free',
    },
    variables: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          example: { type: 'string' },
          required: { type: 'boolean' },
        },
      },
      description: 'Template variables',
    },
    subject: {
      type: ['string', 'null'],
      description: 'Template subject (email only)',
    },
    content: {
      description: 'Template content with rendered HTML/text',
    },
    language: {
      type: 'string',
      description: 'Template language',
    },
    version: {
      type: 'number',
      description: 'Template version',
    },
    active: {
      type: 'boolean',
      description: 'Whether template is active',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'Creation timestamp',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'Last update timestamp',
    },
  },
  required: [
    'id',
    'slug',
    'name',
    'channel',
    'category',
    'author',
    'isFree',
    'variables',
    'content',
    'language',
    'version',
    'active',
    'createdAt',
    'updatedAt',
  ],
};

export const getTemplateSchema = {
  description: 'Get a specific template by ID',
  tags: ['Templates'],
  headers: templateHeaders,
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
