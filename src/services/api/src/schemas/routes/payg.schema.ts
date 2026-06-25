/**
 * PAYG (Pay-as-you-go) API Schemas
 */

const transactionItem = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    accountId: { type: 'string' },
    type: { type: 'string', enum: ['topup', 'deduction', 'bonus', 'refund'] },
    amount: { type: 'number' },
    balanceAfter: { type: 'number' },
    description: { type: ['string', 'null'] },
    channel: { type: ['string', 'null'] },
    notificationId: { type: ['string', 'null'] },
    paymentRef: { type: ['string', 'null'] },
    bonusPercent: { type: ['number', 'null'] },
    createdAt: { type: 'string' },
  },
};

export const GetBalanceSchema = {
  description: 'Get current PAYG credit balance',
  tags: ['PAYG'],
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
            accountId: { type: 'string' },
            balance: { type: 'number' },
            currency: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
      },
    },
  },
};

export const TopUpSchema = {
  description: 'Top up PAYG credit balance',
  tags: ['PAYG'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['amount'],
    properties: {
      amount: {
        type: 'number',
        minimum: 5,
        description: 'USD amount to add (min $5)',
      },
      paymentRef: {
        type: 'string',
        description: 'External payment reference (supplied by payment processor)',
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
            transaction: transactionItem,
            bonusTransaction: { ...transactionItem, nullable: true },
            newBalance: { type: 'number' },
            bonusPercent: { type: 'number' },
            bonusAmount: { type: 'number' },
          },
        },
      },
    },
  },
};

export const GetTransactionsSchema = {
  description: 'Get PAYG transaction history',
  tags: ['PAYG'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      type: { type: 'string', enum: ['topup', 'deduction', 'bonus', 'refund'] },
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
            items: { type: 'array', items: transactionItem },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            pages: { type: 'integer' },
          },
        },
      },
    },
  },
};

export const GetRatesSchema = {
  description: 'Get PAYG channel rates and top-up tiers',
  tags: ['PAYG'],
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
            rates: { type: 'object' },
            topUpTiers: { type: 'array' },
            minimumTopUp: { type: 'number' },
            currency: { type: 'string' },
            creditsExpire: { type: 'boolean' },
            note: { type: 'string' },
          },
        },
      },
    },
  },
};

export const CheckBalanceSchema = {
  description: 'Check if account has sufficient balance for a planned send',
  tags: ['PAYG'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    required: ['channel', 'quantity'],
    properties: {
      channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP'] },
      quantity: { type: 'integer', minimum: 1 },
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
            sufficient: { type: 'boolean' },
            required: { type: 'number' },
            available: { type: 'number' },
          },
        },
      },
    },
  },
};

// ─── Mobile Money Schemas ─────────────────────────────────────────────────────

const mobilePaymentItem = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    ref: { type: 'string', description: 'Paypack transaction reference' },
    orderId: { type: 'string' },
    amount: { type: 'number' },
    currency: { type: 'string' },
    phoneNumber: { type: 'string' },
    type: { type: 'string', enum: ['CASHIN', 'CASHOUT'] },
    status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED'] },
    fee: { type: 'number' },
    provider: { type: 'string', nullable: true },
    createdAt: { type: 'string' },
  },
};

export const MobileTopUpInitSchema = {
  description: 'Initiate mobile money payment (PAYG top-up or subscription)',
  tags: ['PAYG', 'Mobile Money'],
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['amount', 'phoneNumber'],
    properties: {
      amount: {
        type: 'number',
        minimum: 100,
        description: 'Amount in RWF (minimum 100 RWF)',
      },
      phoneNumber: {
        type: 'string',
        minLength: 9,
        maxLength: 15,
        description: 'Mobile money phone number (e.g., 0781234567 or 250781234567)',
      },
      customerName: {
        type: 'string',
        maxLength: 255,
        description: 'Customer name for reference',
      },
      paymentType: {
        type: 'string',
        enum: ['payg_topup', 'subscription'],
        default: 'payg_topup',
        description: 'Type of payment: payg_topup (default) or subscription',
      },
      planId: {
        type: 'string',
        description: 'Plan ID (required if paymentType is subscription)',
      },
      billingCycle: {
        type: 'string',
        enum: ['monthly', 'yearly'],
        default: 'monthly',
        description: 'Billing cycle (only for subscription payments)',
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
            payment: mobilePaymentItem,
            message: { type: 'string', description: 'Instructions for the user' },
          },
        },
      },
    },
  },
};

export const GetMobilePaymentSchema = {
  description: 'Get mobile payment status by ID',
  tags: ['PAYG', 'Mobile Money'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['paymentId'],
    properties: {
      paymentId: { type: 'string', description: 'Mobile payment ID' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: mobilePaymentItem,
      },
    },
  },
};

export const GetMobilePaymentByRefSchema = {
  description: 'Get mobile payment status by Paypack reference',
  tags: ['PAYG', 'Mobile Money'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['ref'],
    properties: {
      ref: { type: 'string', description: 'Paypack transaction reference' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: mobilePaymentItem,
      },
    },
  },
};
