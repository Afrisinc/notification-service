import { FastifyRequest } from "fastify";
import { db } from "@shared/db";
import { logger } from "../config/logger";

export interface Tenant {
  id: string;
  name: string;
  active: boolean;
}

export class TenantService {
  async resolveTenant(request: FastifyRequest): Promise<Tenant> {
    const tenantCode = request.headers["x-tenant-id"] as string;

    if (!tenantCode) {
      const error = new Error("Missing x-tenant-id header");
      logger.error({ error }, "Tenant ID header missing");
      throw error;
    }

    console.log("Resolving tenant for code:", tenantCode);

    try {
      const tenant = await db.tenant.findUnique({
        where: { code: tenantCode },
      });

      console.log("Tenant lookup result:", tenant);

      if (!tenant) {
        const error = new Error(`Tenant not found: ${tenantCode}`);
        logger.error({ tenantCode }, "Tenant not found");
        throw error;
      }

      if (tenant.status !== "ACTIVE") {
        const error = new Error(`Tenant is inactive: ${tenantCode}`);
        logger.error({ tenantCode }, "Tenant is inactive");
        throw error;
      }

      return {
        id: tenant.id,
        name: tenant.name,
        active: tenant.status === "ACTIVE",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: errorMessage, tenantCode },
        "Failed to resolve tenant"
      );
      throw error;
    }
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    try {
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        return null;
      }

      return {
        id: tenant.id,
        name: tenant.name,
        active: tenant.status === "ACTIVE",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: errorMessage, tenantId },
        "Failed to get tenant by ID"
      );
      return null;
    }
  }

  async validateTenantAccess(
    tenantId: string,
    resourceTenantId: string,
  ): Promise<boolean> {
    return tenantId === resourceTenantId;
  }
}

export const tenantService = new TenantService();
