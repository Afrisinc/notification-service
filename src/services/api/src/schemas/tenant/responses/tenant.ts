/**
 * Tenant response body schema
 */

export const tenantResponseSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Tenant ID',
    },
    code: {
      type: 'string',
      description: 'Unique tenant code',
    },
    name: {
      type: 'string',
      description: 'Tenant display name',
    },
    account_id: {
      type: 'string',
      description: 'Account ID from external system',
    },
    account_type: {
      type: 'string',
      enum: ['INDIVIDUAL', 'ORGANIZATION'],
      description: 'Account type from external system',
    },
    status: {
      type: 'string',
      enum: ['ACTIVE', 'SUSPENDED'],
      description: 'Tenant status',
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
};

export const createTenantResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    resp_msg: { type: 'string' },
    resp_code: { type: 'number' },
  },
};

export const getTenantResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    resp_msg: { type: 'string' },
    resp_code: { type: 'number' },
    data: tenantResponseSchema,
  },
};

export const listTenantsResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    resp_msg: { type: 'string' },
    resp_code: { type: 'number' },
    data: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              code: { type: 'string' },
              name: { type: 'string' },
              account_id: { type: 'string' },
              account_type: { type: 'string', enum: ['INDIVIDUAL', 'ORGANIZATION'] },
              status: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              apiKeysCount: { type: 'integer' },
              templatesCount: { type: 'integer' },
              notificationsCount: { type: 'integer' },
            },
            required: [
              'id',
              'code',
              'name',
              'account_id',
              'account_type',
              'status',
              'apiKeysCount',
              'templatesCount',
              'notificationsCount',
            ],
          },
        },
        meta: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            total: { type: 'integer' },
          },
          required: ['limit', 'offset', 'total'],
        },
      },
      required: ['data', 'meta'],
    },
  },
};

export const updateTenantResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    resp_msg: { type: 'string' },
    resp_code: { type: 'number' },
    data: tenantResponseSchema,
  },
};
