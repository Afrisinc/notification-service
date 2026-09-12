/**
 * Admin Templates Types
 * TypeScript interfaces for the platform admin templates list/stats endpoints
 */

import type { UiChannel } from '../utils/channel-mapping';

export type AdminTemplateChannel = UiChannel;
export type AdminTemplateStatus = 'active' | 'draft';

export interface ListAdminTemplatesQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
  channel?: AdminTemplateChannel;
  status?: AdminTemplateStatus;
}

export interface AdminTemplateItem {
  id: string;
  name: string;
  client: string;
  channel: AdminTemplateChannel;
  status: AdminTemplateStatus;
  tags: string[];
  uses: number;
  updated: string;
}

export interface AdminTemplatesListResult {
  data: AdminTemplateItem[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface AdminTemplateStats {
  total: number;
  active: number;
  drafts: number;
}
