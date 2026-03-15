/**
 * Schema for POST /templates/:id/versions endpoint
 * Create a new template version
 */

import { templateHeaders } from '../common';

export const createVersionRequestBody = {
  type: 'object',
  required: ['content'],
  properties: {
    subject: {
      type: 'string',
      description: 'Email subject (optional, only for EMAIL templates)',
    },
    content: {
      type: 'string',
      minLength: 1,
      description: 'Template content with {{variable}} placeholders',
    },
    createdBy: {
      type: 'string',
      description: 'Optional identifier of who created this version',
    },
  },
};

export const versionResponseBody = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique template version identifier',
    },
    version: {
      type: 'integer',
      description: 'Version number',
    },
    isActive: {
      type: 'boolean',
      description: 'Whether this version is currently active',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp when version was created',
    },
  },
  required: ['id', 'version', 'isActive', 'createdAt'],
};

export const createVersionSchema = {
  description: 'Create a new version of a template',
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
  body: createVersionRequestBody,
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: versionResponseBody,
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
 * Schema for POST /templates/:id/versions/:versionId/activate endpoint
 * Activate a specific version
 */

export const activateVersionSchema = {
  description: 'Activate a specific template version',
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
      versionId: {
        type: 'string',
        format: 'uuid',
        description: 'Template version ID to activate',
      },
    },
    required: ['id', 'versionId'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: versionResponseBody,
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
