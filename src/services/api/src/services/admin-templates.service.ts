import { getConfig } from '@shared/config';
import { logger } from '../config/logger';
import { AdminTemplatesRepository } from '../repositories/admin-templates.repository';
import { dashboardRepository } from '../repositories/dashboard.repository';
import { getOrSetCache, buildCacheKey } from '../utils/cache';
import { formatRelativeTime } from '../utils/time-format';
import { normalizeChannel, toEnumChannel } from '../utils/channel-mapping';
import type {
  AdminTemplateItem,
  AdminTemplateStats,
  AdminTemplatesListResult,
  ListAdminTemplatesQueryParams,
} from '../types/admin-templates.types';

const TEMPLATES_CACHE_TTL_SECONDS = 30;
const STATS_CACHE_TTL_SECONDS = 30;

export class AdminTemplatesService {
  async listTemplates(options: ListAdminTemplatesQueryParams = {}): Promise<AdminTemplatesListResult> {
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = Math.max(0, options.offset || 0);

    const cacheKey = buildCacheKey('templates:list', {
      limit,
      offset,
      search: options.search,
      channel: options.channel,
      status: options.status,
    });

    return getOrSetCache(cacheKey, TEMPLATES_CACHE_TTL_SECONDS, () =>
      this.fetchTemplates({ limit, offset, search: options.search, channel: options.channel, status: options.status })
    );
  }

  private async fetchTemplates(
    params: Required<Pick<ListAdminTemplatesQueryParams, 'limit' | 'offset'>> &
      Pick<ListAdminTemplatesQueryParams, 'search' | 'channel' | 'status'>
  ): Promise<AdminTemplatesListResult> {
    try {
      const { templates, total } = await AdminTemplatesRepository.getTemplates({
        limit: params.limit,
        offset: params.offset,
        search: params.search,
        channel: toEnumChannel(params.channel),
        active: params.status === 'active' ? true : params.status === 'draft' ? false : undefined,
      });

      const systemAccountId = getConfig().SYSTEM_ACCOUNT_ID;
      const clientAccountIds = [...new Set(templates.map((t) => t.account_id).filter((id) => id !== systemAccountId))];

      const [accountNames, usageCounts] = await Promise.all([
        dashboardRepository.getAccountNames(clientAccountIds),
        AdminTemplatesRepository.getUsageCounts(templates.map((t) => t.id)),
      ]);

      const data: AdminTemplateItem[] = templates.map((t) => ({
        id: t.id,
        name: t.code,
        client: t.account_id === systemAccountId ? 'Global' : accountNames.get(t.account_id) || 'Unknown',
        channel: normalizeChannel(t.channel),
        status: t.active ? 'active' : 'draft',
        tags: t.tags,
        uses: usageCounts.get(t.id) || 0,
        updated: formatRelativeTime(t.updatedAt),
      }));

      return {
        data,
        meta: { limit: params.limit, offset: params.offset, total },
      };
    } catch (error) {
      logger.error({ error }, 'Failed to list admin templates');
      throw error;
    }
  }

  async getStats(): Promise<AdminTemplateStats> {
    const cacheKey = buildCacheKey('templates:stats');
    return getOrSetCache(cacheKey, STATS_CACHE_TTL_SECONDS, () => this.fetchStats());
  }

  private async fetchStats(): Promise<AdminTemplateStats> {
    try {
      const { total, active } = await AdminTemplatesRepository.getStats();
      return { total, active, drafts: total - active };
    } catch (error) {
      logger.error({ error }, 'Failed to get admin template stats');
      throw error;
    }
  }
}

export const adminTemplatesService = new AdminTemplatesService();
