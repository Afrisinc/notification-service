import { prismaWrite, prismaRead } from '@shared/database';

export class AccountRepository {
  async create(data: any) {
    return prismaWrite.account.create({ data });
  }

  async findById(id: string) {
    return prismaRead.account.findUnique({ where: { id } });
  }

  async findByIdWithProducts(id: string) {
    return prismaRead.account.findUnique({
      where: { id },
      include: {
        subscription: true,
      },
    });
  }

  async findByUserAndType(userId: string, type: string) {
    return prismaRead.account.findFirst({
      where: {
        owner_user_id: userId,
        type: type as any,
      },
    });
  }

  async findByUserId(userId: string) {
    return prismaRead.account.findMany({
      where: {
        owner_user_id: userId,
      },
      include: {
        subscription: true,
      },
    });
  }

  async findByOrganizationId(organizationId: string) {
    return prismaRead.account.findMany({
      where: {
        organization_id: organizationId,
      },
    });
  }

  async findMany(skip: number, take: number, where?: any) {
    return prismaRead.account.findMany({
      where,
      skip,
      take,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        subscription: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(where?: any) {
    return prismaRead.account.count({ where });
  }

  async update(id: string, data: any) {
    return prismaWrite.account.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prismaWrite.account.delete({ where: { id } });
  }

  async getUserAccounts(userId: string) {
    return prismaRead.account.findMany({
      where: {
        owner_user_id: userId,
      },
      include: {
        subscription: true,
      },
    });
  }

  async validateUserOwnsAccount(userId: string, accountId: string) {
    const account = await prismaRead.account.findUnique({
      where: { id: accountId },
    });
    return account?.owner_user_id === userId;
  }
}
