import { ErrorResponseSchema } from '../responses/common.schema';

export const AnalyticsOverviewSchema = {
  tags: ['platform-analytics'],
  summary: 'Get platform analytics overview',
  description: 'Retrieve high-level statistics about users, accounts, and product enrollments',
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            total_users: { type: 'number' },
            total_accounts: { type: 'number' },
            total_organizations: { type: 'number' },
            total_enrollments: { type: 'number' },
            active_enrollments: { type: 'number' },
            suspended_enrollments: { type: 'number' },
            individual_accounts: { type: 'number' },
            organization_accounts: { type: 'number' },
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product_code: { type: 'string' },
                  total_enrollments: { type: 'number' },
                  active_enrollments: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    403: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
} as const;

export const AnalyticsUsersSchema = {
  tags: ['platform-analytics'],
  summary: 'Get user analytics',
  description: 'Retrieve user statistics including new users, verified users, and active users in a date range',
  querystring: {
    type: 'object',
    properties: {
      range: { type: 'string', description: 'Date range (30d, 7d, 90d, etc)' },
    },
  },
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        resp_msg: { type: 'string', example: 'User analytics retrieved successfully' },
        resp_code: { type: 'number', example: 1000 },
        data: {
          type: 'object',
          properties: {
            total_users: { type: 'number' },
            new_users_in_range: { type: 'number' },
            verified_users: { type: 'number' },
            suspended_users: { type: 'number' },
            active_users_in_range: { type: 'number' },
          },
        },
      },
    },
    403: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
} as const;

export const AnalyticsAccountsSchema = {
  tags: ['platform-analytics'],
  summary: 'Get account analytics',
  description: 'Retrieve account statistics including individual and organization accounts',
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        resp_msg: { type: 'string', example: 'Account analytics retrieved successfully' },
        resp_code: { type: 'number', example: 1000 },
        data: {
          type: 'object',
          properties: {
            total_accounts: { type: 'number' },
            individual_accounts: { type: 'number' },
            organization_accounts: { type: 'number' },
            new_accounts_30d: { type: 'number' },
            active_accounts_30d: { type: 'number' },
          },
        },
      },
    },
    403: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
} as const;

export const AnalyticsGrowthSchema = {
  tags: ['platform-analytics'],
  summary: 'Get growth metrics',
  description: 'Retrieve daily growth aggregation for users, accounts, and enrollments',
  querystring: {
    type: 'object',
    properties: {
      range: { type: 'string', description: 'Date range (30d, 7d, 90d, etc)' },
    },
  },
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        resp_msg: { type: 'string', example: 'Growth metrics retrieved successfully' },
        resp_code: { type: 'number', example: 1000 },
        data: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date' },
                  count: { type: 'number' },
                },
              },
            },
            accounts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date' },
                  count: { type: 'number' },
                },
              },
            },
            enrollments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date' },
                  count: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    403: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
} as const;

export const GetAllUsersSchema = {
  tags: ['platform-users'],
  summary: 'Get all users with details',
  description:
    'Retrieve all users with their accounts, organizations, and last activity timestamp with pagination support',
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1, description: 'Page number (default: 1)' },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 10,
        description: 'Items per page (default: 10, max: 100)',
      },
    },
  },
  security: [{ bearerAuth: [] }],
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
              id: { type: 'string' },
              email: { type: 'string', format: 'email' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              phone: { type: 'string' },
              emailVerified: { type: 'boolean' },
              lastActivity: { type: 'string', format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              accounts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string', enum: ['INDIVIDUAL', 'ORGANIZATION'] },
                    organization: { type: ['object', 'null'] },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer', description: 'Total number of users' },
            pages: { type: 'integer', description: 'Total number of pages' },
          },
        },
      },
    },
    401: ErrorResponseSchema,
    403: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
} as const;

export const GetUserByIdSchema = {
  tags: ['platform-users'],
  summary: 'Get user by ID',
  description: 'Retrieve a specific user with their accounts, organizations, and last activity timestamp',
  params: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User ID' },
    },
    required: ['userId'],
  },
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            emailVerified: { type: 'boolean' },
            lastActivity: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            accounts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string', enum: ['INDIVIDUAL', 'ORGANIZATION'] },
                  organization: { type: ['object', 'null'] },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    401: ErrorResponseSchema,
    403: ErrorResponseSchema,
    404: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
} as const;
