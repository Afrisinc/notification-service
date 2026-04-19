import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const SALT = 'afrisinc-notification-service'; // Fixed salt for key derivation
const TAG_LENGTH = 16;
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const encryptionKey = process.env.DATABASE_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('DATABASE_ENCRYPTION_KEY environment variable is not set');
  }

  if (encryptionKey.length !== 64) {
    throw new Error('DATABASE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(encryptionKey, 'hex');
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns format: `iv:authTag:ciphertext` (all hex encoded)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt()
 * Expects format: `iv:authTag:ciphertext` (all hex encoded)
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
