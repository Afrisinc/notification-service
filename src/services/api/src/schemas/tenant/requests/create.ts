/**
 * Create tenant request schema
 */

export const createTenantRequestSchema = {
  type: 'object',
  required: ['code', 'name', 'accountId', 'accountType'],
  properties: {
    code: {
      type: 'string',
      description: 'Unique tenant code (e.g., afrisinc-auth)',
      minLength: 3,
      maxLength: 50,
      pattern: '^[a-z0-9-]+$',
      examples: ['afrisinc-core', 'afrisinc-auth'],
    },
    name: {
      type: 'string',
      description: 'Tenant display name',
      minLength: 1,
      maxLength: 200,
      examples: ['Afrisinc Core', 'Afrisinc Auth Service'],
    },
    accountId: {
      type: 'string',
      description: 'Account ID from external system',
      minLength: 1,
      examples: ['acc-123456'],
    },
    accountType: {
      type: 'string',
      description: 'Account type from external system',
      enum: ['INDIVIDUAL', 'ORGANIZATION'],
      examples: ['INDIVIDUAL', 'ORGANIZATION'],
    },
  },
};
