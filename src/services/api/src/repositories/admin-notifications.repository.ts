import type { Channel, NotificationStatus, Prisma } from '@prisma/client';
import { prismaRead } from '@shared/database';

export interface AdminNotificationFilters {
  limit: number;
  offset: number;
  search?: string;
  channel?: Channel;
  statuses?: NotificationStatus[];
  dateFrom: Date;
  dateTo: Date;
}

export interface AdminNotificationRow {
  id: string;
  account_id: string;
  channel: Channel;
  recipient: string;
  templateCode: string | null;
  status: NotificationStatus;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
}

export class AdminNotificationsRepository {
  static async getNotifications(
    filters: AdminNotificationFilters
  ): Promise<{ notifications: AdminNotificationRow[]; total: number }> {
    const where: Prisma.NotificationWhereInput = {
      createdAt: { gte: filters.dateFrom, lte: filters.dateTo },
    };

    if (filters.channel) {
      where.channel = filters.channel;
    }

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses };
    }

    if (filters.search) {
      const search = filters.search;
      where.OR = [
        { recipient: { contains: search, mode: 'insensitive' } },
        { templateCode: { contains: search, mode: 'insensitive' } },
        { account: { owner: { firstName: { contains: search, mode: 'insensitive' } } } },
        { account: { owner: { lastName: { contains: search, mode: 'insensitive' } } } },
        { account: { organization: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [notifications, total] = await prismaRead.$transaction([
      prismaRead.notification.findMany({
        where,
        select: {
          id: true,
          account_id: true,
          channel: true,
          recipient: true,
          templateCode: true,
          status: true,
          createdAt: true,
          sentAt: true,
          deliveredAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: filters.offset,
        take: filters.limit,
      }),
      prismaRead.notification.count({ where }),
    ]);

    return { notifications, total };
  }
}

export const adminNotificationsRepository = new AdminNotificationsRepository();
