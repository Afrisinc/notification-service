import { db } from "@shared/db";
import { logger } from "../config/logger";

const prisma = db;

export class TenantRepository {
  /**
   * Find tenant by code
   */
  async findByCode(code: string): Promise<{
    id: string;
    code: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      return await prisma.tenant.findUnique({
        where: { code },
      });
    } catch (error) {
      logger.error({ error, code }, "Failed to find tenant by code");
      throw error;
    }
  }

  /**
   * Find tenant by ID
   */
  async findById(id: string): Promise<{
    id: string;
    code: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      return await prisma.tenant.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error({ error, id }, "Failed to find tenant by ID");
      throw error;
    }
  }

  /**
   * Find tenant by ID with API keys
   */
  async findByIdWithApiKeys(id: string): Promise<{
    id: string;
    code: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    apiKeys: Array<{
      id: string;
      name: string;
      createdAt: Date;
      lastUsedAt: Date | null;
    }>;
  } | null> {
    try {
      return await prisma.tenant.findUnique({
        where: { id },
        include: {
          apiKeys: {
            where: { revoked: false },
            select: {
              id: true,
              name: true,
              createdAt: true,
              lastUsedAt: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error({ error, id }, "Failed to find tenant with API keys");
      throw error;
    }
  }

  /**
   * Find tenant by code with API keys
   */
  async findByCodeWithApiKeys(code: string): Promise<{
    id: string;
    code: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    apiKeys: Array<{
      id: string;
      name: string;
      createdAt: Date;
      lastUsedAt: Date | null;
    }>;
  } | null> {
    try {
      return await prisma.tenant.findUnique({
        where: { code },
        include: {
          apiKeys: {
            where: { revoked: false },
            select: {
              id: true,
              name: true,
              createdAt: true,
              lastUsedAt: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error(
        { error, code },
        "Failed to find tenant by code with API keys",
      );
      throw error;
    }
  }

  /**
   * Create a new tenant
   */
  async create(data: { code: string; name: string }): Promise<{
    id: string;
    code: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    try {
      const tenant = await prisma.tenant.create({
        data: {
          code: data.code,
          name: data.name,
          status: "ACTIVE",
        },
      });

      logger.info(
        { tenantId: tenant.id, code: tenant.code },
        "Tenant created in repository",
      );
      return tenant;
    } catch (error) {
      logger.error({ error, code: data.code }, "Failed to create tenant");
      throw error;
    }
  }

  /**
   * Update tenant
   */
  async update(
    id: string,
    data: { name?: string; status?: "ACTIVE" | "SUSPENDED" },
  ): Promise<{
    id: string;
    code: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    try {
      const tenant = await prisma.tenant.update({
        where: { id },
        data,
      });

      logger.info({ tenantId: id }, "Tenant updated in repository");
      return tenant;
    } catch (error) {
      logger.error({ error, id }, "Failed to update tenant");
      throw error;
    }
  }

  /**
   * List all tenants with pagination
   */
  async findMany(
    limit = 20,
    offset = 0,
  ): Promise<{
    data: Array<{
      id: string;
      code: string;
      name: string;
      status: string;
      createdAt: Date;
      _count: { apiKeys: number; templates: number; notifications: number };
    }>;
    meta: { limit: number; offset: number; total: number };
  }> {
    try {
      const [data, total] = await Promise.all([
        prisma.tenant.findMany({
          skip: offset,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: { apiKeys: true, templates: true, notifications: true },
            },
          },
        }),
        prisma.tenant.count(),
      ]);

      logger.debug({ limit, offset, total }, "Tenants fetched from repository");
      return { data, meta: { limit, offset, total } };
    } catch (error) {
      logger.error({ error, limit, offset }, "Failed to list tenants");
      throw error;
    }
  }
}

export const tenantRepository = new TenantRepository();
