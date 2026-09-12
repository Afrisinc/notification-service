import { logger } from '../config/logger';
import { AdminAnalyticsRepository } from '../repositories/admin-analytics.repository';
import { dashboardRepository } from '../repositories/dashboard.repository';
import { getOrSetCache, buildCacheKey } from '../utils/cache';
import { formatNumber } from '../utils/format-number';
import { resolveDateRange, buildPeriodCacheKey } from '../utils/date-range';
import { determineGranularity, getBucketCount, getBucketIndex, buildBucketLabels } from '../utils/time-buckets';
import { buildCountKpi, buildRateKpi } from '../utils/kpi';
import type {
  AnalyticsOverview,
  AnalyticsQueryParams,
  DeliveryVolumeBucket,
  EngagementBucket,
  TopClient,
} from '../types/admin-analytics.types';

const ANALYTICS_CACHE_TTL_SECONDS = 60;

interface VolumeBucket {
  delivered: number;
  failed: number;
  bounced: number;
}

interface EngagementAccumulator {
  sent: number;
  open: number;
  click: number;
  unsubscribe: number;
}

/**
 * Builds the platform-wide Analytics overview from two data sources:
 *  - `Notification` for send/delivery/failure volume (the transactional path).
 *  - `Campaign` for bounce/open/click/unsubscribe counts, since those are
 *    only ever recorded on bulk campaign sends - individual notifications
 *    have no such tracking in this schema. Open/click rate KPIs and the
 *    Email Engagement chart are scoped to EMAIL campaigns specifically,
 *    since opens/clicks are an email-native concept.
 *
 * Chart resolution auto-adjusts to the selected range (hourly for "today",
 * daily for a week/month, weekly for up to ~4 months, monthly beyond that)
 * so a 6-month view doesn't try to render 180 daily bars.
 */
export class AdminAnalyticsService {
  async getOverview(options: AnalyticsQueryParams = {}): Promise<AnalyticsOverview> {
    const { dateFrom, dateTo } = resolveDateRange(options.period, options.dateFrom, options.dateTo);

    const cacheKey = buildCacheKey(
      'analytics:overview',
      buildPeriodCacheKey(options.period, options.dateFrom, options.dateTo)
    );

    return getOrSetCache(cacheKey, ANALYTICS_CACHE_TTL_SECONDS, () => this.fetchOverview(dateFrom, dateTo));
  }

