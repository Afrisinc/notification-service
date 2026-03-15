/**
 * Schema for PUT /templates/:id endpoint
 * Update a template
 */

import { templateResponseBody } from './get';
import { templateHeaders } from '../common';

export const updateTemplateRequestBody = {
  type: 'object',
  properties: {
    subject: {
      type: 'string',
      description: 'Email subject (for EMAIL channel)',
    },
    content: {
      type: 'string',
      minLength: 1,
      description: 'Template content with {{variable}} placeholders',
    },
    active: {
      type: 'boolean',
      description: 'Whether template is active',
    },
  },
};

export const updateTemplateSchema = {
  description: 'Update a template',
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
  body: updateTemplateRequestBody,
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
