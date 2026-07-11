/**
 * Dashboard Service
 * Business logic for dashboard metrics and statistics
 */

import { logger } from '../config/logger';
import { dashboardRepository, DashboardFilters } from '../repositories/dashboard.repository';
import {
  DashboardPeriod,
  DashboardStats,
  DashboardData,
  NotificationVolumeItem,
  ChannelBreakdownItem,
  RecentActivityItem,
  SystemHealthItem,
  SystemStatusOverall,
  RecentSendsData,
  PERIOD_CONFIG,
  CHANNEL_COLORS,
} from '../types/dashboard.types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class DashboardService {
  /**
   * Get full dashboard data
   */
  async getDashboard(period: DashboardPeriod = '7d', timezone: string = 'UTC'): Promise<DashboardData> {
    try {
      const filters = this.buildFilters(period);

      // Fetch all data in parallel
      const [stats, notificationVolume, channelBreakdown, peakSendTime, recentActivity, systemHealth] =
        await Promise.all([
          this.getStats(period),
          this.getNotificationVolume(filters),
          this.getChannelBreakdown(filters),
          this.getPeakSendTime(filters),
          this.getRecentActivityInternal(6, 0),
          this.getSystemHealth(),
        ]);

      const systemStatusOverall = this.calculateOverallStatus(systemHealth);

      return {
        stats,
        notificationVolume,
        channelBreakdown,
        peakSendTime,
        recentActivity,
        systemHealth,
        systemStatusOverall,
      };
    } catch (error) {
      logger.error({ error, period, timezone }, 'Failed to get dashboard data');
      throw error;
    }
  }

  /**
   * Get stats cards only
   */
  async getStats(period: DashboardPeriod = '7d'): Promise<DashboardStats> {
    try {
      const filters = this.buildFilters(period);
      const periodLabel = PERIOD_CONFIG[period].label;

      // Fetch all stats data in parallel
      const [
        totalCount,
        statusCounts,
        previousPeriodCount,
        previousDeliveryStats,
        activeClients,
        newClients,
        templateCount,
      ] = await Promise.all([
        dashboardRepository.getTotalNotificationCount(filters),
        dashboardRepository.getNotificationCountsByStatus(filters),
        dashboardRepository.getPreviousPeriodCount(filters),
        dashboardRepository.getPreviousPeriodDeliveryStats(filters),
        dashboardRepository.getActiveClientCount(),
        dashboardRepository.getNewClientsInPeriod(filters),
        dashboardRepository.getTemplateCount(),
      ]);

      // Calculate delivery rate
      const deliveredCount = statusCounts.DELIVERED + statusCounts.SENT;
      const currentDeliveryRate = totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;
      const previousDeliveryRate =
        previousDeliveryStats.total > 0 ? (previousDeliveryStats.delivered / previousDeliveryStats.total) * 100 : 0;

      // Calculate trends
      const messagesTrend = this.calculateTrend(totalCount, previousPeriodCount);
      const deliveryTrend = this.calculateTrendDiff(currentDeliveryRate, previousDeliveryRate);

      return {
        messagesSent: {
          value: this.formatNumber(totalCount),
          label: 'Messages Sent',
          sub: this.getPeriodSubLabel(period),
          trend: messagesTrend.trend,
          trendUp: messagesTrend.trendUp,
          icon: 'send',
        },
        deliveryRate: {
          value: `${currentDeliveryRate.toFixed(1)}%`,
          label: 'Delivery Rate',
          sub: periodLabel,
          trend: deliveryTrend.trend,
          trendUp: deliveryTrend.trendUp,
          icon: 'check',
        },
        activeClients: {
          value: activeClients.toString(),
          label: 'Active Clients',
          sub: 'Total onboarded',
          trend: newClients > 0 ? newClients.toString() : null,
          trendUp: newClients > 0 ? true : null,
          icon: 'users',
        },
        templates: {
          value: templateCount.toString(),
          label: 'Templates',
          sub: 'Across all clients',
          trend: null,
          trendUp: null,
          icon: 'layers',
        },
      };
    } catch (error) {
      logger.error({ error, period }, 'Failed to get dashboard stats');
      throw error;
    }
  }

  /**
   * Get recent sends with pagination
   */
  async getRecentSends(limit: number = 10, offset: number = 0): Promise<RecentSendsData> {
    try {
      const safeLimit = Math.min(50, Math.max(1, limit));
      const safeOffset = Math.max(0, offset);

      const { items, total } = await dashboardRepository.getRecentActivity(safeLimit, safeOffset);

      // Get account names
      const accountIds = [...new Set(items.map((i) => i.accountId))];
      const accountNames = await dashboardRepository.getAccountNames(accountIds);

      // Format items
      const formattedItems: RecentActivityItem[] = items.map((item) => ({
        client: accountNames.get(item.accountId) || 'Unknown',
        channel: this.normalizeChannel(item.channel),
        count: item.count,
        status: this.normalizeStatus(item.status),
        time: this.formatRelativeTime(item.latestSentAt),
      }));

      return {
        items: formattedItems,
        pagination: {
          total,
          limit: safeLimit,
          offset: safeOffset,
          hasMore: safeOffset + safeLimit < total,
        },
      };
    } catch (error) {
      logger.error({ error, limit, offset }, 'Failed to get recent sends');
      throw error;
    }
  }

  // ============= Private Helper Methods =============

  private buildFilters(period: DashboardPeriod): DashboardFilters {
    const config = PERIOD_CONFIG[period];
    const dateTo = new Date();
    const dateFrom = new Date(dateTo.getTime() - config.days * 24 * 60 * 60 * 1000);

    return {
      periodDays: config.days,
      dateFrom,
      dateTo,
    };
  }

  private async getNotificationVolume(filters: DashboardFilters): Promise<NotificationVolumeItem[]> {
    const volumeData = await dashboardRepository.getDailyNotificationVolume(filters);

    // Group by date and aggregate channels
    const dateMap = new Map<string, { email: number; sms: number; push: number }>();

    // Initialize all days in the period
    for (let i = 0; i < filters.periodDays && i < 7; i++) {
      const date = new Date(filters.dateTo.getTime() - i * 24 * 60 * 60 * 1000);
      const dayName = DAY_NAMES[date.getDay()];
      if (!dateMap.has(dayName)) {
        dateMap.set(dayName, { email: 0, sms: 0, push: 0 });
      }
    }

    // Populate with actual data
    volumeData.forEach((item) => {
      const dayName = DAY_NAMES[item.date.getDay()];
      const existing = dateMap.get(dayName) || { email: 0, sms: 0, push: 0 };

      switch (item.channel) {
        case 'EMAIL':
          existing.email += item.count;
          break;
        case 'SMS':
          existing.sms += item.count;
          break;
        case 'PUSH':
          existing.push += item.count;
          break;
      }

      dateMap.set(dayName, existing);
    });

    // Convert to array with proper day ordering
    const result: NotificationVolumeItem[] = [];
    const todayIndex = new Date().getDay();

    // Start from Monday (1) or adjust based on current day
    const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    orderedDays.forEach((day) => {
      const data = dateMap.get(day);
      if (data) {
        result.push({ day, ...data });
      }
    });

    return result;
  }

  private async getChannelBreakdown(filters: DashboardFilters): Promise<ChannelBreakdownItem[]> {
    const channelCounts = await dashboardRepository.getNotificationCountsByChannel(filters);
    const total = Object.values(channelCounts).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      return [
        { label: 'Email', value: 0, color: CHANNEL_COLORS.EMAIL },
        { label: 'SMS', value: 0, color: CHANNEL_COLORS.SMS },
        { label: 'Push', value: 0, color: CHANNEL_COLORS.PUSH },
        { label: 'In-app', value: 0, color: CHANNEL_COLORS.IN_APP },
      ];
    }

    const breakdown: ChannelBreakdownItem[] = [
      {
        label: 'Email',
        value: Math.round((channelCounts.EMAIL / total) * 100),
        color: CHANNEL_COLORS.EMAIL,
      },
      {
        label: 'SMS',
        value: Math.round((channelCounts.SMS / total) * 100),
        color: CHANNEL_COLORS.SMS,
      },
      {
        label: 'Push',
        value: Math.round((channelCounts.PUSH / total) * 100),
        color: CHANNEL_COLORS.PUSH,
      },
      {
        label: 'In-app',
        value: Math.round((channelCounts.IN_APP / total) * 100),
        color: CHANNEL_COLORS.IN_APP,
      },
    ];

    // Sort by value descending
    return breakdown.sort((a, b) => b.value - a.value);
  }

  private async getPeakSendTime(filters: DashboardFilters): Promise<string> {
    const peakData = await dashboardRepository.getPeakSendTime(filters);

    if (!peakData) {
      return 'No data available';
    }

    const dayName = DAY_NAMES[peakData.dayOfWeek];
    const startHour = peakData.hour;
    const endHour = (peakData.hour + 1) % 24;

    const formatHour = (h: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12} ${ampm}`;
    };

    return `${dayName} ${formatHour(startHour)}–${formatHour(endHour)} UTC`;
  }

  private async getRecentActivityInternal(limit: number, offset: number): Promise<RecentActivityItem[]> {
    const { items } = await dashboardRepository.getRecentActivity(limit, offset);
    const accountIds = [...new Set(items.map((i) => i.accountId))];
    const accountNames = await dashboardRepository.getAccountNames(accountIds);

    return items.map((item) => ({
      client: accountNames.get(item.accountId) || 'Unknown',
      channel: this.normalizeChannel(item.channel),
      count: item.count,
      status: this.normalizeStatus(item.status),
      time: this.formatRelativeTime(item.latestSentAt),
    }));
  }

  private async getSystemHealth(): Promise<SystemHealthItem[]> {
    const alerts = await dashboardRepository.getSystemAlerts();

    // Default system health items
    const healthItems: SystemHealthItem[] = [
      { label: 'Email Gateway', status: 'Operational', ok: true },
      { label: 'SMS Provider', status: 'Operational', ok: true },
      { label: 'Push Service', status: 'Operational', ok: true },
      { label: 'API Endpoint', status: 'Operational', ok: true },
      { label: 'Webhook Queue', status: 'Operational', ok: true },
    ];

    // Update based on unresolved alerts
    alerts.forEach((alert) => {
      if (!alert.resolved) {
        const labelLower = alert.label.toLowerCase();
        healthItems.forEach((item) => {
          if (labelLower.includes(item.label.toLowerCase().split(' ')[0].toLowerCase())) {
            item.status = 'Degraded';
            item.ok = false;
          }
        });
      }
    });

    return healthItems;
  }

  private calculateOverallStatus(healthItems: SystemHealthItem[]): SystemStatusOverall {
    const degradedCount = healthItems.filter((h) => !h.ok).length;

    if (degradedCount === 0) {
      return { status: 'operational', message: 'All systems operational' };
    }

    if (degradedCount >= healthItems.length / 2) {
      return { status: 'outage', message: 'Major service disruption' };
    }

    return { status: 'degraded', message: 'Some services degraded' };
  }

  private calculateTrend(current: number, previous: number): { trend: string | null; trendUp: boolean | null } {
    if (previous === 0) {
      return { trend: null, trendUp: null };
    }

    const percentChange = ((current - previous) / previous) * 100;
    const trend = `${Math.abs(percentChange).toFixed(1)}%`;
    const trendUp = percentChange >= 0;

    return { trend, trendUp };
  }

  private calculateTrendDiff(current: number, previous: number): { trend: string | null; trendUp: boolean | null } {
    const diff = current - previous;

    if (Math.abs(diff) < 0.1) {
      return { trend: null, trendUp: null };
    }

    const trend = `${Math.abs(diff).toFixed(1)}%`;
    const trendUp = diff >= 0;

    return { trend, trendUp };
  }

  private formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  }

  private getPeriodSubLabel(period: DashboardPeriod): string {
    switch (period) {
      case '24h':
        return 'Today';
      case '7d':
        return 'This week';
      case '30d':
        return 'This month';
      case '90d':
        return 'Last 90 days';
      default:
        return 'This week';
    }
  }

  private normalizeChannel(channel: string): 'email' | 'sms' | 'push' | 'in-app' {
    switch (channel.toUpperCase()) {
      case 'EMAIL':
        return 'email';
      case 'SMS':
        return 'sms';
      case 'PUSH':
        return 'push';
      case 'IN_APP':
        return 'in-app';
      default:
        return 'email';
    }
  }

  private normalizeStatus(status: string): 'delivered' | 'failed' | 'pending' {
    switch (status.toUpperCase()) {
      case 'DELIVERED':
      case 'SENT':
        return 'delivered';
      case 'FAILED':
      case 'BOUNCED':
        return 'failed';
      case 'PENDING':
      case 'QUEUED':
        return 'pending';
      default:
        return 'pending';
    }
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return 'just now';
    }
    if (diffMins < 60) {
      return `${diffMins} min ago`;
    }
    if (diffHours < 24) {
      return diffHours === 1 ? '1h ago' : `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export const dashboardService = new DashboardService();
