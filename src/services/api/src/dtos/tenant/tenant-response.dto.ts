/**
 * Basic Tenant Response DTO
 */
export interface TenantResponse {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant with API Keys Response DTO
 */
export interface TenantWithApiKeysResponse extends TenantResponse {
  apiKeys: Array<{
    id: string;
    name: string;
    createdAt: Date;
    lastUsedAt: Date | null;
  }>;
}

/**
 * Single Tenant List Item Response DTO (with counts)
 */
export interface TenantListItemResponse {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: Date;
  _count: {
    apiKeys: number;
    templates: number;
    notifications: number;
  };
}

/**
 * Paginated Tenants List Response DTO
 */
export interface TenantListResponse {
  data: TenantListItemResponse[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}
