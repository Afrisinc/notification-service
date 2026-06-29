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
   * List notification logs for an app with optimized query
   */
  async listAppLogs(appId: string, filters: NotificationLogFilters) {
    const skip = (filters.page - 1) * filters.limit;
    const where = this.buildWhereClause(appId, filters);

    // Parallel queries with optimized data fetching
    const [notifications, total, statusCounts] = await Promise.all([
      prismaRead.notification.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { sentAt: 'desc' },
        include: {
          logs: { select: { id: true, status: true, channel: true, provider: true, response: true, createdAt: true } },
        },
      }),
      prismaRead.notification.count({ where }),
      this.getStatusCountsOptimized(appId, filters),
    ]);

    return { notifications, total, statusCounts };
  }

  /**
   * Build where clause to avoid duplication
   */
  private buildWhereClause(appId: string, filters: NotificationLogFilters): any {
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

    return where;
  }

  /**
   * List notification logs across all apps (optimized)
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
        include: {
          logs: { select: { id: true, status: true, channel: true, provider: true, response: true, createdAt: true } },
        },
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
      include: { logs: true },
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
   * Get notification counts by status with filters (optimized)
   */
  private async getStatusCountsOptimized(appId: string, filters: NotificationLogFilters) {
    const where = this.buildWhereClause(appId, filters);

    const counts = await prismaRead.notification.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    return this.normalizeStatusCounts(counts);
  }

  /**
   * Normalize status counts (QUEUED -> PENDING)
   */
  private normalizeStatusCounts(counts: any[]): Record<string, number> {
    const result: Record<string, number> = {
      DELIVERED: 0,
      FAILED: 0,
      PENDING: 0,
      BOUNCED: 0,
      QUEUED: 0,
      SENT: 0,
    };

    counts.forEach((c: any) => {
      if (c.status === 'QUEUED' || c.status === 'PENDING') {
        result['PENDING'] += c._count;
      } else if (c.status in result) {
        result[c.status] = c._count;
      }
    });

    return result;
  }

  /**
   * Get notification counts by status with filters
   */
  async getStatusCounts(appId: string, filters: NotificationLogFilters) {
    return this.getStatusCountsOptimized(appId, filters);
  }

  /**
   * Get logs for export (optimized with selective field loading)
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
      include: {
        logs: { select: { id: true, status: true, channel: true, provider: true, response: true, createdAt: true } },
      },
    });
  }
}

export const notificationLogsRepository = new NotificationLogsRepository();
