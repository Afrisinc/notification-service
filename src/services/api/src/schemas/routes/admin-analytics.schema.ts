/**
 * Admin Analytics Schema Definitions
 * JSON Schema for the platform admin analytics overview endpoint
 */

import { ErrorResponseSchema } from '../responses/common.schema';
import { dateRangeQueryProperties, rangeResponseProperties } from '../common/date-range';

const kpiSchema = {
  type: 'object',
  properties: {
    value: { type: 'string' },
    delta: { type: 'string' },
    deltaUp: { type: 'boolean' },
  },
  required: ['value', 'delta', 'deltaUp'],
};

export const GetAdminAnalyticsSchema = {
  description: 'Platform-wide analytics overview: KPIs, delivery volume, success rate, email engagement, top clients',
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
            kpis: {
              type: 'object',
              properties: {
                totalSent: kpiSchema,
                avgDeliveryRate: kpiSchema,
                avgOpenRate: kpiSchema,
                avgClickRate: kpiSchema,
              },
              required: ['totalSent', 'avgDeliveryRate', 'avgOpenRate', 'avgClickRate'],
            },
            deliveryVolume: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  delivered: { type: 'integer' },
                  failed: { type: 'integer' },
                  bounced: { type: 'integer' },
                },
                required: ['label', 'delivered', 'failed', 'bounced'],
              },
            },
            successRate: {
              type: 'object',
              properties: {
                delivered: { type: 'number' },
                failed: { type: 'number' },
                bounced: { type: 'number' },
              },
              required: ['delivered', 'failed', 'bounced'],
            },
            emailEngagement: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  opens: { type: 'number' },
                  clicks: { type: 'number' },
                  unsubscribes: { type: 'number' },
                },
                required: ['label', 'opens', 'clicks', 'unsubscribes'],
              },
            },
            topClients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  accountId: { type: 'string' },
                  name: { type: 'string' },
                  plan: { type: 'string' },
                  sent: { type: 'integer' },
                },
                required: ['accountId', 'name', 'plan', 'sent'],
              },
            },
            ...rangeResponseProperties,
          },
          required: [
            'kpis',
            'deliveryVolume',
            'successRate',
            'emailEngagement',
            'topClients',
            'rangeStart',
            'rangeEnd',
          ],
        },
      },
    },
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
    500: ErrorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
};
