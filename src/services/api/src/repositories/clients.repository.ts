import { prismaRead } from '@shared/database';
import { ClientsListFiltersDTO } from '../dtos/clients';

export class ClientsRepository {
  static async getAccounts(filters: ClientsListFiltersDTO) {
    const where: any = {};

    // Search filter - multi-field search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      where.OR = [
        { owner: { firstName: { contains: searchLower, mode: 'insensitive' } } },
        { owner: { lastName: { contains: searchLower, mode: 'insensitive' } } },
        { owner: { email: { contains: searchLower, mode: 'insensitive' } } },
      ];
    }

    // Status filter
    if (filters.status) {
      where.subscription = { status: filters.status };
    }

    // Plan filter
    if (filters.plan) {
      where.subscription = {
        ...where.subscription,
        plan: { name: filters.plan },
      };
    }

    // Execute query and count in transaction
    const [accounts, total] = await prismaRead.$transaction([
      prismaRead.account.findMany({
        where,
        include: {
          owner: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          organization: {
            select: {
              name: true,
            },
          },
          subscription: {
            select: {
              plan_id: true,
              status: true,
              createdAt: true,
              plan: {
                select: {
                  name: true,
                },
              },
            },
          },
          templates: {
            select: {
              id: true,
            },
          },
        },
        skip: filters.offset,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prismaRead.account.count({ where }),
    ]);

    return { accounts, total };
  }

  /**
   * Batched replacement for per-account notification stats.
   * A single pair of groupBy queries covers every account instead of firing
   * 2 queries per account, which was exhausting the DB connection pool
   * (P2037 "too many clients already") once the account list grew.
   */
  static async getNotificationStatsForAccounts(
    accountIds: string[]
  ): Promise<Map<string, { sentCount: number; failedCount: number; channels: string[] }>> {
    const statsByAccount = new Map<string, { sentCount: number; failedCount: number; channels: string[] }>();

    if (accountIds.length === 0) {
      return statsByAccount;
    }

    const [countByStatus, channelData] = await Promise.all([
      prismaRead.notification.groupBy({
        by: ['account_id', 'status'],
        where: { account_id: { in: accountIds }, status: { in: ['SENT', 'FAILED'] } },
        _count: true,
      }),
      prismaRead.notification.groupBy({
        by: ['account_id', 'channel'],
        where: { account_id: { in: accountIds } },
      }),
    ]);

    accountIds.forEach((id) => statsByAccount.set(id, { sentCount: 0, failedCount: 0, channels: [] }));

    countByStatus.forEach((row) => {
      const entry = statsByAccount.get(row.account_id);
      if (!entry) return;
      if (row.status === 'SENT') entry.sentCount = row._count;
      if (row.status === 'FAILED') entry.failedCount = row._count;
    });

    channelData.forEach((row) => {
      const entry = statsByAccount.get(row.account_id);
      if (!entry) return;
      entry.channels.push(row.channel.toLowerCase());
    });

    return statsByAccount;
  }
}

export const clientsRepository = new ClientsRepository();
