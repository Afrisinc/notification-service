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
