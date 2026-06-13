import { logger } from '../config/logger';
import { ClientsRepository } from '../repositories/clients.repository';
import { ClientDTO, ClientsListResponseDTO, ListClientsQueryDTO, ClientsListFiltersDTO } from '../dtos/clients';

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

      const { accounts, total } = await ClientsRepository.getAccounts(filters);

      const clients: ClientDTO[] = await Promise.all(
        accounts.map(async (account: (typeof accounts)[0]) => {
          const { sentCount, failedCount, channels } = await ClientsRepository.getNotificationStats(account.id);
          const totalCount = sentCount + failedCount;

          const planName = account.subscription?.plan?.name || 'FREE';
          const ownerName = `${account.owner.firstName || ''} ${account.owner.lastName || ''}`.trim();

          return {
            id: Math.abs(Number.parseInt(account.id.substring(0, 8), 16)),
            name: ownerName || 'Unknown',
            plan: planName as 'FREE' | 'STARTER' | 'SCALE' | 'ENTERPRISE' | 'PAYG',
            email: account.owner.email,
            sent: this.formatNumber(totalCount),
            deliveryRate: this.calculateDeliveryRate(sentCount, totalCount),
            templates: account.templates.length,
            status: (account.subscription?.status || 'trial') as 'active' | 'suspended' | 'trial',
            joined: account.subscription?.createdAt
              ? new Date(account.subscription.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
              : 'Unknown',
            channels,
            organizationName: account.organization?.name || 'N/A',
            organizationType: account.type,
          };
        })
      );

      return {
        data: clients,
        meta: {
          limit,
          offset,
          total,
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
