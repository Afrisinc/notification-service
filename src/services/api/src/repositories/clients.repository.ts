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

    // Execute query and count in parallel
    const [accounts, total] = await Promise.all([
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

  static async getNotificationStats(accountId: string) {
    // Get counts by status in one query
    const countByStatus = await prismaRead.notification.groupBy({
      by: ['status'],
      where: { account_id: accountId, status: { in: ['SENT', 'FAILED'] } },
      _count: true,
    });

    // Get channels in one query
    const channelData = await prismaRead.notification.groupBy({
      by: ['channel'],
      where: { account_id: accountId },
    });

    const sentCount = countByStatus.find((c) => c.status === 'SENT')?._count || 0;
    const failedCount = countByStatus.find((c) => c.status === 'FAILED')?._count || 0;
    const channels = channelData.map((c) => c.channel.toLowerCase());

    return { sentCount, failedCount, channels };
  }
}

export const clientsRepository = new ClientsRepository();
