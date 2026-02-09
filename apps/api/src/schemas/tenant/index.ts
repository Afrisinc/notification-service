/**
 * Tenant module schemas - centralized exports
 * Professional organization following senior-level standards
 */

// Common schemas
export * from "./common.schema";

// Request schemas
export { createTenantRequestSchema } from "./requests/create";
export { updateTenantRequestSchema } from "./requests/update";
export { listTenantsQuerySchema } from "./requests/list";
export { createApiKeyRequestSchema } from "./requests/api-key-create";
export { listApiKeysQuerySchema } from "./requests/api-key-list";

// Response schemas
export {
  tenantResponseSchema,
  createTenantResponseSchema,
  getTenantResponseSchema,
  listTenantsResponseSchema,
  updateTenantResponseSchema,
} from "./responses/tenant";

export {
  apiKeyBodySchema,
  createApiKeyResponseSchema,
  listApiKeysResponseSchema,
  revokeApiKeyResponseSchema,
} from "./responses/api-key";
