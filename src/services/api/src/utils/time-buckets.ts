const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

export type BucketGranularity = 'hour' | 'day' | 'week' | 'month';

/**
 * Picks a chart granularity from the span of a date range, the same way
 * most analytics tools auto-adjust resolution: short ranges get fine detail,
 * long ranges get coarser buckets so the chart stays readable.
 */
export function determineGranularity(dateFrom: Date, dateTo: Date): BucketGranularity {
  const spanDays = (dateTo.getTime() - dateFrom.getTime()) / DAY_MS;
  if (spanDays <= 2) return 'hour';
  if (spanDays <= 31) return 'day';
  if (spanDays <= 120) return 'week';
  return 'month';
}

export function getBucketCount(dateFrom: Date, dateTo: Date, granularity: BucketGranularity): number {
  if (granularity === 'month') {
    return (
      (dateTo.getUTCFullYear() - dateFrom.getUTCFullYear()) * 12 + (dateTo.getUTCMonth() - dateFrom.getUTCMonth()) + 1
    );
  }
  const bucketMs = granularity === 'hour' ? HOUR_MS : granularity === 'day' ? DAY_MS : WEEK_MS;
  return Math.max(1, Math.ceil((dateTo.getTime() - dateFrom.getTime()) / bucketMs));
}

export function getBucketIndex(
  date: Date,
  dateFrom: Date,
  granularity: BucketGranularity,
  bucketCount: number
): number {
  let index: number;
  if (granularity === 'month') {
    index = (date.getUTCFullYear() - dateFrom.getUTCFullYear()) * 12 + (date.getUTCMonth() - dateFrom.getUTCMonth());
  } else {
    const bucketMs = granularity === 'hour' ? HOUR_MS : granularity === 'day' ? DAY_MS : WEEK_MS;
    index = Math.floor((date.getTime() - dateFrom.getTime()) / bucketMs);
  }
  return Math.min(bucketCount - 1, Math.max(0, index));
}

export function getBucketLabel(index: number, dateFrom: Date, granularity: BucketGranularity): string {
  if (granularity === 'week') {
    return `W${index + 1}`;
  }

  if (granularity === 'hour') {
    const bucketDate = new Date(dateFrom.getTime() + index * HOUR_MS);
    const hour = bucketDate.getUTCHours();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}${ampm}`;
  }

  if (granularity === 'day') {
    const bucketDate = new Date(dateFrom.getTime() + index * DAY_MS);
    return bucketDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  // month
  const bucketDate = new Date(dateFrom);
  bucketDate.setUTCMonth(dateFrom.getUTCMonth() + index);
  return bucketDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

export function buildBucketLabels(dateFrom: Date, granularity: BucketGranularity, bucketCount: number): string[] {
  return Array.from({ length: bucketCount }, (_, i) => getBucketLabel(i, dateFrom, granularity));
}
