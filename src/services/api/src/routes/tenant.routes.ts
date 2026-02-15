import { FastifyInstance } from "fastify";
import { TenantController } from "../controllers/tenant.controller";
import { asyncWrapper } from "../middlewares/async_wrapper.middleware";
import {
  CreateTenantRouteSchema,
  GetAllTenantsRouteSchema,
  GetTenantByIdRouteSchema,
  UpdateTenantRouteSchema,
  CreateApiKeyRouteSchema,
  GetApiKeysRouteSchema,
  RevokeApiKeyRouteSchema,
} from "../schemas/routes/tenant.schema";

/**
 * Tenant management routes
 * Note: In production, these should be protected with admin authentication
 */
export async function registerTenantRoutes(fastify: FastifyInstance) {
  const controller = new TenantController();
  // Create new tenant
  fastify.post(
    "/tenants",
    { schema: CreateTenantRouteSchema },
    asyncWrapper(controller.createTenant.bind(controller)),
  );

  // Get tenant by ID
  fastify.get(
    "/tenants/:id",
    { schema: GetTenantByIdRouteSchema },
    asyncWrapper(controller.getTenant.bind(controller)),
  );

  // Get all tenants (with pagination)
  fastify.get(
    "/tenants",
    { schema: GetAllTenantsRouteSchema },
    asyncWrapper(controller.listTenants.bind(controller)),
  );

  // Update tenant
  fastify.put(
    "/tenants/:id",
    { schema: UpdateTenantRouteSchema },
    asyncWrapper(controller.updateTenant.bind(controller)),
  );

  // Create new API key
  fastify.post(
    "/tenants/:id/api-keys",
    { schema: CreateApiKeyRouteSchema },
    asyncWrapper(controller.createApiKey.bind(controller)),
  );

  // Get API keys for tenant
  fastify.get(
    "/tenants/:id/api-keys",
    { schema: GetApiKeysRouteSchema },
    asyncWrapper(controller.listApiKeys.bind(controller)),
  );

  // Revoke API key
  fastify.delete(
    "/tenants/:id/api-keys/:keyId",
    { schema: RevokeApiKeyRouteSchema },
    asyncWrapper(controller.revokeApiKey.bind(controller)),
  );
}
