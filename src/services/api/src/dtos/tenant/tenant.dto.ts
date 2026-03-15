/**
 * Data Transfer Object for Tenant entity
 */
export interface TenantDTO {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Tenant DTO with counts for list operations
 */
export interface TenantListItemDTO extends TenantDTO {
  apiKeysCount: number;
  templatesCount: number;
  notificationsCount: number;
}
