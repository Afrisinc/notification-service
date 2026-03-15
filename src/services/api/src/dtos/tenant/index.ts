/**
 * Tenant DTOs - Data Transfer Objects for tenant operations
 */

// Request DTOs
export type { CreateTenantDTO } from './create-tenant.dto';
export type { UpdateTenantDTO } from './update-tenant.dto';
export type { CreateApiKeyDTO } from './create-api-key.dto';

// Entity DTOs
export type { TenantDTO, TenantListItemDTO } from './tenant.dto';
export type { ApiKeyDTO } from './api-key.dto';

// Query DTOs
export type { ListTenantsQueryDTO } from './list-tenants-query.dto';
export type { ListApiKeysQueryDTO } from './list-api-keys-query.dto';

// Service Response DTOs
export type {
  TenantResponse,
  TenantWithApiKeysResponse,
  TenantListItemResponse,
  TenantListResponse,
} from './tenant-response.dto';
export type {
  CreateApiKeyResponse,
  GetApiKeyResponse,
  ListApiKeysItemResponse,
  RevokeApiKeyResponse,
  ValidateApiKeyResponse,
} from './api-key-response.dto';
