/**
 * Data Transfer Object for creating a new tenant
 */
export interface CreateTenantDTO {
  code: string;
  name: string;
  accountId: string;
  accountType: 'INDIVIDUAL' | 'ORGANIZATION';
}
