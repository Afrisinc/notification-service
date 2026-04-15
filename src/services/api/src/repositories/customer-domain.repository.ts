import { prismaRead, prismaWrite } from '@shared/database';
import { CustomerDomainStatus } from '@prisma/client';

export interface CreateCustomerDomainInput {
  app_id: string;
  domain: string;
  from_name: string;
  from_email: string;
  selector: string;
  public_key: string;
  private_key_path: string;
}

export interface UpdateCustomerDomainInput {
  from_name?: string;
  from_email?: string;
}

export interface DomainVerificationUpdate {
  spf_verified?: boolean;
  dkim_verified?: boolean;
  dmarc_verified?: boolean;
  status?: CustomerDomainStatus;
  verified_at?: Date;
}

export class CustomerDomainRepository {
  /**
   * Create a new customer domain
   */
  async create(data: CreateCustomerDomainInput) {
    return prismaWrite.customerDomain.create({
      data: {
        app_id: data.app_id,
        domain: data.domain,
        from_name: data.from_name,
        from_email: data.from_email,
        selector: data.selector,
        public_key: data.public_key,
        private_key_path: data.private_key_path,
        status: 'pending',
      },
    });
  }

  /**
   * Find domain by ID belonging to an app
   */
  async findById(id: string, appId: string) {
    return prismaRead.customerDomain.findFirst({
      where: { id, app_id: appId },
    });
  }

  /**
   * Find domain by domain name
   */
  async findByDomain(domain: string) {
    return prismaRead.customerDomain.findUnique({
      where: { domain },
    });
  }

  /**
   * Find verified domain for an app
   */
  async findVerifiedDomainByAppId(appId: string) {
    return prismaRead.customerDomain.findFirst({
      where: {
        app_id: appId,
        status: 'verified',
      },
    });
  }

  /**
   * List all domains for an app
   */
  async listByAppId(appId: string) {
    return prismaRead.customerDomain.findMany({
      where: { app_id: appId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update domain verification status
   */
  async updateVerification(id: string, data: DomainVerificationUpdate) {
    return prismaWrite.customerDomain.update({
      where: { id },
      data: {
        spf_verified: data.spf_verified,
        dkim_verified: data.dkim_verified,
        dmarc_verified: data.dmarc_verified,
        status: data.status,
        verified_at: data.verified_at,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update domain from name and email
   */
  async update(id: string, data: UpdateCustomerDomainInput) {
    return prismaWrite.customerDomain.update({
      where: { id },
      data: {
        from_name: data.from_name,
        from_email: data.from_email,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete a domain
   */
  async delete(id: string) {
    return prismaWrite.customerDomain.delete({
      where: { id },
    });
  }

  /**
   * Check if domain is already registered
   */
  async domainExists(domain: string): Promise<boolean> {
    const count = await prismaRead.customerDomain.count({
      where: { domain },
    });
    return count > 0;
  }
}

export const customerDomainRepository = new CustomerDomainRepository();
