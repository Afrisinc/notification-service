/**
 * Shared date-range query/response schema fragments for admin endpoints
 * that accept a `period` preset (plus optional custom bounds) and echo
 * back the resolved range they actually queried.
 */

export const dateRangeQueryProperties = {
  period: {
    type: 'string',
    enum: ['today', 'yesterday', '7d', '30d', '90d', '6m', 'custom'],
    description: 'Date range preset. Defaults to "today". Use "custom" with dateFrom/dateTo.',
    default: 'today',
  },
  dateFrom: {
    type: 'string',
    format: 'date',
    description: 'Range start (YYYY-MM-DD). Required when period is "custom".',
  },
  dateTo: {
    type: 'string',
    format: 'date',
    description: 'Range end (YYYY-MM-DD). Required when period is "custom".',
  },
};

export const rangeResponseProperties = {
  rangeStart: { type: 'string', format: 'date-time', description: 'Resolved range start (ISO 8601, UTC)' },
  rangeEnd: { type: 'string', format: 'date-time', description: 'Resolved range end (ISO 8601, UTC)' },
};
