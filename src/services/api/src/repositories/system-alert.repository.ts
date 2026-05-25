import { prismaWrite, prismaRead } from '@shared/database';
import { AlertType, AlertSeverity } from '@prisma/client';

export interface CreateAlertInput {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export class SystemAlertRepository {
  async create(input: CreateAlertInput) {
    return prismaWrite.systemAlert.create({
      data: {
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        metadata: input.metadata || {},
      },
    });
  }

  async findById(id: string) {
    return prismaRead.systemAlert.findUnique({ where: { id } });
  }

  async findRecent(limit = 50) {
    return prismaRead.systemAlert.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async findUnresolved() {
    return prismaRead.systemAlert.findMany({
      where: { resolved: false },
      orderBy: { created_at: 'desc' },
    });
  }

  async resolve(id: string, resolvedBy: string) {
    return prismaWrite.systemAlert.update({
      where: { id },
      data: {
        resolved: true,
        resolved_at: new Date(),
        resolved_by: resolvedBy,
      },
    });
  }
}

export const systemAlertRepository = new SystemAlertRepository();
