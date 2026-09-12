import type { NotificationStatus } from '@prisma/client';
import { logger } from '../config/logger';
import { AdminNotificationsRepository } from '../repositories/admin-notifications.repository';
import { dashboardRepository } from '../repositories/dashboard.repository';
import { getOrSetCache, buildCacheKey } from '../utils/cache';
import { formatRelativeTime } from '../utils/time-format';
import { resolveDateRange, buildPeriodCacheKey } from '../utils/date-range';
import { normalizeChannel, toEnumChannel } from '../utils/channel-mapping';
import type {
  AdminNotificationItem,
  AdminNotificationStatus,
  AdminNotificationStats,
  AdminNotificationsListResult,
  ListAdminNotificationsQueryParams,
  AdminNotificationStatsQueryParams,
} from '../types/admin-notifications.types';

const NOTIFICATIONS_CACHE_TTL_SECONDS = 15;
const STATS_CACHE_TTL_SECONDS = 15;

// UI-facing status buckets map onto one or more underlying NotificationStatus values.
const STATUS_BUCKET_TO_ENUMS: Record<AdminNotificationStatus, NotificationStatus[]> = {
  delivered: ['SENT', 'DELIVERED'],
  pending: ['PENDING', 'QUEUED'],
  failed: ['FAILED'],
};

function normalizeStatus(status: NotificationStatus): AdminNotificationStatus {
  switch (status) {
    case 'SENT':
    case 'DELIVERED':
      return 'delivered';
    case 'FAILED':
      return 'failed';
    case 'PENDING':
    case 'QUEUED':
    default:
      return 'pending';
  }
}

function formatLatency(createdAt: Date, sentAt: Date | null, deliveredAt: Date | null): string {
  const reference = deliveredAt ?? sentAt;
  if (!reference) return '—';
  const latencyMs = reference.getTime() - createdAt.getTime();
  if (latencyMs < 0) return '—';
  return `${latencyMs}ms`;
}

export class AdminNotificationsService {
  async listNotifications(options: ListAdminNotificationsQueryParams = {}): Promise<AdminNotificationsListResult> {
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = Math.max(0, options.offset || 0);
    const { dateFrom, dateTo } = resolveDateRange(options.period, options.dateFrom, options.dateTo);

    const cacheKey = buildCacheKey('notifications:list', {
      limit,
      offset,
      search: options.search,
      channel: options.channel,
      status: options.status,
      ...buildPeriodCacheKey(options.period, options.dateFrom, options.dateTo),
    });

    return getOrSetCache(cacheKey, NOTIFICATIONS_CACHE_TTL_SECONDS, () =>
      this.fetchNotifications({
        limit,
        offset,
        search: options.search,
        channel: options.channel,
        status: options.status,
        dateFrom,
        dateTo,
      })
    );
  }

  private async fetchNotifications(
    params: Required<Pick<ListAdminNotificationsQueryParams, 'limit' | 'offset'>> &
      Pick<ListAdminNotificationsQueryParams, 'search' | 'channel' | 'status'> & { dateFrom: Date; dateTo: Date }
  ): Promise<AdminNotificationsListResult> {
    try {
      const { notifications, total } = await AdminNotificationsRepository.getNotifications({
        limit: params.limit,
        offset: params.offset,
        search: params.search,
        channel: toEnumChannel(params.channel),
        statuses: params.status ? STATUS_BUCKET_TO_ENUMS[params.status] : undefined,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      });

      const accountIds = [...new Set(notifications.map((n) => n.account_id))];
      const accountNames = await dashboardRepository.getAccountNames(accountIds);

      const data: AdminNotificationItem[] = notifications.map((n) => ({
        id: n.id,
        client: accountNames.get(n.account_id) || 'Unknown',
        to: n.recipient,
        template: n.templateCode || 'custom',
        channel: normalizeChannel(n.channel),
        status: normalizeStatus(n.status),
        latency: formatLatency(n.createdAt, n.sentAt, n.deliveredAt),
        time: formatRelativeTime(n.createdAt),
      }));

      return {
        data,
        meta: {
          limit: params.limit,
          offset: params.offset,
          total,
          rangeStart: params.dateFrom.toISOString(),
          rangeEnd: params.dateTo.toISOString(),
        },
      };
    } catch (error) {
      logger.error({ error }, 'Failed to list admin notifications');
      throw error;
    }
  }

  async getStats(options: AdminNotificationStatsQueryParams = {}): Promise<AdminNotificationStats> {
    const { dateFrom, dateTo } = resolveDateRange(options.period, options.dateFrom, options.dateTo);

    const cacheKey = buildCacheKey(
      'notifications:stats',
      buildPeriodCacheKey(options.period, options.dateFrom, options.dateTo)
    );

    return getOrSetCache(cacheKey, STATS_CACHE_TTL_SECONDS, () => this.fetchStats(dateFrom, dateTo));
  }

  private async fetchStats(dateFrom: Date, dateTo: Date): Promise<AdminNotificationStats> {
    try {
      const periodDays = Math.max(1, Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (24 * 60 * 60 * 1000)));
      const filters = { periodDays, dateFrom, dateTo };

      const [totalCount, statusCounts] = await Promise.all([
        dashboardRepository.getTotalNotificationCount(filters),
        dashboardRepository.getNotificationCountsByStatus(filters),
      ]);

      return {
        totalSent: totalCount,
        delivered: statusCounts.DELIVERED + statusCounts.SENT,
        failed: statusCounts.FAILED,
        pending: statusCounts.PENDING + statusCounts.QUEUED,
        rangeStart: dateFrom.toISOString(),
        rangeEnd: dateTo.toISOString(),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get admin notification stats');
      throw error;
    }
  }
}

export const adminNotificationsService = new AdminNotificationsService();
