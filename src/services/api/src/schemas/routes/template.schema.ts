/**
 * Template route schemas - combines request/response for Fastify routes
 */

import {
  createTemplateRequestBody,
  createTemplateResponseBody,
  templateListQueryParams,
  templateListResponseBody,
  templateListItem,
  templateResponseBody,
  updateTemplateRequestBody,
} from '../template';
import { createVersionSchema, activateVersionSchema } from '../template/version';
import { previewTemplateSchema } from '../template/preview';
import { templateHeaders } from '../common';

// Template operations

export const CreateTemplateRouteSchema = {
  description: 'Create a new notification template',
  tags: ['Templates'],
  headers: templateHeaders,
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
  },
};

export const ListTemplatesRouteSchema = {
  description: 'List templates with filtering and pagination',
  tags: ['Templates'],
  headers: templateHeaders,
  querystring: templateListQueryParams,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'array',
          items: templateListItem,
          description: 'List of templates',
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
    },
  },
};

export const GetAllTemplatesRouteSchema = {
  description: 'Get all templates without pagination',
  tags: ['Templates'],
  headers: templateHeaders,
  querystring: {
    type: 'object',
    description: 'Optional filters',
    properties: {
      channel: {
        type: 'string',
        enum: ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP', 'all'],
        description: 'Filter by notification channel',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid', description: 'Template ID' },
              slug: { type: 'string', description: 'Template slug' },
              name: { type: 'string', description: 'Template name' },
              description: { type: 'string', description: 'Template description' },
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
              author: { type: 'string', description: 'Template author' },
              isFree: { type: 'boolean', description: 'Whether template is free' },
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
              subject: { type: 'string', description: 'Template subject' },
              content: { description: 'Template content' },
              language: { type: 'string', description: 'Template language' },
              version: { type: 'number', description: 'Template version' },
              active: { type: 'boolean', description: 'Whether template is active' },
              createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
              updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
            },
          },
          description: 'List of all templates',
        },
        meta: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              description: 'Total number of templates returned',
            },
          },
        },
      },
    },
  },
};

export const GetTemplateRouteSchema = {
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
  },
};

export const UpdateTemplateRouteSchema = {
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
  },
};

export const DeleteTemplateRouteSchema = {
  description: 'Delete a template',
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
    204: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};

// Template versioning operations
export const CreateVersionRouteSchema = createVersionSchema;
export const ActivateVersionRouteSchema = activateVersionSchema;

// Template preview operation
export const PreviewTemplateRouteSchema = previewTemplateSchema;
