/**
 * Authentication Utilities
 * Handles password hashing, JWT token generation and verification
 */

import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { env } from '../config/env';

const JWT_SECRET = env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRE = env.JWT_EXPIRE || '7d';

/**
 * Hash a password using bcryptjs
 * @param password Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

/**
 * Compare plain text password with hashed password
 * @param password Plain text password
 * @param hash Hashed password
 * @returns True if passwords match, false otherwise
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcryptjs.compare(password, hash);
  } catch {
    return false;
  }
}

/**
 * Generate a base token (multi-account token)
 * @param userId User ID
 * @param email User email
 * @param accountIds Array of account IDs
 * @returns JWT token string
 */
export function generateBaseToken(userId: string, email: string, accountIds: string[]): string {
  return jwt.sign(
    {
      sub: userId,
      email,
      type: 'base',
      account_ids: accountIds,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE } as any
  );
}

/**
 * Generate a product-scoped token
 * @param userId User ID
 * @param email User email
 * @param accountId Account ID
 * @param productId Product ID
 * @param tenantId Tenant ID (resource_id)
 * @returns JWT token string
 */
export function generateProductToken(
  userId: string,
  email: string,
  accountId: string,
  productId: string,
  tenantId: string
): string {
  return jwt.sign(
    {
      sub: userId,
      email,
      type: 'product',
      account_id: accountId,
      product: productId,
      resource_id: tenantId,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE } as any
  );
}

/**
 * Generate a reset token (short-lived, 24 hours)
 * @param userId User ID
 * @param email User email
 * @returns JWT token string
 */
export function generateResetToken(userId: string, email: string): string {
  return jwt.sign(
    {
      userId,
      email,
      type: 'reset',
    },
    JWT_SECRET,
    { expiresIn: '24h' } as any
  );
}

/**
 * Verify and decode JWT token
 * @param token JWT token string
 * @returns Decoded payload or null if verification fails
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Generate an authorization code for OAuth flow
 * Short alphanumeric code (16 characters)
 * @returns Authorization code
 */
export function generateAuthorizationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get expiration timestamp for authorization code (10 minutes)
 * @returns Date 10 minutes from now
 */
export function getAuthCodeExpiresAt(): Date {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 10);
  return now;
}
