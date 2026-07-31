/**
 * Payment API Schemas
 */

const pendingTransaction = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    accountId: { type: 'string' },
    type: { type: 'string', enum: ['topup', 'deduction', 'bonus', 'refund', 'subscription'] },
    status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED'] },
    amount: { type: 'number' },
    balanceAfter: { type: 'number' },
    description: { type: ['string', 'null'] },
    paymentRef: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
  },
};

export const InitializePaymentSchema = {
  description: 'Initialize a payment (PAYG top-up, subscription, or template purchase) via card or mobile money',
  tags: ['Payments'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['type', 'method'],
    properties: {
      type: {
        type: 'string',
        enum: ['payg_topup', 'subscription', 'template_purchase'],
        description: 'What the payment is for',
      },
      method: { type: 'string', enum: ['card', 'mobile'], description: 'Payment method' },
      amount: { type: 'number', minimum: 0.5, description: 'Amount in specified currency (required for payg_topup)' },
      currency: {
        type: 'string',
        enum: ['USD', 'RWF'],
        default: 'USD',
        description: 'Payment currency (USD auto-converts to RWF, RWF is used as-is)',
      },
      email: { type: 'string', description: 'Payer email (required for card)' },
      phoneNumber: { type: 'string', description: 'Payer phone (required for mobile)' },
      customerName: { type: 'string' },
      planId: { type: 'string', description: 'Plan ID (required for subscription)' },
      billingCycle: { type: 'string', enum: ['monthly', 'yearly'], default: 'monthly' },
      templateId: { type: 'string', description: 'Template ID (required for template_purchase)' },
      appId: { type: 'string', description: 'App ID to install template into (required for template_purchase)' },
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
            transaction: pendingTransaction,
            orderId: { type: 'string' },
            amountUSD: { type: 'number' },
            amountRWF: { type: 'number' },
            method: { type: 'string', enum: ['card', 'mobile'] },
            checkoutUrl: { type: 'string' },
            pcode: { type: 'string' },
            paymentRef: { type: 'string' },
            message: { type: 'string' },
          },
        },
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
  },
};

export const GetPaymentStatusSchema = {
  description:
    'Get payment status by reference from Payment Service. Unified endpoint for checking transaction status.',
  tags: ['Payments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['ref'],
    properties: {
      ref: {
        type: 'string',
        description: 'Payment reference (from payment service)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        resp_msg: { type: 'string', example: 'Payment status retrieved successfully' },
        resp_code: { type: 'number', example: 1000 },
        data: {
          type: 'object',
          properties: {
            transaction_id: { type: 'string', description: 'UUID of the transaction' },
            status: {
              type: 'string',
              enum: ['PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED'],
              description: 'Current payment status',
            },
            amount: { type: 'number', description: 'Payment amount in minor units' },
          },
        },
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
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
    503: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};
