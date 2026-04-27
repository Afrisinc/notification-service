import type { FastifyRequest, FastifyReply } from 'fastify';
import { apiKeyService } from '../services/api-key.service';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { logger } from '../config/logger';
import { ApiResponseHelper } from '../utils';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

export class ApiKeyController {
  /**
   * Create a new API key for app
   */
  async createApiKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId, appId } = request.params as { orgId: string; appId: string };
      const { name, type = 'test' } = request.body as { name: string; type?: 'test' | 'production' };

      // Get account from token
      const account_id = (request as any).headers['x-account-id'] || (request as any).accountId;
      if (!account_id) {
        return ApiResponseHelper.unauthorized(reply, 'Unauthorized');
      }

      const result = await apiKeyService.createApiKey(account_id, appId, name, type);

      logger.info({ keyId: result.id, appId, orgId, userId: (request as any).userId }, 'API key created');

      // Track usage
      await UsageTrackingService.recordUsage(account_id, appId, 'api_keys', 1);

      return ApiResponseHelper.success(reply, 'API key created successfully', result, 201);
    } catch (error) {
      logger.error({ error: getErrorMessage(error) }, 'Failed to create API key');
      return ApiResponseHelper.badRequest(reply, getErrorMessage(error));
    }
  }

  /**
   * List API keys for app
   */
  async listApiKeys(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId, appId } = request.params as { orgId: string; appId: string };
      const { includeRevoked = false } = request.query as {
        includeRevoked?: boolean;
      };

      // Get account from token
      const account_id = (request as any).accountId;
      if (!account_id) {
        return ApiResponseHelper.unauthorized(reply, 'Unauthorized');
      }

      const keys = await apiKeyService.listApiKeys(account_id, includeRevoked);

      return ApiResponseHelper.success(reply, 'API keys retrieved successfully', {
        appId,
        keys,
        total: keys.length,
      });
    } catch (error) {
      logger.error({ error: getErrorMessage(error) }, 'Failed to list API keys');
      return ApiResponseHelper.badRequest(reply, getErrorMessage(error));
    }
  }

  /**
   * Get API key details
   */
  async getApiKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId, appId, keyId } = request.params as {
        orgId: string;
        appId: string;
        keyId: string;
      };

      // Get account from token
      const account_id = (request as any).accountId;
      if (!account_id) {
        return ApiResponseHelper.unauthorized(reply, 'Unauthorized');
      }

      const apiKey = await apiKeyService.getApiKey(keyId, account_id);

      return ApiResponseHelper.success(reply, 'API key retrieved successfully', apiKey);
    } catch (error) {
      if (getErrorMessage(error).includes('not found')) {
        return ApiResponseHelper.notFound(reply, getErrorMessage(error));
      }
      logger.error({ error: getErrorMessage(error) }, 'Failed to get API key');
      return ApiResponseHelper.badRequest(reply, getErrorMessage(error));
    }
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orgId, appId, keyId } = request.params as {
        orgId: string;
        appId: string;
        keyId: string;
      };

      // Get account from token
      const account_id = (request as any).accountId;
      if (!account_id) {
        return ApiResponseHelper.unauthorized(reply, 'Unauthorized');
      }

      const result = await apiKeyService.revokeApiKey(keyId, account_id);

      logger.info({ keyId, orgId, appId, userId: (request as any).userId }, 'API key revoked');

      return ApiResponseHelper.success(reply, 'API key revoked successfully', result);
    } catch (error) {
      if (getErrorMessage(error).includes('not found')) {
        return ApiResponseHelper.notFound(reply, getErrorMessage(error));
      }
      logger.error({ error: getErrorMessage(error) }, 'Failed to revoke API key');
      return ApiResponseHelper.badRequest(reply, getErrorMessage(error));
    }
  }
}
