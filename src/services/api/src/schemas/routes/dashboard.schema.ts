/**
 * Dashboard Schema Definitions
 * JSON Schema for dashboard endpoint validation
 */

import { ErrorResponseSchema } from '../responses/common.schema';

// ============= Shared Schema Components =============

const statCardSchema = {
  type: 'object',
  properties: {
    value: { type: 'string', description: 'Pre-formatted display value' },
    label: { type: 'string', description: 'Stat card title' },
    sub: { type: 'string', description: 'Subtitle/period description' },
    trend: { type: ['string', 'null'], description: 'Change indicator (e.g., "12.4%")' },
    trendUp: { type: ['boolean', 'null'], description: 'true = increase, false = decrease' },
    icon: { type: 'string', enum: ['send', 'check', 'users', 'layers'], description: 'Icon name' },
  },
  required: ['value', 'label', 'sub', 'icon'],
};

const statsSchema = {
  type: 'object',
  properties: {
    messagesSent: statCardSchema,
    deliveryRate: statCardSchema,
    activeClients: statCardSchema,
    templates: statCardSchema,
  },
  required: ['messagesSent', 'deliveryRate', 'activeClients', 'templates'],
};

const notificationVolumeItemSchema = {
  type: 'object',
  properties: {
    day: { type: 'string', description: 'Day abbreviation' },
    email: { type: 'number', description: 'Email count for the day' },
    sms: { type: 'number', description: 'SMS count for the day' },
    push: { type: 'number', description: 'Push count for the day' },
  },
  required: ['day', 'email', 'sms', 'push'],
};

const channelBreakdownItemSchema = {
  type: 'object',
  properties: {
    label: { type: 'string', description: 'Channel display name' },
    value: { type: 'number', description: 'Percentage (0-100)' },
    color: { type: 'string', description: 'Hex color code (e.g., #0293E4)' },
  },
  required: ['label', 'value', 'color'],
};

const recentActivityItemSchema = {
  type: 'object',
  properties: {
    client: { type: 'string', description: 'Client name' },
    channel: { type: 'string', enum: ['email', 'sms', 'push', 'in-app'], description: 'Notification channel' },
    count: { type: 'number', description: 'Number of notifications sent' },
    status: { type: 'string', enum: ['delivered', 'failed', 'pending'], description: 'Delivery status' },
    time: { type: 'string', description: 'Relative time (e.g., "2 min ago")' },
  },
  required: ['client', 'channel', 'count', 'status', 'time'],
};

const systemHealthItemSchema = {
  type: 'object',
  properties: {
    label: { type: 'string', description: 'Service name' },
    status: { type: 'string', description: 'Status text (e.g., "Operational")' },
    ok: { type: 'boolean', description: 'true = healthy, false = degraded/outage' },
  },
  required: ['label', 'status', 'ok'],
};

const systemStatusOverallSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['operational', 'degraded', 'outage'], description: 'Overall status' },
    message: { type: 'string', description: 'Status message' },
  },
  required: ['status', 'message'],
};

// ============= GET /dashboard =============

export const GetDashboardSchema = {
  tags: ['Dashboard'],
  summary: 'Get dashboard overview',
  description: 'Retrieves all dashboard data in a single request',
  querystring: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        enum: ['24h', '7d', '30d', '90d'],
        default: '7d',
        description: 'Time period for data aggregation',
      },
      timezone: {
        type: 'string',
        default: 'UTC',
        description: 'IANA timezone (e.g., America/New_York)',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        resp_msg: { type: 'string', example: 'Dashboard data retrieved successfully' },
        resp_code: { type: 'number', example: 1000 },
        data: {
          type: 'object',
          properties: {
            stats: statsSchema,
            notificationVolume: {
              type: 'array',
              items: notificationVolumeItemSchema,
            },
            channelBreakdown: {
              type: 'array',
              items: channelBreakdownItemSchema,
            },
            peakSendTime: { type: 'string', description: 'Peak send time description' },
            recentActivity: {
              type: 'array',
              items: recentActivityItemSchema,
            },
            systemHealth: {
              type: 'array',
              items: systemHealthItemSchema,
            },
            systemStatusOverall: systemStatusOverallSchema,
          },
          required: [
            'stats',
            'notificationVolume',
            'channelBreakdown',
            'peakSendTime',
            'recentActivity',
            'systemHealth',
            'systemStatusOverall',
          ],
        },
        meta: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', format: 'date-time' },
            period: { type: 'string', enum: ['24h', '7d', '30d', '90d'] },
            timezone: { type: 'string' },
          },
          required: ['generatedAt', 'period', 'timezone'],
        },
      },
      required: ['success', 'resp_msg', 'resp_code', 'data', 'meta'],
    },
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    403: ErrorResponseSchema,
    429: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
} as const;

// ============= GET /dashboard/stats =============

export const GetDashboardStatsSchema = {
  tags: ['Dashboard'],
  summary: 'Get dashboard stats',
  description: 'Retrieves only stats cards. Use for real-time polling.',
  querystring: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        enum: ['24h', '7d', '30d', '90d'],
        default: '7d',
        description: 'Time period for data aggregation',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        resp_msg: { type: 'string', example: 'Dashboard stats retrieved successfully' },
        resp_code: { type: 'number', example: 1000 },
        data: statsSchema,
        meta: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', format: 'date-time' },
            period: { type: 'string', enum: ['24h', '7d', '30d', '90d'] },
          },
          required: ['generatedAt', 'period'],
        },
      },
      required: ['success', 'resp_msg', 'resp_code', 'data', 'meta'],
    },
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    403: ErrorResponseSchema,
    429: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
} as const;

// ============= GET /dashboard/recent-sends =============

export const GetRecentSendsSchema = {
  tags: ['Dashboard'],
  summary: 'Get recent sends',
  description: 'Retrieves recent notification activity with pagination',
  querystring: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 10,
        description: 'Number of items to return (max: 50)',
      },
      offset: {
        type: 'integer',
        minimum: 0,
        default: 0,
        description: 'Pagination offset',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        resp_msg: { type: 'string', example: 'Recent sends retrieved successfully' },
        resp_code: { type: 'number', example: 1000 },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: recentActivityItemSchema,
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'integer', description: 'Total number of items' },
                limit: { type: 'integer', description: 'Items per page' },
                offset: { type: 'integer', description: 'Current offset' },
                hasMore: { type: 'boolean', description: 'Whether more items exist' },
              },
              required: ['total', 'limit', 'offset', 'hasMore'],
            },
          },
          required: ['items', 'pagination'],
        },
        meta: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['generatedAt'],
        },
      },
      required: ['success', 'resp_msg', 'resp_code', 'data', 'meta'],
    },
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    403: ErrorResponseSchema,
    429: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
} as const;
