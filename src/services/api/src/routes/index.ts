/**
 * API Routes Index - Centralized route registration
 * All API v1 routes are registered through this module
 */

import { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.routes";
import { registerTenantRoutes } from "./tenant.routes";
import { registerNotifyRoutes } from "./notify.routes";
import { registerTemplateRoutes } from "./template.routes";

//  Register all API v1 routes
export async function v1Routes(fastify: FastifyInstance) {
  await fastify.register(registerHealthRoutes, {
    prefix: "/health",
  });

  await fastify.register(registerTenantRoutes, {
    prefix: "/admin",
  });

  await fastify.register(registerNotifyRoutes, {
    prefix: "/api",
  });

  await fastify.register(registerTemplateRoutes, {
    prefix: "/api",
  });
}
