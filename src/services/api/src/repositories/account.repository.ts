import { prismaRead, prismaWrite } from '@shared/database';

export class AccountRepository {
  /**
   * Create a new account
   */
  async create(data: {
    id?: string;
    owner_user_id: string;
    organization_id: string;
    type: 'INDIVIDUAL' | 'ORGANIZATION';
  }) {
    return prismaWrite.account.create({
      data,
    });
  }

  /**
   * Create account with specific select fields
   */
  async createWithSelect(
    data: {
      id?: string;
      owner_user_id: string;
      organization_id: string;
      type: 'INDIVIDUAL' | 'ORGANIZATION';
    },
    select?: any
  ) {
    return prismaWrite.account.create({
      data,
      select: select || { id: true },
    });
  }

  /**
   * Find account by ID
   */
  async findById(id: string) {
    return prismaRead.account.findUnique({
      where: { id },
    });
  }

  /**
   * Find accounts by organization ID
   */
  async findByOrganizationId(organizationId: string) {
    return prismaRead.account.findMany({
      where: { organization_id: organizationId },
    });
  }

  /**
   * Find accounts by owner (user) ID
   */
  async findByOwnerId(userId: string) {
    return prismaRead.account.findMany({
      where: { owner_user_id: userId },
    });
  }

  /**
   * Find account by owner and organization
   */
  async findByOwnerAndOrganization(userId: string, organizationId: string) {
    return prismaRead.account.findFirst({
      where: {
        owner_user_id: userId,
        organization_id: organizationId,
      },
    });
  }

  /**
   * Update account
   */
  async update(id: string, data: any) {
    return prismaWrite.account.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete account
   */
  async delete(id: string) {
    return prismaWrite.account.delete({
      where: { id },
    });
  }
}

export const accountRepository = new AccountRepository();
