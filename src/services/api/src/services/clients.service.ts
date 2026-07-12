import { logger } from '../config/logger';
import { ClientsRepository } from '../repositories/clients.repository';
import {
  ClientDTO,
  ClientsListResponseDTO,
  ListClientsQueryDTO,
  ClientsListFiltersDTO,
  OrganizationAccountDTO,
} from '../dtos/clients';

export class ClientsService {
  async getAllClients(options: ListClientsQueryDTO = {}): Promise<ClientsListResponseDTO> {
    try {
      // Validate and set defaults
      const limit = Math.min(100, Math.max(1, options.limit || 20));
      const offset = Math.max(0, options.offset || 0);

      const filters: ClientsListFiltersDTO = {
        limit,
        offset,
        search: options.search,
        status: options.status,
        plan: options.plan,
      };

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

      // Convert to client DTOs
      const clientsPromises = Array.from(userMap.entries()).map(async ([email, userAccounts]) => {
        const firstAccount = userAccounts[0];
        const ownerName = `${firstAccount.owner.firstName || ''} ${firstAccount.owner.lastName || ''}`.trim();

        const organizationsPromises = userAccounts.map(async (account) => {
          const { sentCount, failedCount } = await ClientsRepository.getNotificationStats(account.id);
          const totalCount = sentCount + failedCount;
          const planName = account.subscription?.plan?.name || 'FREE';

          return {
            org: {
              id: Math.abs(Number.parseInt(account.id.substring(0, 8), 16)),
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

        const organizationData = await Promise.all(organizationsPromises);
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

      const clients = await Promise.all(clientsPromises);
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
}

export const clientsService = new ClientsService();
