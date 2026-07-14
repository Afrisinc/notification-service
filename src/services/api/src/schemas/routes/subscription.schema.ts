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
    properties: {
      planId: { type: 'string', description: 'UUID of the plan' },
      planName: { type: 'string', description: 'Plan name: FREE, STARTER, SCALE, ENTERPRISE, PAYG' },
      billingCycle: { type: 'string', enum: ['monthly', 'yearly'] },
    },
    additionalProperties: false,
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

// ─── Card Payment Schemas ─────────────────────────────────────────────────────

const cardPaymentItem = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    ref: { type: 'string', description: 'Payment reference from ITEC PesaPal' },
    pcode: { type: 'string', description: 'Payment code for fallback polling' },
    checkoutUrl: { type: 'string', description: 'Redirect URL to PesaPal checkout' },
    orderId: { type: 'string' },
    amount: { type: 'number', description: 'Amount in RWF cents' },
    currency: { type: 'string', description: 'Currency (RWF)' },
    email: { type: 'string' },
    status: { type: 'string', description: 'Payment status (PENDING, SUCCESSFUL, FAILED)' },
    provider: { type: 'string', description: 'Payment provider (itec)' },
    validUntil: { type: 'string', description: 'Checkout URL expiration timestamp' },
    createdAt: { type: 'string' },
  },
};

export const InitSubscriptionPaymentSchema = {
  description:
    'Initiate card payment for subscription upgrade (PesaPal/ITEC). Amounts in USD are converted to RWF internally.',
  tags: ['Subscriptions', 'Card Payment'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['planId', 'billingCycle', 'customerEmail'],
    properties: {
      planId: {
        type: 'string',
        description: 'UUID of the subscription plan to upgrade to',
      },
      billingCycle: {
        type: 'string',
        enum: ['monthly', 'yearly'],
        description: 'Billing cycle: monthly or yearly',
      },
      customerEmail: {
        type: 'string',
        format: 'email',
        description: 'Customer email for PesaPal receipt and confirmation',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            checkoutUrl: { type: 'string', description: 'Redirect to PesaPal checkout' },
            pcode: { type: 'string', description: 'Payment code for fallback polling if webhook fails' },
            orderId: { type: 'string', description: 'Order ID (sub_accountId_planId_billingCycle_timestamp)' },
            amountUSD: { type: 'number', description: 'Plan price in USD' },
            planName: { type: 'string', description: 'Name of the subscription plan' },
            validUntil: { type: 'string', description: 'Checkout URL expiration timestamp' },
          },
        },
      },
    },
  },
};

export const CheckCardPaymentStatusSchema = {
  description: 'Check card payment status by PCODE (fallback polling when webhook delivery is delayed)',
  tags: ['Subscriptions', 'Card Payment'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['pcode'],
    properties: {
      pcode: { type: 'string', description: 'Payment code from card payment init response' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: cardPaymentItem,
      },
    },
  },
};
