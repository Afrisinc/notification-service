import { prismaWrite, prismaRead } from '@shared/database';

export class AppRepository {
  async create(data: any) {
    return prismaWrite.app.create({ data });
  }

  async findById(id: string) {
    return prismaRead.app.findUnique({ where: { id } });
  }

  async findByIdWithMetrics(id: string) {
    return prismaRead.app.findUnique({
      where: { id },
      include: {
        appTemplates: {
          select: { id: true },
        },
      },
    });
  }

  async findByAccountId(accountId: string) {
    return prismaRead.app.findMany({
      where: { account_id: accountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByOrganizationId(organizationId: string) {
    return prismaRead.app.findMany({
      where: { organization_id: organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByApiKey(apiKey: string) {
    return prismaRead.app.findUnique({
      where: { api_key: apiKey },
    });
  }

  async update(id: string, data: any) {
    return prismaWrite.app.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prismaWrite.app.delete({
      where: { id },
    });
  }

  async countTemplates(appId: string) {
    return prismaRead.appTemplate.count({
      where: { app_id: appId },
    });
  }

  async countApiKeys(accountId: string) {
    return prismaRead.apiKey.count({
      where: { account_id: accountId },
    });
  }

  async countNotifications(accountId: string) {
    return prismaRead.notification.count({
      where: { account_id: accountId },
    });
  }

  async validateOwnership(appId: string, accountId: string): Promise<boolean> {
    const app = await prismaRead.app.findUnique({
      where: { id: appId },
    });

    if (!app) {
      return false;
    }

    // Verify account belongs to same organization as app
    const account = await prismaRead.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return false;
    }

    return app.organization_id === account.organization_id;
  }

  async findAccountById(id: string) {
    return prismaRead.account.findUnique({
      where: { id },
      select: {
        id: true,
        organization_id: true,
      },
    });
  }

  async findAccountByUserAndOrganization(userId: string, organizationId: string) {
    return prismaRead.account.findFirst({
      where: {
        owner_user_id: userId,
        organization_id: organizationId,
      },
      select: {
        id: true,
        organization_id: true,
      },
    });
  }

  async getAccountIdByAppId(appId: string): Promise<string | null> {
    const app = await prismaRead.app.findUnique({
      where: { id: appId },
      select: { account_id: true },
    });
    return app?.account_id || null;
  }
}

export const appRepository = new AppRepository();
