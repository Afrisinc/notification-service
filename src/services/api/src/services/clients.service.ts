import { logger } from '../config/logger';
import { ClientsRepository } from '../repositories/clients.repository';
import { dashboardRepository } from '../repositories/dashboard.repository';
import { getOrSetCache, buildCacheKey } from '../utils/cache';
import { resolveDateRange, buildPeriodCacheKey } from '../utils/date-range';
import { buildCountKpi, buildRateKpi } from '../utils/kpi';
import {
  ClientDTO,
  ClientsListResponseDTO,
  ListClientsQueryDTO,
  ClientsListFiltersDTO,
  OrganizationAccountDTO,
} from '../dtos/clients';
import type { ClientsStats, ClientsStatsQueryParams } from '../types/clients-stats.types';

const CLIENTS_CACHE_TTL_SECONDS = 30;
const CLIENTS_STATS_CACHE_TTL_SECONDS = 30;

export class ClientsService {
  async getAllClients(options: ListClientsQueryDTO = {}): Promise<ClientsListResponseDTO> {
    // Validate and set defaults
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = Math.max(0, options.offset || 0);

    const cacheKey = buildCacheKey('clients:list', {
      limit,
      offset,
      search: options.search,
      status: options.status,
      plan: options.plan,
    });

    return getOrSetCache(cacheKey, CLIENTS_CACHE_TTL_SECONDS, () =>
      this.fetchAllClients({ limit, offset, search: options.search, status: options.status, plan: options.plan })
    );
  }

