import { prismaWrite, prismaRead } from '@shared/database';
import { logger } from '../config/logger';

export class ApiKeyRepository {
  /**
   * Create a new API key
   */
  async create(data: {
    keyHash: string;
    name: string;
    account_id: string;
    app_id: string;
    type?: 'test' | 'production';
  }): Promise<{
    id: string;
    keyHash: string;
    name: string;
    type: string;
    account_id: string;
    app_id: string;
    revoked: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  }> {
    try {
      const apiKey = await prismaWrite.apiKey.create({
        data: {
          keyHash: data.keyHash,
          name: data.name,
          account_id: data.account_id,
          app_id: data.app_id,
          type: data.type || 'test',
        },
      });

      logger.info(
        { apiKeyId: apiKey.id, account_id: data.account_id, keyName: data.name },
        'API key created in repository'
      );
      return apiKey;
    } catch (error) {
      logger.error({ error, account_id: data.account_id }, 'Failed to create API key');
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
    type: string;
    account_id: string;
    app_id: string;
    revoked: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  } | null> {
    try {
      return (await prismaRead.apiKey.findUnique({
        where: { keyHash },
        select: {
          id: true,
          keyHash: true,
          name: true,
          type: true,
          account_id: true,
          app_id: true,
          revoked: true,
          createdAt: true,
          lastUsedAt: true,
        },
      })) as any;
    } catch (error) {
      logger.error({ error }, 'Failed to find API key by hash');
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
    type: string;
    account_id: string;
    app_id: string;
    revoked: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  } | null> {
    try {
      return await prismaRead.apiKey.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error({ error, id }, 'Failed to find API key by ID');
      throw error;
    }
  }

  /**
   * Find many API keys for an account
   */
  async findByAccountId(
    account_id: string,
    includeRevoked = false
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
      const apiKeys = await prismaRead.apiKey.findMany({
        where: {
          account_id,
          ...(includeRevoked ? {} : { revoked: false }),
        },
        select: {
          id: true,
          name: true,
          revoked: true,
          createdAt: true,
          lastUsedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      logger.debug({ account_id, count: apiKeys.length }, 'API keys fetched from repository');
      return apiKeys;
    } catch (error) {
      logger.error({ error, account_id }, 'Failed to find API keys by account');
      throw error;
    }
  }

  /**
   * Update API key (e.g., update lastUsedAt)
   */
  async update(
    id: string,
    data: { lastUsedAt?: Date; revoked?: boolean }
  ): Promise<{
    id: string;
    keyHash: string;
    name: string;
    type: string;
    account_id: string;
    app_id: string;
    revoked: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  }> {
    try {
      const apiKey = await prismaWrite.apiKey.update({
        where: { id },
        data,
      });

      logger.info({ apiKeyId: id }, 'API key updated in repository');
      return apiKey;
    } catch (error) {
      logger.error({ error, id }, 'Failed to update API key');
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
    type: string;
    account_id: string;
    app_id: string;
    revoked: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  }> {
    try {
      const apiKey = await prismaWrite.apiKey.update({
        where: { id },
        data: { revoked: true },
      });

      logger.info({ apiKeyId: id }, 'API key revoked in repository');
      return apiKey;
    } catch (error) {
      logger.error({ error, id }, 'Failed to revoke API key');
      throw error;
    }
  }
}

export const apiKeyRepository = new ApiKeyRepository();
