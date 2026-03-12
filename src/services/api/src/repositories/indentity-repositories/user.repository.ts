import { prismaWrite, prismaRead } from '@shared/database';

export class UserRepository {
  async findByEmail(email: string) {
    return prismaRead.user.findUnique({ where: { email } });
  }

  async create(data: any) {
    return prismaWrite.user.create({ data });
  }

  async updatePassword(userId: string, newPassword: string) {
    return prismaWrite.user.update({
      where: { id: userId },
      data: { password_hash: newPassword },
    });
  }

  async findById(id: string) {
    return prismaRead.user.findUnique({ where: { id } });
  }

  async findMany(skip: number, take: number, search?: string, status?: string) {
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' as const } },
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const users = await prismaRead.user.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        location: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        loginEvents: {
          select: {
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => ({
      ...user,
      lastLogin: user.loginEvents[0]?.createdAt || null,
      loginEvents: undefined,
    }));
  }

  async count(search?: string, status?: string) {
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' as const } },
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    if (status) {
      where.status = status;
    }

    return prismaRead.user.count({ where });
  }

  async updateUser(id: string, data: any) {
    return prismaWrite.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getUserWithAccounts(userId: string) {
    return prismaRead.user.findUnique({
      where: { id: userId },
      include: {
        accounts: true,
      },
    });
  }

  async recordLoginEvent(userId: string, ipAddress: string) {
    return prismaWrite.loginEvent.create({
      data: {
        user_id: userId,
        status: 'success',
        ip: ipAddress,
      },
    });
  }

  async getLastLogin(userId: string) {
    return prismaRead.loginEvent.findFirst({
      where: {
        user_id: userId,
        status: 'success',
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