  private async fetchOverview(dateFrom: Date, dateTo: Date): Promise<AnalyticsOverview> {
    try {
      const spanMs = dateTo.getTime() - dateFrom.getTime();
      const prevStart = new Date(dateFrom.getTime() - spanMs);
      const prevEnd = dateFrom;
      const periodDays = Math.max(1, Math.ceil(spanMs / (24 * 60 * 60 * 1000)));

      const granularity = determineGranularity(dateFrom, dateTo);
      const bucketCount = getBucketCount(dateFrom, dateTo, granularity);
      const bucketLabels = buildBucketLabels(dateFrom, granularity, bucketCount);

      const [notificationRows, prevStatusCounts, prevTotalCount, campaignRows, prevEmailAgg, topAccounts] =
        await Promise.all([
          AdminAnalyticsRepository.getNotificationRows(dateFrom, dateTo),
          dashboardRepository.getNotificationCountsByStatus({ periodDays, dateFrom: prevStart, dateTo: prevEnd }),
          dashboardRepository.getTotalNotificationCount({ periodDays, dateFrom: prevStart, dateTo: prevEnd }),
          AdminAnalyticsRepository.getCampaignRows(dateFrom, dateTo),
          AdminAnalyticsRepository.getCampaignAggregate(prevStart, prevEnd, 'EMAIL'),
          AdminAnalyticsRepository.getTopAccountsByVolume(dateFrom, dateTo, 5),
        ]);

      // ---- Volume buckets: delivered/failed from Notification, bounced + email engagement from Campaign ----
      const volumeBuckets: VolumeBucket[] = Array.from({ length: bucketCount }, () => ({
        delivered: 0,
        failed: 0,
        bounced: 0,
      }));
      const engagementBuckets: EngagementAccumulator[] = Array.from({ length: bucketCount }, () => ({
        sent: 0,
        open: 0,
        click: 0,
        unsubscribe: 0,
      }));

      let currentTotal = 0;
      let currentDelivered = 0;
      let currentFailed = 0;

      notificationRows.forEach((row) => {
        const bucketIndex = getBucketIndex(row.createdAt, dateFrom, granularity, bucketCount);
        currentTotal++;
        if (row.status === 'SENT' || row.status === 'DELIVERED') {
          volumeBuckets[bucketIndex].delivered++;
          currentDelivered++;
        } else if (row.status === 'FAILED') {
          volumeBuckets[bucketIndex].failed++;
          currentFailed++;
        }
      });

      let currentBounced = 0;
      let currentEmailSent = 0;
      let currentEmailOpen = 0;
      let currentEmailClick = 0;

      campaignRows.forEach((row) => {
        const sentDate = row.sent_at ?? row.createdAt;
        const bucketIndex = getBucketIndex(sentDate, dateFrom, granularity, bucketCount);
        volumeBuckets[bucketIndex].bounced += row.bounce_count;
        currentBounced += row.bounce_count;

        if (row.channel === 'EMAIL') {
          currentEmailSent += row.sent_count;
          currentEmailOpen += row.open_count;
          currentEmailClick += row.click_count;

          const engagementBucket = engagementBuckets[bucketIndex];
          engagementBucket.sent += row.sent_count;
          engagementBucket.open += row.open_count;
          engagementBucket.click += row.click_count;
          engagementBucket.unsubscribe += row.unsubscribe_count;
        }
      });

      const deliveryVolume: DeliveryVolumeBucket[] = volumeBuckets.map((bucket, i) => ({
        label: bucketLabels[i],
        delivered: bucket.delivered,
        failed: bucket.failed,
        bounced: bucket.bounced,
      }));

      const emailEngagement: EngagementBucket[] = engagementBuckets.map((bucket, i) => ({
        label: bucketLabels[i],
        opens: bucket.sent > 0 ? Math.round((bucket.open / bucket.sent) * 1000) / 10 : 0,
        clicks: bucket.sent > 0 ? Math.round((bucket.click / bucket.sent) * 1000) / 10 : 0,
        unsubscribes: bucket.sent > 0 ? Math.round((bucket.unsubscribe / bucket.sent) * 1000) / 10 : 0,
      }));

      // ---- Success rate: share of delivered/failed/bounced across the selected range ----
      const outcomeTotal = currentDelivered + currentFailed + currentBounced;
      const successRate = {
        delivered: outcomeTotal > 0 ? Math.round((currentDelivered / outcomeTotal) * 1000) / 10 : 0,
        failed: outcomeTotal > 0 ? Math.round((currentFailed / outcomeTotal) * 1000) / 10 : 0,
        bounced: outcomeTotal > 0 ? Math.round((currentBounced / outcomeTotal) * 1000) / 10 : 0,
      };

      // ---- KPIs ----
      const currentDeliveryRate = currentTotal > 0 ? (currentDelivered / currentTotal) * 100 : 0;
      const prevDeliveredCount = prevStatusCounts.DELIVERED + prevStatusCounts.SENT;
      const prevDeliveryRate = prevTotalCount > 0 ? (prevDeliveredCount / prevTotalCount) * 100 : 0;

      const currentOpenRate = currentEmailSent > 0 ? (currentEmailOpen / currentEmailSent) * 100 : 0;
      const currentClickRate = currentEmailSent > 0 ? (currentEmailClick / currentEmailSent) * 100 : 0;
      const prevOpenRate = prevEmailAgg.sent > 0 ? (prevEmailAgg.open / prevEmailAgg.sent) * 100 : 0;
      const prevClickRate = prevEmailAgg.sent > 0 ? (prevEmailAgg.click / prevEmailAgg.sent) * 100 : 0;

      const kpis: AnalyticsOverview['kpis'] = {
        totalSent: buildCountKpi(currentTotal, prevTotalCount, formatNumber),
        avgDeliveryRate: buildRateKpi(currentDeliveryRate, prevDeliveryRate),
        avgOpenRate: buildRateKpi(currentOpenRate, prevOpenRate),
        avgClickRate: buildRateKpi(currentClickRate, prevClickRate),
      };

      // ---- Top clients by volume (Notification count over the same window) ----
      const accountIds = topAccounts.map((a) => a.accountId);
      const [accountNames, accountPlans] = await Promise.all([
        dashboardRepository.getAccountNames(accountIds),
        AdminAnalyticsRepository.getAccountPlans(accountIds),
      ]);

      const topClients: TopClient[] = topAccounts.map((a) => ({
        accountId: a.accountId,
        name: accountNames.get(a.accountId) || 'Unknown',
        plan: accountPlans.get(a.accountId) || 'FREE',
        sent: a.count,
      }));

      return {
        kpis,
        deliveryVolume,
        successRate,
        emailEngagement,
        topClients,
        rangeStart: dateFrom.toISOString(),
        rangeEnd: dateTo.toISOString(),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to build analytics overview');
      throw error;
    }
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
