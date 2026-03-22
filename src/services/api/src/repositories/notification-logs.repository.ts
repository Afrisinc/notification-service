import { prismaRead } from '@shared/database';

export interface NotificationLogFilters {
  page: number;
  limit: number;
  status?: string;
  channel?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  campaignId?: string;
  templateId?: string;
  provider?: string;
}

export class NotificationLogsRepository {
  /**
   * List notification logs for an app
   */
  async listAppLogs(appId: string, filters: NotificationLogFilters) {
    const skip = (filters.page - 1) * filters.limit;

    const where: any = { app_id: appId };

    if (filters.status) {
      where.status = { in: filters.status.split(',').map((s) => s.trim().toUpperCase()) };
    }

    if (filters.channel) {
      where.channel = { in: filters.channel.split(',').map((c) => c.trim().toUpperCase()) };
    }

    if (filters.search) {
      where.OR = [{ recipient: { contains: filters.search, mode: 'insensitive' } }];
    }

    if (filters.dateFrom || filters.dateTo) {
      where.sentAt = {};
      if (filters.dateFrom) where.sentAt.gte = filters.dateFrom;
      if (filters.dateTo) where.sentAt.lte = filters.dateTo;
    }

    const [notifications, total] = await Promise.all([
      prismaRead.notification.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { sentAt: 'desc' },
      }),
      prismaRead.notification.count({ where }),
    ]);

    return { notifications, total };
  }

  /**
   * List notification logs across all apps
   */
  async listAllLogs(filters: {
    page: number;
    limit: number;
    appId?: string;
    status?: string;
    channel?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const skip = (filters.page - 1) * filters.limit;

    const where: any = {};

    if (filters.appId) {
      where.app_id = filters.appId;
    }

    if (filters.status) {
      where.status = { in: filters.status.split(',').map((s) => s.trim().toUpperCase()) };
    }

    if (filters.channel) {
      where.channel = { in: filters.channel.split(',').map((c) => c.trim().toUpperCase()) };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.sentAt = {};
      if (filters.dateFrom) where.sentAt.gte = filters.dateFrom;
      if (filters.dateTo) where.sentAt.lte = filters.dateTo;
    }

    const [notifications, total] = await Promise.all([
      prismaRead.notification.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { sentAt: 'desc' },
      }),
      prismaRead.notification.count({ where }),
    ]);

    return { notifications, total };
  }

  /**
   * Get single notification log
   */
  async findById(id: string, appId?: string) {
    const where: any = { id };

    if (appId) {
      where.app_id = appId;
    }

    return prismaRead.notification.findFirst({
      where,
    });
  }

  /**
   * Get notification status
   */
  async getStatus(id: string) {
    return prismaRead.notification.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        recipient: true,
        channel: true,
        sentAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get notification counts by status
   */
  async getStatusCounts(appId: string, dateFrom?: Date, dateTo?: Date) {
    const where: any = { app_id: appId };

    if (dateFrom || dateTo) {
      where.sentAt = {};
      if (dateFrom) where.sentAt.gte = dateFrom;
      if (dateTo) where.sentAt.lte = dateTo;
    }

    const counts = await prismaRead.notification.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const result: Record<string, number> = {
      DELIVERED: 0,
      FAILED: 0,
      PENDING: 0,
      BOUNCED: 0,
      QUEUED: 0,
    };

    counts.forEach((c: any) => {
      if (c.status in result) {
        result[c.status] = c._count;
      }
    });

    return result;
  }

  /**
   * Get logs for export
   */
  async getLogsForExport(appId: string, filters: Omit<NotificationLogFilters, 'page' | 'limit'>) {
    const where: any = { app_id: appId };

    if (filters.status) {
      where.status = { in: filters.status.split(',').map((s) => s.trim().toUpperCase()) };
    }

    if (filters.channel) {
      where.channel = { in: filters.channel.split(',').map((c) => c.trim().toUpperCase()) };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.sentAt = {};
      if (filters.dateFrom) where.sentAt.gte = filters.dateFrom;
      if (filters.dateTo) where.sentAt.lte = filters.dateTo;
    }

    return prismaRead.notification.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: 100000,
    });
  }
}

export const notificationLogsRepository = new NotificationLogsRepository();
