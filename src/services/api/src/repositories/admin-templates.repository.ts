import type { Channel, Prisma } from '@prisma/client';
import { prismaRead } from '@shared/database';

export interface AdminTemplateFilters {
  limit: number;
  offset: number;
  search?: string;
  channel?: Channel;
  active?: boolean;
}

export interface AdminTemplateRow {
  id: string;
  account_id: string;
  code: string;
  channel: Channel;
  active: boolean;
  tags: string[];
  updatedAt: Date;
}

export class AdminTemplatesRepository {
  static async getTemplates(filters: AdminTemplateFilters): Promise<{ templates: AdminTemplateRow[]; total: number }> {
    const where: Prisma.TemplateWhereInput = { deletedAt: null };

    if (filters.channel) {
      where.channel = filters.channel;
    }

    if (filters.active !== undefined) {
      where.active = filters.active;
    }

    if (filters.search) {
      const search = filters.search;
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { account: { owner: { firstName: { contains: search, mode: 'insensitive' } } } },
        { account: { owner: { lastName: { contains: search, mode: 'insensitive' } } } },
        { account: { organization: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [templates, total] = await prismaRead.$transaction([
      prismaRead.template.findMany({
        where,
        select: {
          id: true,
          account_id: true,
          code: true,
          channel: true,
          active: true,
          tags: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: filters.offset,
        take: filters.limit,
      }),
      prismaRead.template.count({ where }),
    ]);

    return { templates, total };
  }

  static async getStats(): Promise<{ total: number; active: number }> {
    const [total, active] = await prismaRead.$transaction([
      prismaRead.template.count({ where: { deletedAt: null } }),
      prismaRead.template.count({ where: { deletedAt: null, active: true } }),
    ]);

    return { total, active };
  }

  /**
   * Batched usage counts for a set of template ids - one query for every
   * template on the page instead of one query per template.
   */
  static async getUsageCounts(templateIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (templateIds.length === 0) return counts;

    const rows = await prismaRead.notification.groupBy({
      by: ['templateId'],
      where: { templateId: { in: templateIds } },
      _count: true,
    });

    rows.forEach((row) => {
      if (row.templateId) {
        counts.set(row.templateId, row._count);
      }
    });

    return counts;
  }
}

export const adminTemplatesRepository = new AdminTemplatesRepository();
