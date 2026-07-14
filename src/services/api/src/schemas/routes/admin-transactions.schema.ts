/**
 * Admin Credit Transactions Schema
 * Schemas for admin endpoint that tracks credit transactions across all accounts
 * Used by support team to debug payment issues and monitor financial activity
 */

export const GetCreditTransactionsSchema = {
  description: 'Retrieve all credit transactions across all accounts (admin only)',
  tags: ['admin', 'transactions'],
  querystring: {
    type: 'object',
    properties: {
      // Pagination
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
        description: 'Page number for pagination',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 50,
        description: 'Number of records per page (max 100)',
      },

      // Filtering - Account
      accountId: {
        type: 'string',
        description: 'Filter by specific account ID (UUID)',
      },

      // Filtering - Transaction Type
      type: {
        type: 'string',
        description:
          'Filter by transaction type (comma-separated: topup, deduction, bonus, refund). Example: topup,bonus',
      },

      // Filtering - Channel
      channel: {
        type: 'string',
        description: 'Filter by notification channel (comma-separated: EMAIL, SMS, PUSH, IN_APP). Example: EMAIL,SMS',
      },

      // Filtering - Date Range
      dateFrom: {
        type: 'string',
        format: 'date-time',
        description: 'Filter transactions from this date (ISO 8601 format). Example: 2026-07-01T00:00:00Z',
      },
      dateTo: {
        type: 'string',
        format: 'date-time',
        description: 'Filter transactions until this date (ISO 8601 format). Example: 2026-07-14T23:59:59Z',
      },

      // Filtering - Amount Range
      minAmount: {
        type: 'number',
        description: 'Filter transactions with amount >= minAmount (USD)',
      },
      maxAmount: {
        type: 'number',
        description: 'Filter transactions with amount <= maxAmount (USD)',
      },

      // Search
      search: {
        type: 'string',
        description: 'Search by payment reference or account email. Example: MOCK-1234567890 or user@example.com',
      },

      // Sorting
      sortBy: {
        type: 'string',
        enum: ['created_at', 'amount', 'balance_after'],
        default: 'created_at',
        description: 'Field to sort by',
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc',
        description: 'Sort order (ascending or descending)',
      },
    },
  },
};
