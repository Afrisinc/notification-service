import { FastifyRequest } from "fastify";
import { logger } from "../config/logger";
import { tenantRepository } from "../repositories/tenant.repository";
import {
  TenantResponse,
  TenantWithApiKeysResponse,
  TenantListResponse,
} from "../dtos";

export class TenantDatabaseService {
  /**
   * Resolve tenant from request header
   */
  async resolveTenant(request: FastifyRequest): Promise<TenantResponse> {
    const tenantCode = request.headers["x-tenant-id"] as string;

    if (!tenantCode) {
      const error = new Error("Missing x-tenant-id header");
      logger.error({ error }, "Tenant ID header missing");
      throw error;
    }

    const tenant = await tenantRepository.findByCode(tenantCode);

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

    return tenant;
  }

  /**
   * Create a new tenant
   */
  async createTenant(data: { code: string; name: string }): Promise<TenantResponse> {
    const existingTenant = await tenantRepository.findByCode(data.code);

    if (existingTenant) {
      throw new Error(`Tenant with code ${data.code} already exists`);
    }

    const tenant = await tenantRepository.create(data);
    logger.info(
      { tenantId: tenant.id, code: tenant.code },
      "Tenant created via service",
    );
    return tenant;
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(
    tenantId: string,
  ): Promise<TenantWithApiKeysResponse | null> {
    return tenantRepository.findByIdWithApiKeys(tenantId);
  }

  /**
   * Get tenant by code
   */
  async getTenantByCode(code: string): Promise<TenantWithApiKeysResponse | null> {
    return tenantRepository.findByCodeWithApiKeys(code);
  }

  /**
   * List all tenants
   */
  async listTenants(
    limit = 20,
    offset = 0,
  ): Promise<TenantListResponse> {
    return tenantRepository.findMany(limit, offset);
  }

  /**
   * Update tenant
   */
  async updateTenant(
    tenantId: string,
    data: { name?: string; status?: "ACTIVE" | "SUSPENDED" },
  ): Promise<TenantResponse> {
    const tenant = await tenantRepository.update(tenantId, data);
    logger.info({ tenantId: tenant.id }, "Tenant updated via service");
    return tenant;
  }

  /**
   * Validate tenant access
   */
  async validateTenantAccess(
    tenantId: string,
    resourceTenantId: string,
  ): Promise<boolean> {
    return tenantId === resourceTenantId;
  }
}

export const tenantDbService = new TenantDatabaseService();
