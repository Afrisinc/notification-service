/**
 * Tenant route schemas - combines request/response for Fastify routes
 */

import {
  tenantIdParamSchema,
  createTenantRequestSchema,
  createTenantResponseSchema,
  getTenantResponseSchema,
  listTenantsQuerySchema,
  listTenantsResponseSchema,
  updateTenantRequestSchema,
  updateTenantResponseSchema,
  createApiKeyRequestSchema,
  createApiKeyResponseSchema,
  listApiKeysQuerySchema,
  listApiKeysResponseSchema,
  revokeApiKeyResponseSchema,
} from "../tenant";

// Tenant operations

export const CreateTenantRouteSchema = {
  description: "Create a new tenant",
  tags: ["Admin - Tenants"],
  body: createTenantRequestSchema,
  response: {
    201: createTenantResponseSchema,
  },
};

export const GetAllTenantsRouteSchema = {
  description: "List all tenants",
  tags: ["Admin - Tenants"],
  querystring: listTenantsQuerySchema,
  response: {
    200: listTenantsResponseSchema,
  },
};

export const GetTenantByIdRouteSchema = {
  description: "Get tenant details by ID",
  tags: ["Admin - Tenants"],
  params: tenantIdParamSchema,
  response: {
    200: getTenantResponseSchema,
  },
};

export const UpdateTenantRouteSchema = {
  description: "Update tenant",
  tags: ["Admin - Tenants"],
  params: tenantIdParamSchema,
  body: updateTenantRequestSchema,
  response: {
    200: updateTenantResponseSchema,
  },
};

// API Key operations

export const CreateApiKeyRouteSchema = {
  description: "Create API key for tenant",
  tags: ["Admin - API Keys"],
  params: tenantIdParamSchema,
  body: createApiKeyRequestSchema,
  response: {
    201: createApiKeyResponseSchema,
  },
};

export const GetApiKeysRouteSchema = {
  description: "List API keys for tenant",
  tags: ["Admin - API Keys"],
  params: tenantIdParamSchema,
  querystring: listApiKeysQuerySchema,
  response: {
    200: listApiKeysResponseSchema,
  },
};

export const RevokeApiKeyRouteSchema = {
  description: "Revoke API key",
  tags: ["Admin - API Keys"],
  params: {
    type: "object",
    properties: {
      id: { type: "string", description: "Tenant ID" },
      keyId: { type: "string", description: "API Key ID" },
    },
    required: ["id", "keyId"],
  },
  response: {
    204: revokeApiKeyResponseSchema,
  },
};
