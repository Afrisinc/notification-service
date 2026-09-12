/**
 * Admin Notifications Schema Definitions
 * JSON Schema for the platform admin notifications list/stats endpoints
 */

import { ErrorResponseSchema } from '../responses/common.schema';
import { paginationMeta } from '../common/pagination';
import { dateRangeQueryProperties, rangeResponseProperties } from '../common/date-range';

const notificationItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    client: { type: 'string' },
    to: { type: 'string' },
    template: { type: 'string' },
    channel: { type: 'string', enum: ['email', 'sms', 'push', 'in-app', 'whatsapp'] },
    status: { type: 'string', enum: ['delivered', 'failed', 'pending'] },
    latency: { type: 'string' },
    time: { type: 'string' },
  },
};

export const GetAdminNotificationsSchema = {
  description: 'List all notifications for the control dashboard with pagination, search, date range, and filters',
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
        description: 'Search by client name, recipient, or template',
      },
      channel: {
        type: 'string',
        enum: ['email', 'sms', 'push', 'in-app', 'whatsapp'],
        description: 'Filter by channel',
      },
      status: {
        type: 'string',
        enum: ['delivered', 'failed', 'pending'],
        description: 'Filter by delivery status',
      },
      ...dateRangeQueryProperties,
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
          items: notificationItemSchema,
        },
        meta: {
          type: 'object',
          properties: {
            ...paginationMeta.properties,
            ...rangeResponseProperties,
          },
          required: [...paginationMeta.required, 'rangeStart', 'rangeEnd'],
        },
      },
    },
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};

export const GetAdminNotificationStatsSchema = {
  description: 'Get notification counts by status for the control dashboard over a given date range',
  tags: ['Control Dashboard'],
  querystring: {
    type: 'object',
    properties: dateRangeQueryProperties,
  },
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
            totalSent: { type: 'integer' },
            delivered: { type: 'integer' },
            failed: { type: 'integer' },
            pending: { type: 'integer' },
            ...rangeResponseProperties,
          },
          required: ['totalSent', 'delivered', 'failed', 'pending', 'rangeStart', 'rangeEnd'],
        },
      },
    },
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};
