import { prismaWrite, prismaRead } from '@shared/database';

export class AuthorizationCodeRepository {
  async create(data: {
    code: string;
    user_id: string;
    product_code?: string;
    redirect_uri?: string;
    scope?: string;
    expires_at: Date;
  }) {
    return prismaWrite.authorizationCode.create({
      data,
    });
  }

  async findByCode(code: string) {
    return prismaRead.authorizationCode.findUnique({
      where: { code },
      include: {
        user: true,
      },
    });
  }

  async markAsUsed(codeId: string) {
    return prismaWrite.authorizationCode.update({
      where: { id: codeId },
      data: { used_at: new Date() },
    });
  }

  async deleteExpiredCodes() {
    return prismaWrite.authorizationCode.deleteMany({
      where: {
        expires_at: {
          lt: new Date(),
        },
      },
    });
  }
}
