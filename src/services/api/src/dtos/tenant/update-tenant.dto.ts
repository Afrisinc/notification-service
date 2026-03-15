/**
 * Data Transfer Object for updating a tenant
 */
export interface UpdateTenantDTO {
  name?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
}
