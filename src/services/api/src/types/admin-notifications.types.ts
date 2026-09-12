/**
 * Admin Notifications Types
 * TypeScript interfaces for the platform admin notifications list/stats endpoints
 */

import type { PeriodPreset } from '../utils/date-range';
import type { UiChannel } from '../utils/channel-mapping';

export type AdminNotificationStatus = 'delivered' | 'failed' | 'pending';
export type AdminNotificationChannel = UiChannel;
export type AdminNotificationPeriod = PeriodPreset;

export interface DateRangeQueryParams {
  period?: AdminNotificationPeriod;
  dateFrom?: string;
  dateTo?: string;
}

export interface ListAdminNotificationsQueryParams extends DateRangeQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
  channel?: AdminNotificationChannel;
  status?: AdminNotificationStatus;
}

export type AdminNotificationStatsQueryParams = DateRangeQueryParams;

export interface AdminNotificationItem {
  id: string;
  client: string;
  to: string;
  template: string;
  channel: AdminNotificationChannel;
  status: AdminNotificationStatus;
  latency: string;
  time: string;
}

export interface AdminNotificationsListResult {
  data: AdminNotificationItem[];
  meta: {
    limit: number;
    offset: number;
    total: number;
    rangeStart: string;
    rangeEnd: string;
  };
}

export interface AdminNotificationStats {
  totalSent: number;
  delivered: number;
  failed: number;
  pending: number;
  rangeStart: string;
  rangeEnd: string;
}
