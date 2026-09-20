/**
 * Recipient Authentication Utilities
 * Token generation/verification for the recipient mail portal identity.
 * Kept separate from utils/auth-utils.ts business-user tokens - every token
 * here carries `aud: 'recipient'` so it can never be replayed against the
 * business-user auth endpoints (which issue tokens with no audience claim).
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const JWT_SECRET = env.JWT_SECRET || 'your-secret-key-change-in-production';
const RECIPIENT_AUDIENCE = 'recipient';

export type RecipientTokenType = 'recipient_bootstrap' | 'recipient_reset' | 'recipient_session';

export interface RecipientTokenPayload {
  sub?: string;
  email: string;
  type: RecipientTokenType;
  aud: typeof RECIPIENT_AUDIENCE;
}

/**
 * Bootstrap token: sent when someone with no RecipientIdentity yet requests
 * access to their mailbox. Not tied to a recipient id since none exists yet.
 */
export function generateRecipientBootstrapToken(email: string): string {
  return jwt.sign({ email, type: 'recipient_bootstrap', aud: RECIPIENT_AUDIENCE }, JWT_SECRET, { expiresIn: '7d' });
}

export function generateRecipientResetToken(recipientId: string, email: string): string {
  return jwt.sign({ sub: recipientId, email, type: 'recipient_reset', aud: RECIPIENT_AUDIENCE }, JWT_SECRET, {
    expiresIn: '24h',
  });
}

export function generateRecipientSessionToken(recipientId: string, email: string): string {
  return jwt.sign({ sub: recipientId, email, type: 'recipient_session', aud: RECIPIENT_AUDIENCE }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

/**
 * Verify a recipient token and assert it belongs to this identity system.
 * Returns null on any invalid signature, expiry, or missing/wrong audience.
 */
export function verifyRecipientToken(token: string, expectedType?: RecipientTokenType): RecipientTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as RecipientTokenPayload;
    if (payload.aud !== RECIPIENT_AUDIENCE) return null;
    if (expectedType && payload.type !== expectedType) return null;
    return payload;
  } catch {
    return null;
  }
}
