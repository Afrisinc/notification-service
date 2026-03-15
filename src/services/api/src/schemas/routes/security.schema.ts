import { ErrorResponseSchema } from '../responses/common.schema';

export const GetLoginEventsSchema = {
  tags: ['security'],
  summary: 'Get login events',
  description:
    'Returns combined login events and failures with support for pagination, date sorting, and search by name, phone, or IP address',
  querystring: {
    type: 'object',
    properties: {
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
        description: 'Page number for pagination',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 10,
        description: 'Number of records per page',
      },
      search: {
        type: 'string',
        description: 'Search by user name (first/last), phone number, or IP address',
      },
      sortBy: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc',
        description: 'Sort by date - "asc" for oldest first, "desc" for newest first',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        resp_msg: { type: 'string', example: 'Login events retrieved successfully' },
        resp_code: { type: 'integer', example: 1000 },
        data: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'event-123' },
                  type: { type: 'string', enum: ['login_event', 'login_failure'], example: 'login_event' },
                  userId: { type: 'string', example: 'user-456' },
                  email: { type: 'string', example: 'user@example.com' },
                  name: { type: 'string', example: 'John Doe' },
                  phone: { type: 'string', example: '1234567890' },
                  status: { type: 'string', example: 'success' },
                  ip: { type: 'string', example: '192.168.1.100' },
                  reason: { type: 'string', example: 'Invalid password' },
                  createdAt: { type: 'string', format: 'date-time', example: '2026-02-26T10:30:00.000Z' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 10 },
                total: { type: 'integer', example: 50 },
                pages: { type: 'integer', example: 5 },
              },
            },
          },
        },
      },
    },
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
} as const;

export const GetSecurityOverviewSchema = {
  tags: ['security'],
  summary: 'Get security overview',
  description:
    'Returns comprehensive security monitoring data including failed login attempts, top attacking IPs, token issuance counts, and suspicious activity status',
  querystring: {
    type: 'object',
    properties: {
      range: {
        type: 'string',
        enum: ['24h', '7d', '30d'],
        default: '24h',
        description: 'Time range for failed logins - "24h", "7d", "30d"',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 5,
        description: 'Number of top IPs to return',
      },
      failed_login_limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 10,
        description: 'Number of failed login records to return',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        resp_msg: { type: 'string', example: 'Security overview retrieved successfully' },
        resp_code: { type: 'integer', example: 1000 },
        data: {
          type: 'object',
          properties: {
            failedLogins24h: {
              type: 'integer',
              description: 'Count of failed login attempts in the specified range',
              example: 47,
            },
            tokenIssuanceCount: {
              type: 'integer',
              description: 'Total number of tokens issued',
              example: 1284,
            },
            suspiciousActivity: {
              type: 'boolean',
              description: 'Whether suspicious activity has been detected',
              example: true,
            },
            topIPs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ip: { type: 'string', example: '192.168.1.105' },
                  attempts: { type: 'integer', example: 12 },
                },
              },
              description: 'Array of top IP addresses with failed login attempts',
            },
            failedLogins: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'fl-001' },
                  email: { type: 'string', example: 'user@example.com' },
                  ip: { type: 'string', example: '192.168.1.105' },
                  timestamp: { type: 'string', format: 'date-time', example: '2026-02-22T10:30:00.000Z' },
                  reason: {
                    type: 'string',
                    enum: ['Invalid password', 'Account locked', 'MFA failed', 'Expired token'],
                    example: 'Invalid password',
                  },
                },
              },
              description: 'Array of recent failed login records',
            },
          },
        },
      },
    },
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
} as const;
