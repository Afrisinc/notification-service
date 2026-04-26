import { standardErrorResponses } from '../common/error-responses';

export const GetAppOverviewSchema = {
  description: 'Get application overview with stats and chart data',
  tags: ['Apps', 'Analytics'],
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', description: 'Organization ID' },
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
    },
    required: ['orgId', 'appId'],
  },
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string', format: 'date-time', description: 'Filter start date (ISO 8601)' },
      endDate: { type: 'string', format: 'date-time', description: 'Filter end date (ISO 8601)' },
      channels: { type: 'string', description: 'Comma-separated channels to filter (EMAIL,SMS,PUSH,IN_APP,WHATSAPP)' },
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
          type: 'object',
          properties: {
            appId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            environment: { type: 'string', enum: ['development', 'staging', 'production'] },
            stats: {
              type: 'object',
              properties: {
                totalNotificationsSent: { type: 'integer' },
                totalTemplates: { type: 'integer' },
                totalApiKeys: { type: 'integer' },
                activeApiKeys: { type: 'integer' },
              },
            },
            chartData: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  email: { type: 'integer' },
                  sms: { type: 'integer' },
                  push: { type: 'integer' },
                  inApp: { type: 'integer' },
                },
              },
            },
            recentActivity: {
              type: 'object',
              properties: {
                totalToday: { type: 'integer' },
                totalThisWeek: { type: 'integer' },
                totalThisMonth: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};
