import crypto from 'crypto';

export interface SecretsProvider {
  getSecret(key: string): Promise<string | null>;
  setSecret?(key: string, value: string): Promise<void>;
  deleteSecret?(key: string): Promise<void>;
}

class EnvironmentSecretsProvider implements SecretsProvider {
  async getSecret(key: string): Promise<string | null> {
    return process.env[key] || null;
  }
}

interface CachedSecret {
  value: string;
  expiresAt: number;
}

class CachingSecretsProvider implements SecretsProvider {
  private cache: Map<string, CachedSecret> = new Map();
  private cacheTtlMs: number;

  constructor(
    private provider: SecretsProvider,
    cacheTtlMs: number = 5 * 60 * 1000
  ) {
    this.cacheTtlMs = cacheTtlMs;
  }

  async getSecret(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = await this.provider.getSecret(key);
    if (value) {
      this.cache.set(key, {
        value,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }

    return value;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}

let secretsProvider: SecretsProvider = new EnvironmentSecretsProvider();

export function initializeSecretsProvider(provider: SecretsProvider): void {
  secretsProvider = provider;
}

export function initializeWithCaching(provider: SecretsProvider, cacheTtlMs?: number): void {
  secretsProvider = new CachingSecretsProvider(provider, cacheTtlMs);
}

export async function getSecret(key: string): Promise<string | null> {
  return secretsProvider.getSecret(key);
}

export async function getRequiredSecret(key: string): Promise<string> {
  const value = await secretsProvider.getSecret(key);
  if (!value) {
    throw new Error(`Required secret "${key}" not found`);
  }
  return value;
}

export async function getSecretWithDefault(key: string, defaultValue: string): Promise<string> {
  const value = await secretsProvider.getSecret(key);
  return value || defaultValue;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

export async function encryptSecret(plaintext: string, masterKey: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512');
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  return combined.toString('base64');
}

export async function decryptSecret(ciphertext: string, masterKey: string): Promise<string> {
  const combined = Buffer.from(ciphertext, 'base64');

  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function maskSecret(secret: string, visibleChars: number = 4): string {
  if (!secret || secret.length <= visibleChars * 2) {
    return '*'.repeat(secret?.length || 8);
  }
  const start = secret.substring(0, visibleChars);
  const end = secret.substring(secret.length - visibleChars);
  const masked = '*'.repeat(Math.min(secret.length - visibleChars * 2, 20));
  return `${start}${masked}${end}`;
}

export function generateApiKey(prefix: string = 'sk'): string {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${prefix}_${randomPart}`;
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'key',
  'auth',
  'credential',
  'api_key',
  'apikey',
  'private',
  'bearer',
];

export function redactSensitiveData(obj: Record<string, any>, depth: number = 0): Record<string, any> {
  if (depth > 10) return obj;

  const redacted: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk));

    if (isSensitive && typeof value === 'string') {
      redacted[key] = maskSecret(value);
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = Array.isArray(value)
        ? value.map((item) => (typeof item === 'object' && item !== null ? redactSensitiveData(item, depth + 1) : item))
        : redactSensitiveData(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}
