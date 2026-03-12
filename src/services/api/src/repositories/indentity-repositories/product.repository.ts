import { prismaWrite, prismaRead } from '@shared/database';

export class ProductRepository {
  async create(data: any) {
    return prismaWrite.product.create({ data });
  }

  async findById(id: string) {
    return prismaRead.product.findUnique({ where: { id } });
  }

  async findByCode(code: string) {
    return prismaRead.product.findUnique({ where: { code } });
  }

  async findByCodeWithCallbacks(code: string) {
    return prismaRead.product.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        name: true,
        baseUrl: true,
        allowedCallbacks: true,
      },
    });
  }

  async findMany(skip: number, take: number, where?: any) {
    return prismaRead.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(where?: any) {
    return prismaRead.product.count({ where });
  }

  async update(id: string, data: any) {
    return prismaRead.product.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prismaRead.product.delete({ where: { id } });
  }

  async getAll() {
    return prismaRead.product.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }
}
