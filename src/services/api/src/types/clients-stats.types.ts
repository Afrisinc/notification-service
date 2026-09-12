/**
 * Clients Stats Types
 * TypeScript interfaces for the platform admin clients analytics endpoint
 */

import type { PeriodPreset } from '../utils/date-range';
import type { Kpi } from '../utils/kpi';

export type ClientsStatsPeriod = PeriodPreset;

export interface ClientsStatsQueryParams {
  period?: ClientsStatsPeriod;
  dateFrom?: string;
  dateTo?: string;
}

export interface ClientsStats {
  activeClients: number;
  newClients: Kpi;
  totalSent: Kpi;
  avgDeliveryRate: Kpi;
  rangeStart: string;
  rangeEnd: string;
}
