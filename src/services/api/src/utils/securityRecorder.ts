/**
 * Security recording utilities
 * Tracks failed login attempts and security events
 */

import type { FastifyRequest } from 'fastify';
import { prismaWrite } from '@shared/database';

/**
 * Extract client IP address from FastifyRequest
 * Supports proxy headers (X-Forwarded-For, X-Real-IP)
 * @param req FastifyRequest object
 * @returns Client IP address or 'unknown'
 */
export function getClientIP(req: FastifyRequest): string {
  // Check X-Forwarded-For header (for proxied requests)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return (Array.isArray(ips) ? ips[0] : ips).trim();
  }

  // Check X-Real-IP header
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0];
  }

  // Fall back to socket address
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Record a failed login attempt
 * Used for security monitoring and rate limiting
 * @param email User email
 * @param ipAddress Client IP address
 * @param reason Reason for failure (e.g., 'Invalid credentials', 'Invalid password')
 * @param userId Optional user ID if user was found
 */
export async function recordLoginFailure(
  email: string,
  ipAddress: string,
  reason: string,
  userId?: string
): Promise<void> {
  try {
    // Attempt to record security event
    // Note: If the securityLog table doesn't exist in your schema, this will silently fail
    const db = prismaWrite as any;
    if (db.securityLog && typeof db.securityLog.create === 'function') {
      await db.securityLog.create({
        data: {
          event_type: 'LOGIN_FAILURE',
          email,
          ip_address: ipAddress,
          reason,
          user_id: userId || null,
          timestamp: new Date(),
        },
      });
    }
  } catch {
    // Silently fail if recording fails - don't block login process
  }
}
