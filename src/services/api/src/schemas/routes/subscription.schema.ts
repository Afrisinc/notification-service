/**
 * Subscription route schemas
 */

export const GetSubscriptionDetailsSchema = {
  description: 'Get current subscription details and usage',
  tags: ['Subscriptions'],
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
            plan: { type: 'string' },
            status: { type: 'string' },
            billingCycle: { type: 'string' },
            provider: { type: 'string' },
            limits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  metric: { type: 'string' },
                  limit: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
                  used: { type: 'integer' },
                  remaining: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
                  percentage: { type: 'number' },
                  period: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const GetPlansSchema = {
  description: 'Get all available subscription plans',
  tags: ['Subscriptions'],
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
              name: { type: 'string' },
              priceMonthly: { type: 'number' },
              priceYearly: { type: 'number' },
              limits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    metric: { type: 'string' },
                    limit: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
                    period: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
          },
        },
      },
    },
  },
};

export const ChangePlanSchema = {
  description: 'Change subscription plan',
  tags: ['Subscriptions'],
  body: {
    type: 'object',
    required: ['planId'],
    properties: {
      planId: {
        type: 'string',
        description: 'ID of the plan to upgrade/downgrade to',
      },
    },
  },
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
            plan: { type: 'string' },
          },
        },
      },
    },
  },
};

export const CancelSubscriptionSchema = {
  description: 'Cancel subscription',
  tags: ['Subscriptions'],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};

export const PauseSubscriptionSchema = {
  description: 'Pause subscription',
  tags: ['Subscriptions'],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};

export const ResumeSubscriptionSchema = {
  description: 'Resume subscription',
  tags: ['Subscriptions'],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};
