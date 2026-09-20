import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { ApiResponseHelper } from '../utils';
import { verifyRecipientToken } from '../utils/recipient-auth-utils';

/**
 * Validates a recipient mail-portal session token. Fully separate from
 * `validateBaseToken`/`authMiddleware` (business-user identity) - the two
 * token systems are not interchangeable, enforced by the `aud: 'recipient'`
 * claim checked inside `verifyRecipientToken`.
 */
export async function validateRecipientToken(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return ApiResponseHelper.unauthorized(reply, 'Missing authorization header');
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) {
    return ApiResponseHelper.unauthorized(reply, 'Missing bearer token');
  }

  const payload = verifyRecipientToken(token, 'recipient_session');
  if (!payload || !payload.sub) {
    logger.warn({ requestId: request.id }, 'Invalid or expired recipient token');
    return ApiResponseHelper.unauthorized(reply, 'Invalid or expired token');
  }

  (request as any).recipient = { id: payload.sub, email: payload.email };
}
