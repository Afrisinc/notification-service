import { prismaWrite, prismaRead } from '@shared/database';

export class OrganizationRepository {
  async create(data: any) {
    return prismaWrite.organization.create({ data });
  }

  async findById(id: string) {
    return prismaRead.organization.findUnique({ where: { id } });
  }

  async findByIdWithMembers(id: string) {
    return prismaRead.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async findMany(skip: number, take: number, where?: any) {
    return prismaRead.organization.findMany({
      where,
      skip,
      take,
      include: {
        members: {
          select: {
            id: true,
            user_id: true,
            role: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          where: {
            role: 'OWNER',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(where?: any) {
    return prismaRead.organization.count({ where });
  }

  async update(id: string, data: any) {
    return prismaWrite.organization.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prismaWrite.organization.delete({ where: { id } });
  }

  async addMember(organizationId: string, userId: string, role: string) {
    return prismaWrite.organizationMember.create({
      data: {
        organization_id: organizationId,
        user_id: userId,
        role: role as any,
      },
    });
  }

  async removeMember(organizationId: string, userId: string) {
    return prismaWrite.organizationMember.deleteMany({
      where: {
        organization_id: organizationId,
        user_id: userId,
      },
    });
  }

  async getMember(organizationId: string, userId: string) {
    return prismaRead.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: organizationId,
          user_id: userId,
        },
      },
    });
  }
}
