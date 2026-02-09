/**
 * Create API Key Response DTO
 * Only returned once when creating a new API key
 */
export interface CreateApiKeyResponse {
  id: string;
  plainKey: string;
  name: string;
  createdAt: Date;
  message: string;
}

/**
 * Get API Key Response DTO (without plaintext key)
 */
export interface GetApiKeyResponse {
  id: string;
  keyHash: string;
  name: string;
  tenantId: string;
  revoked: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * List API Keys Item Response DTO
 */
export interface ListApiKeysItemResponse {
  id: string;
  name: string;
  revoked: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * Revoke API Key Response DTO
 */
export interface RevokeApiKeyResponse {
  id: string;
  keyHash: string;
  name: string;
  tenantId: string;
  revoked: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * Validate API Key Response DTO
 */
export interface ValidateApiKeyResponse {
  tenantId: string;
  keyId: string;
}
