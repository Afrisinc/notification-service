import { paginationMeta } from '../common/pagination';

const clientItem = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    plan: { type: 'string', enum: ['FREE', 'STARTER', 'SCALE', 'ENTERPRISE', 'PAYG'] },
    email: { type: 'string' },
    sent: { type: 'string' },
    deliveryRate: { type: 'string' },
    templates: { type: 'number' },
    status: { type: 'string', enum: ['active', 'suspended', 'trial'] },
    joined: { type: 'string' },
    channels: { type: 'array', items: { type: 'string' } },
    organizationName: { type: 'string' },
    organizationType: { type: 'string' },
  },
};

export const GetClientsSchema = {
  description: 'List all clients for control dashboard with pagination and search',
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
        description: 'Search by client name or email',
      },
      status: {
        type: 'string',
        enum: ['active', 'suspended', 'trial'],
        description: 'Filter by account status',
      },
      plan: {
        type: 'string',
        enum: ['FREE', 'STARTER', 'SCALE', 'ENTERPRISE', 'PAYG'],
        description: 'Filter by subscription plan',
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
          items: clientItem,
        },
        meta: paginationMeta,
      },
    },
    401: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};
