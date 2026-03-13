import { randomBytes, createHash } from 'crypto';
import { logger } from '../config/logger';
import { apiKeyRepository } from '../repositories/api-key.repository';
import {
  CreateApiKeyResponse,
  GetApiKeyResponse,
  ListApiKeysItemResponse,
  RevokeApiKeyResponse,
  ValidateApiKeyResponse,
} from '../dtos';

export class ApiKeyService {
  /**
   * Generate a new API key (returns plaintext once)
   */
  private generateApiKey(): string {
    return `sk_${randomBytes(32).toString('hex')}`;
  }

  /**
   * Hash API key for storage
   */
  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Create API key for account
   */
  async createApiKey(account_id: string, name: string): Promise<CreateApiKeyResponse> {
    const plainKey = this.generateApiKey();
    const keyHash = this.hashApiKey(plainKey);

    const apiKey = await apiKeyRepository.create({
      keyHash,
      name,
      account_id,
    });

    logger.info({ apiKeyId: apiKey.id, account_id, keyName: name }, 'API key created');

    // Return plaintext key only once (user must save it)
    return {
      id: apiKey.id,
      plainKey,
      name: apiKey.name,
      createdAt: apiKey.createdAt,
      message: 'Save this key securely. You will not be able to see it again.',
    };
  }

  /**
   * Get API key details (without plaintext)
   */
  async getApiKey(apiKeyId: string, account_id: string): Promise<GetApiKeyResponse> {
    const apiKey = await apiKeyRepository.findById(apiKeyId);

    if (!apiKey) {
      throw new Error(`API key not found: ${apiKeyId}`);
    }

    if (apiKey.account_id !== account_id) {
      throw new Error('Access denied');
    }

    return apiKey;
  }

  /**
   * List API keys for account
   */
  async listApiKeys(account_id: string, includeRevoked = false): Promise<ListApiKeysItemResponse[]> {
    return apiKeyRepository.findByAccountId(account_id, includeRevoked);
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(apiKeyId: string, account_id: string): Promise<RevokeApiKeyResponse> {
    const apiKey = await apiKeyRepository.findById(apiKeyId);

    if (!apiKey) {
      throw new Error(`API key not found: ${apiKeyId}`);
    }

    if (apiKey.account_id !== account_id) {
      throw new Error('Access denied');
    }

    const revoked = await apiKeyRepository.revoke(apiKeyId);
    logger.info({ apiKeyId }, 'API key revoked');
    return revoked;
  }

  /**
   * Verify and validate API key
   */
  async validateApiKey(plainKey: string): Promise<ValidateApiKeyResponse | null> {
    const keyHash = this.hashApiKey(plainKey);

    const apiKey = await apiKeyRepository.findByHash(keyHash);

    if (!apiKey || apiKey.revoked) {
      return null;
    }

    // Update last used timestamp
    await apiKeyRepository.update(apiKey.id, { lastUsedAt: new Date() });

    return {
      account_id: apiKey.account_id,
      keyId: apiKey.id,
    };
  }
}

export const apiKeyService = new ApiKeyService();
