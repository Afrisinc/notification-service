import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { tenantDbService } from '../services/tenant.db.service';
import { apiKeyService } from '../services/api-key.service';
import { ApiResponseHelper } from '../utils';
import { CreateTenantDTO, UpdateTenantDTO, ListTenantsQueryDTO, ListApiKeysQueryDTO, CreateApiKeyDTO } from '../dtos';

export class TenantController {
  /**
   * Create new tenant
   */
  async createTenant(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { code, name, accountId, accountType } = request.body as CreateTenantDTO;

      const tenant = await tenantDbService.createTenant({
        code,
        name,
        accountId,
        accountType,
      });

      logger.info({ tenantId: tenant.id }, 'Tenant created');

      return ApiResponseHelper.created(reply, 'Tenant created successfully', {
        id: tenant.id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to create tenant');

      if (errorMessage.includes('already exists')) {
        return ApiResponseHelper.duplicate(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Get tenant details
   */
  async getTenant(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      const tenant = await tenantDbService.getTenantById(id);

      if (!tenant) {
        return ApiResponseHelper.notFound(reply, 'Tenant not found');
      }

      return ApiResponseHelper.success(reply, 'Tenant retrieved', {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
        account_id: tenant.accountId,
        account_type: tenant.accountType,
        status: tenant.status,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        apiKeysCount: tenant.apiKeys.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to get tenant');
      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * List all tenants
   */
  async listTenants(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { limit, offset } = request.query as Record<string, string | undefined>;

      const result = await tenantDbService.listTenants(
        limit ? parseInt(limit, 10) : 20,
        offset ? parseInt(offset, 10) : 0
      );

      return ApiResponseHelper.success(reply, 'Tenants listed', {
        data: result.data.map((t: (typeof result.data)[0]) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          account_id: t.accountId,
          account_type: t.accountType,
          status: t.status,
          createdAt: t.createdAt,
          apiKeysCount: t._count.apiKeys,
          templatesCount: t._count.templates,
          notificationsCount: t._count.notifications,
        })),
        meta: result.meta,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to list tenants');
      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { name, status } = request.body as UpdateTenantDTO;

      const tenant = await tenantDbService.updateTenant(id, {
        ...(name ? { name } : {}),
        ...(status ? { status } : {}),
      });

      logger.info({ tenantId: tenant.id }, 'Tenant updated');

      return ApiResponseHelper.updated(reply, 'Tenant updated successfully', {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
        account_id: tenant.accountId,
        account_type: tenant.accountType,
        status: tenant.status,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to update tenant');
      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Create API key for tenant
   */
  async createApiKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { name } = request.body as CreateApiKeyDTO;

      if (!name) {
        return ApiResponseHelper.missingFields(reply, 'API key name is required');
      }

      const apiKey = await apiKeyService.createApiKey(id, name);

      logger.info({ tenantId: id, apiKeyId: apiKey.id }, 'API key created for tenant');

      return ApiResponseHelper.created(reply, 'API key created successfully', {
        id: apiKey.id,
        plainKey: apiKey.plainKey,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
        message: apiKey.message,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to create API key');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * List API keys for tenant
   */
  async listApiKeys(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const query = request.query as Record<string, string | undefined>;
      const includeRevoked = query.includeRevoked;

      const apiKeys = await apiKeyService.listApiKeys(id, includeRevoked === 'true');

      return ApiResponseHelper.success(reply, 'API keys listed', {
        data: apiKeys,
        count: apiKeys.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to list API keys');
      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id, keyId } = request.params as { id: string; keyId: string };

      await apiKeyService.revokeApiKey(keyId, id);

      logger.info({ tenantId: id, apiKeyId: keyId }, 'API key revoked');

      return ApiResponseHelper.success(reply, 'API key revoked successfully', {
        message: 'API key has been revoked and can no longer be used',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to revoke API key');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, errorMessage);
      }

      if (errorMessage.includes('Access denied')) {
        return ApiResponseHelper.forbidden(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }
}

export const tenantController = new TenantController();
