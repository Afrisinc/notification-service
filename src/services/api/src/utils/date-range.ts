export type PeriodPreset = 'today' | 'yesterday' | '7d' | '30d' | '90d' | '6m' | 'custom';

export class InvalidDateRangeError extends Error {}

export interface ResolvedDateRange {
  dateFrom: Date;
  dateTo: Date;
}

const ROLLING_WINDOW_DAYS: Record<'7d' | '30d' | '90d' | '6m', number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '6m': 180,
};

/**
 * Resolves a period preset (plus optional custom bounds) into a concrete
 * UTC date range. `today`/`yesterday` are exact calendar-day boundaries;
 * `7d`/`30d`/`6m` are rolling windows ending now, matching the convention
 * already used by the main dashboard's period filter.
 */
export function resolveDateRange(
  period: PeriodPreset = 'today',
  customFrom?: string,
  customTo?: string
): ResolvedDateRange {
  const now = new Date();

  if (period === 'custom') {
    if (!customFrom || !customTo) {
      throw new InvalidDateRangeError('dateFrom and dateTo are required when period is "custom"');
    }

    const dateFrom = new Date(customFrom);
    dateFrom.setUTCHours(0, 0, 0, 0);

    const dateTo = new Date(customTo);
    dateTo.setUTCHours(23, 59, 59, 999);

    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      throw new InvalidDateRangeError('dateFrom and dateTo must be valid dates (YYYY-MM-DD)');
    }

    if (dateFrom > dateTo) {
      throw new InvalidDateRangeError('dateFrom must be on or before dateTo');
    }

    return { dateFrom, dateTo };
  }

  if (period === 'today') {
    const dateFrom = new Date(now);
    dateFrom.setUTCHours(0, 0, 0, 0);
    return { dateFrom, dateTo: now };
  }

  if (period === 'yesterday') {
    const dateTo = new Date(now);
    dateTo.setUTCHours(0, 0, 0, 0);
    const dateFrom = new Date(dateTo);
    dateFrom.setUTCDate(dateFrom.getUTCDate() - 1);
    return { dateFrom, dateTo };
  }

  const days = ROLLING_WINDOW_DAYS[period];
  const dateFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { dateFrom, dateTo: now };
}

/**
 * Stable cache-key fragment for a period selection. Every non-custom preset
 * resolves its `dateTo` against `new Date()`, so keying a cache entry on the
 * *resolved* timestamps would produce a unique key on every single request
 * (millisecond precision) and never hit. Keying on the period name itself
 * (and the raw custom bounds, which are already day-granularity) is what
 * actually lets repeated requests within the cache TTL share an entry.
 */
export function buildPeriodCacheKey(
  period: PeriodPreset = 'today',
  customFrom?: string,
  customTo?: string
): Record<string, string | undefined> {
  if (period === 'custom') {
    return { period, dateFrom: customFrom, dateTo: customTo };
  }
  return { period };
}
