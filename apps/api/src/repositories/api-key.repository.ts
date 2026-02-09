import { db } from "@afrisinc-notify/db";
import { logger } from "../config/logger";

const prisma = db;

export class ApiKeyRepository {
  /**
   * Create a new API key
   */
  async create(data: {
    keyHash: string;
    name: string;
    tenantId: string;
  }): Promise<{
    id: string;
    keyHash: string;
    name: string;
    tenantId: string;
    revoked: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  }> {
    try {
      const apiKey = await prisma.apiKey.create({
        data: {
          keyHash: data.keyHash,
          name: data.name,
          tenantId: data.tenantId,
        },
      });

      logger.info(
        { apiKeyId: apiKey.id, tenantId: data.tenantId, keyName: data.name },
        "API key created in repository",
      );
      return apiKey;
    } catch (error) {
      logger.error(
        { error, tenantId: data.tenantId },
        "Failed to create API key",
      );
      throw error;
    }
  }

  /**
   * Find API key by hash
   */
  async findByHash(keyHash: string): Promise<{
    id: string;
    keyHash: string;
    name: string;
    tenantId: string;
    revoked: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  } | null> {
    try {
      return await prisma.apiKey.findUnique({
        where: { keyHash },
      });
    } catch (error) {
      logger.error({ error }, "Failed to find API key by hash");
      throw error;
    }
  }

  /**
   * Find API key by ID
   */
  async findById(id: string): Promise<{
    id: string;
    keyHash: string;
    name: string;
    tenantId: string;
    revoked: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  } | null> {
    try {
      return await prisma.apiKey.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error({ error, id }, "Failed to find API key by ID");
      throw error;
    }
  }

  /**
   * Find many API keys for a tenant
   */
  async findByTenantId(
    tenantId: string,
    includeRevoked = false,
  ): Promise<
    Array<{
      id: string;
      name: string;
      revoked: boolean;
      createdAt: Date;
      lastUsedAt: Date | null;
    }>
  > {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: {
          tenantId,
          ...(includeRevoked ? {} : { revoked: false }),
        },
        select: {
          id: true,
          name: true,
          revoked: true,
          createdAt: true,
          lastUsedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      logger.debug(
        { tenantId, count: apiKeys.length },
        "API keys fetched from repository",
      );
      return apiKeys;
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to find API keys by tenant");
      throw error;
    }
  }

  /**
   * Update API key (e.g., update lastUsedAt)
   */
  async update(
    id: string,
    data: { lastUsedAt?: Date; revoked?: boolean },
  ): Promise<{
    id: string;
    keyHash: string;
    name: string;
    tenantId: string;
    revoked: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  }> {
    try {
      const apiKey = await prisma.apiKey.update({
        where: { id },
        data,
      });

      logger.info({ apiKeyId: id }, "API key updated in repository");
      return apiKey;
    } catch (error) {
      logger.error({ error, id }, "Failed to update API key");
      throw error;
    }
  }

  /**
   * Revoke API key
   */
  async revoke(id: string): Promise<{
    id: string;
    keyHash: string;
    name: string;
    tenantId: string;
    revoked: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  }> {
    try {
      const apiKey = await prisma.apiKey.update({
        where: { id },
        data: { revoked: true },
      });

      logger.info({ apiKeyId: id }, "API key revoked in repository");
      return apiKey;
    } catch (error) {
      logger.error({ error, id }, "Failed to revoke API key");
      throw error;
    }
  }
}

export const apiKeyRepository = new ApiKeyRepository();
