/**
 * Admin Analytics Types
 * TypeScript interfaces for the platform admin analytics overview endpoint
 */

import type { PeriodPreset } from '../utils/date-range';
import type { Kpi } from '../utils/kpi';

export type AnalyticsPeriod = PeriodPreset;
export type AnalyticsKpi = Kpi;

export interface AnalyticsQueryParams {
  period?: AnalyticsPeriod;
  dateFrom?: string;
  dateTo?: string;
}

export interface AnalyticsKpis {
  totalSent: AnalyticsKpi;
  avgDeliveryRate: AnalyticsKpi;
  avgOpenRate: AnalyticsKpi;
  avgClickRate: AnalyticsKpi;
}

export interface DeliveryVolumeBucket {
  label: string;
  delivered: number;
  failed: number;
  bounced: number;
}

export interface SuccessRateBreakdown {
  delivered: number;
  failed: number;
  bounced: number;
}

export interface EngagementBucket {
  label: string;
  opens: number;
  clicks: number;
  unsubscribes: number;
}

export interface TopClient {
  accountId: string;
  name: string;
  plan: string;
  sent: number;
}

export interface AnalyticsOverview {
  kpis: AnalyticsKpis;
  deliveryVolume: DeliveryVolumeBucket[];
  successRate: SuccessRateBreakdown;
  emailEngagement: EngagementBucket[];
  topClients: TopClient[];
  rangeStart: string;
  rangeEnd: string;
}
