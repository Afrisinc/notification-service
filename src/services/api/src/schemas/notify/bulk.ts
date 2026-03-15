/**
 * Schema for POST /notify/bulk endpoint
 * Send multiple notifications in a single request
 */

import { sendNotificationRequestBody } from './send';

export const bulkNotificationRequestBody = {
  type: 'object',
  required: ['notifications'],
  properties: {
    notifications: {
      type: 'array',
      minItems: 1,
      maxItems: 1000,
      description: 'Array of notifications to send',
      items: sendNotificationRequestBody,
    },
  },
};

export const bulkNotificationResponseBody = {
  type: 'object',
  properties: {
    accepted: {
      type: 'integer',
      description: 'Number of notifications accepted',
    },
    rejected: {
      type: 'integer',
      description: 'Number of notifications rejected',
    },
    errors: {
      type: 'array',
      description: 'Details of rejected notifications (optional)',
      items: {
        type: 'object',
        properties: {
          index: {
            type: 'integer',
            description: 'Index of rejected notification in input array',
          },
          error: {
            type: 'string',
            description: 'Reason for rejection',
          },
        },
        required: ['index', 'error'],
      },
    },
  },
  required: ['accepted', 'rejected'],
};

export const bulkNotificationSchema = {
  description: 'Send multiple notifications in bulk',
  tags: ['Notifications'],
  body: bulkNotificationRequestBody,
  response: {
    202: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: bulkNotificationResponseBody,
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
    401: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};
