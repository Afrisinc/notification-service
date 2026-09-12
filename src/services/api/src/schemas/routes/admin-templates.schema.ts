/**
 * Admin Templates Schema Definitions
 * JSON Schema for the platform admin templates list/stats endpoints
 */

import { ErrorResponseSchema } from '../responses/common.schema';
import { paginationMeta } from '../common/pagination';

const templateItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    client: { type: 'string' },
    channel: { type: 'string', enum: ['email', 'sms', 'push', 'in-app', 'whatsapp'] },
    status: { type: 'string', enum: ['active', 'draft'] },
    tags: { type: 'array', items: { type: 'string' } },
    uses: { type: 'integer' },
    updated: { type: 'string' },
  },
};

export const GetAdminTemplatesSchema = {
  description: 'List all templates for the control dashboard with pagination, search, and filters',
  tags: ['Control Dashboard'],
  querystring: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        description: 'Items per page (max 100)',
        default: 20,
        maximum: 100,
        minimum: 1,
      },
      offset: {
        type: 'integer',
        description: 'Items to skip',
        default: 0,
        minimum: 0,
      },
      search: {
        type: 'string',
        description: 'Search by template name or client name',
      },
      channel: {
        type: 'string',
        enum: ['email', 'sms', 'push', 'in-app', 'whatsapp'],
        description: 'Filter by channel',
      },
      status: {
        type: 'string',
        enum: ['active', 'draft'],
        description: 'Filter by template status',
      },
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
          type: 'array',
          items: templateItemSchema,
        },
        meta: paginationMeta,
      },
    },
    401: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

export const GetAdminTemplateStatsSchema = {
  description: 'Get template counts (total/active/drafts) for the control dashboard',
  tags: ['Control Dashboard'],
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
            total: { type: 'integer' },
            active: { type: 'integer' },
            drafts: { type: 'integer' },
          },
          required: ['total', 'active', 'drafts'],
        },
      },
    },
    401: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};
