/**
 * Dashboard Types
 * TypeScript interfaces for dashboard endpoints
 */

// ============= Query Parameters =============

export type DashboardPeriod = '24h' | '7d' | '30d' | '90d';

export interface DashboardQueryParams {
  period?: DashboardPeriod;
  timezone?: string;
}

export interface DashboardStatsQueryParams {
  period?: DashboardPeriod;
}

export interface RecentSendsQueryParams {
  limit?: number;
  offset?: number;
}

// ============= Stat Card =============

export interface StatCard {
  value: string;
  label: string;
  sub: string;
  trend: string | null;
  trendUp: boolean | null;
  icon: 'send' | 'check' | 'users' | 'layers';
}

export interface DashboardStats {
  messagesSent: StatCard;
  deliveryRate: StatCard;
  activeClients: StatCard;
  templates: StatCard;
}

// ============= Notification Volume =============

export interface NotificationVolumeItem {
  day: string;
  email: number;
  sms: number;
  push: number;
}

// ============= Channel Breakdown =============

export interface ChannelBreakdownItem {
  label: string;
  value: number;
  color: string;
}

// ============= Recent Activity =============

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in-app';
export type NotificationActivityStatus = 'delivered' | 'failed' | 'pending';

export interface RecentActivityItem {
  client: string;
  channel: NotificationChannel;
  count: number;
  status: NotificationActivityStatus;
  time: string;
}

// ============= System Health =============

export interface SystemHealthItem {
  label: string;
  status: string;
  ok: boolean;
}

export interface SystemStatusOverall {
  status: 'operational' | 'degraded' | 'outage';
  message: string;
}

// ============= Response Metadata =============

export interface DashboardMeta {
  generatedAt: string;
  period: DashboardPeriod;
  timezone?: string;
}

export interface StatsMeta {
  generatedAt: string;
  period: DashboardPeriod;
}

export interface RecentSendsMeta {
  generatedAt: string;
}

// ============= Pagination =============

export interface RecentSendsPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============= Full Dashboard Response =============

export interface DashboardData {
  stats: DashboardStats;
  notificationVolume: NotificationVolumeItem[];
  channelBreakdown: ChannelBreakdownItem[];
  peakSendTime: string;
  recentActivity: RecentActivityItem[];
  systemHealth: SystemHealthItem[];
  systemStatusOverall: SystemStatusOverall;
}

export interface DashboardResponse {
  success: true;
  data: DashboardData;
  meta: DashboardMeta;
}

// ============= Stats Response =============

export interface StatsResponse {
  success: true;
  data: DashboardStats;
  meta: StatsMeta;
}

// ============= Recent Sends Response =============

export interface RecentSendsData {
  items: RecentActivityItem[];
  pagination: RecentSendsPagination;
}

export interface RecentSendsResponse {
  success: true;
  data: RecentSendsData;
  meta: RecentSendsMeta;
}

// ============= Internal Types (for repository/service) =============

export interface PeriodConfig {
  days: number;
  label: string;
}

export const PERIOD_CONFIG: Record<DashboardPeriod, PeriodConfig> = {
  '24h': { days: 1, label: 'Last 24 hours' },
  '7d': { days: 7, label: 'Last 7 days' },
  '30d': { days: 30, label: 'Last 30 days' },
  '90d': { days: 90, label: 'Last 90 days' },
};

export const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: '#0293E4',
  SMS: '#F59E0B',
  PUSH: '#10B981',
  IN_APP: '#8B5CF6',
  WHATSAPP: '#25D366',
};