  private async fetchAllClients(filters: ClientsListFiltersDTO): Promise<ClientsListResponseDTO> {
    const { limit, offset } = filters;
    try {
      const { accounts } = await ClientsRepository.getAccounts({
        ...filters,
        limit: 1000, // Fetch all to deduplicate by user
        offset: 0,
      });

      // Group accounts by user email
      const userMap = new Map<string, typeof accounts>();
      accounts.forEach((account) => {
        const email = account.owner.email;
        if (!userMap.has(email)) {
          userMap.set(email, []);
        }
        userMap.get(email)!.push(account);
      });

      // Fetch notification stats for every account in one batched pair of queries
      // instead of two queries per account (was exhausting the DB connection pool).
      const accountIds = accounts.map((account) => account.id);
      const statsByAccount = await ClientsRepository.getNotificationStatsForAccounts(accountIds);

      // Convert to client DTOs
      const clients = Array.from(userMap.entries()).map(([email, userAccounts]) => {
        const firstAccount = userAccounts[0];
        const ownerName = `${firstAccount.owner.firstName || ''} ${firstAccount.owner.lastName || ''}`.trim();

        const organizationData = userAccounts.map((account) => {
          const { sentCount, failedCount } = statsByAccount.get(account.id) || { sentCount: 0, failedCount: 0 };
          const totalCount = sentCount + failedCount;
          const planName = account.subscription?.plan?.name || 'FREE';

          return {
            org: {
              id: Math.abs(Number.parseInt(account.id.substring(0, 8), 16)),
              accountId: account.id,
              organizationId: account.organization_id ?? null,
              name: account.organization?.name || 'N/A',
              plan: planName as 'FREE' | 'STARTER' | 'SCALE' | 'ENTERPRISE' | 'PRO' | 'PAYG',
              role: 'owner' as const,
              sent: this.formatNumber(totalCount),
              templates: account.templates.length,
              status: (account.subscription?.status || 'trial') as 'active' | 'suspended' | 'trial',
              joined: account.subscription?.createdAt
                ? new Date(account.subscription.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Unknown',
            } as OrganizationAccountDTO,
            sentCount,
            totalCount,
          };
        });

        const organizations = organizationData.map((o) => o.org);
        const ownedCount = organizations.filter((o) => o.role === 'owner').length;
        const memberCount = organizations.filter((o) => o.role === 'member').length;
        const totalSent = organizationData.reduce((sum, o) => sum + o.sentCount, 0);
        const totalCount = organizationData.reduce((sum, o) => sum + o.totalCount, 0);
        const totalTemplates = organizations.reduce((sum, o) => sum + o.templates, 0);
        const deliveryRate = totalCount > 0 ? ((totalSent / totalCount) * 100).toFixed(1) : '0';

        return {
          id: email,
          name: ownerName || 'Unknown',
          email,
          organizations,
          stats: {
            totalOrganizations: organizations.length,
            ownedOrganizations: ownedCount,
            memberOrganizations: memberCount,
            aggregatedStats: {
              sent: this.formatNumber(totalSent),
              templates: totalTemplates,
              deliveryRate: `${deliveryRate}%`,
            },
          },
        } as ClientDTO;
      });

      const paginatedClients = clients.slice(offset, offset + limit);

      return {
        data: paginatedClients,
        meta: {
          limit,
          offset,
          total: clients.length,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Failed to fetch clients');
      throw error;
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + 'M';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  private calculateDeliveryRate(sentCount: number, totalCount: number): string {
    if (totalCount === 0) return '0%';
    const deliveryRate = (sentCount / totalCount) * 100;
    return deliveryRate.toFixed(1) + '%';
  }

  async getStats(options: ClientsStatsQueryParams = {}): Promise<ClientsStats> {
    const { dateFrom, dateTo } = resolveDateRange(options.period, options.dateFrom, options.dateTo);

    const cacheKey = buildCacheKey(
      'clients:stats',
      buildPeriodCacheKey(options.period, options.dateFrom, options.dateTo)
    );

    return getOrSetCache(cacheKey, CLIENTS_STATS_CACHE_TTL_SECONDS, () => this.fetchStats(dateFrom, dateTo));
  }

  private async fetchStats(dateFrom: Date, dateTo: Date): Promise<ClientsStats> {
    try {
      const spanMs = dateTo.getTime() - dateFrom.getTime();
      const prevStart = new Date(dateFrom.getTime() - spanMs);
      const prevEnd = dateFrom;
      const periodDays = Math.max(1, Math.ceil(spanMs / (24 * 60 * 60 * 1000)));

      const [activeClients, newClients, prevNewClients, totalSent, statusCounts, prevTotalSent, prevStatusCounts] =
        await Promise.all([
          dashboardRepository.getActiveClientCount(),
          dashboardRepository.getNewClientsInPeriod({ periodDays, dateFrom, dateTo }),
          dashboardRepository.getNewClientsInPeriod({ periodDays, dateFrom: prevStart, dateTo: prevEnd }),
          dashboardRepository.getTotalNotificationCount({ periodDays, dateFrom, dateTo }),
          dashboardRepository.getNotificationCountsByStatus({ periodDays, dateFrom, dateTo }),
          dashboardRepository.getTotalNotificationCount({ periodDays, dateFrom: prevStart, dateTo: prevEnd }),
          dashboardRepository.getNotificationCountsByStatus({ periodDays, dateFrom: prevStart, dateTo: prevEnd }),
        ]);

      const delivered = statusCounts.DELIVERED + statusCounts.SENT;
      const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;
      const prevDelivered = prevStatusCounts.DELIVERED + prevStatusCounts.SENT;
      const prevDeliveryRate = prevTotalSent > 0 ? (prevDelivered / prevTotalSent) * 100 : 0;

      return {
        activeClients,
        newClients: buildCountKpi(newClients, prevNewClients, (n) => n.toString()),
        totalSent: buildCountKpi(totalSent, prevTotalSent, (n) => this.formatNumber(n)),
        avgDeliveryRate: buildRateKpi(deliveryRate, prevDeliveryRate),
        rangeStart: dateFrom.toISOString(),
        rangeEnd: dateTo.toISOString(),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get client stats');
      throw error;
    }
  }
}

export const clientsService = new ClientsService();
