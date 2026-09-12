import crypto from 'node:crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '@shared/config';
import { logger } from '../config/logger';

const TIMESTAMP_TOLERANCE = 300; // 5 minutes, matches the gateway's tolerance

const verifySignature = (request: FastifyRequest, serviceSecret: string): string | null => {
  const signature = request.headers['x-gateway-signature'] as string;
  const timestamp = request.headers['x-gateway-timestamp'] as string;

  if (!signature || !timestamp) {
    return 'Missing gateway signature headers';
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const requestTime = Number.parseInt(timestamp, 10);

  if (Number.isNaN(requestTime) || Math.abs(currentTime - requestTime) > TIMESTAMP_TOLERANCE) {
    return 'Request timestamp is invalid or expired';
  }

  const path = request.url.split('?')[0];
  const body = request.body ? JSON.stringify(request.body) : '';
  const data = `${request.method}:${path}:${timestamp}:${body}`;
  const expected = crypto.createHmac('sha256', serviceSecret).update(data).digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return 'Invalid gateway signature';
  }

  return null;
};

/**
 * Rejects any request that didn't come through the API Gateway. Attach as a
 * `preValidation` hook (not `preHandler`) on routes that must be
 * gateway-only, e.g. the notify admin dashboard's endpoints - the platform
 * dashboard/clients/security/platform-email-settings/mail-alias routes are
 * not meant to be reachable by calling this service directly.
 *
 * Regular product endpoints (campaigns, templates, contacts, etc.) are
 * intentionally left off this guard since apps call them directly with an
 * API key via `flexAuthMiddleware`.
 *
 * Must run at `preValidation`, before this route's own schema
 * defaults/coercion can mutate `request.body` - a later hook (preHandler)
 * would see a mutated body and the signature would never match. See
 * [[Signature Mismatch Root Cause]].
 */
export async function verifyGatewaySignature(request: FastifyRequest, reply: FastifyReply) {
  const config = getConfig();
  const error = verifySignature(request, config.SERVICE_SECRET);

  if (error) {
    logger.warn({ ip: request.ip, path: request.url, reason: error }, 'Gateway signature verification failed');
    return reply.status(401).send({
      success: false,
      resp_code: 4010,
      resp_msg: 'Unauthorized - invalid gateway signature',
      error_msg: error,
    });
  }
}
