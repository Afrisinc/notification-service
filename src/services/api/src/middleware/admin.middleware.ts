import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiResponseHelper } from '../utils/api-response';
import { logger } from '../config/logger';

/**
 * Admin authentication middleware
 * Verifies that the user is an admin before allowing access to admin endpoints
 */
export const adminGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // User should already be authenticated via validateBaseToken
    // Check if user has admin role
    const userRole = (request as any).user?.role;
    const userEmail = (request as any).user?.email;

    if (!userRole) {
      logger.warn({ correlationId: request.id }, 'Admin guard: User role not found in token');
      return ApiResponseHelper.unauthorized(reply, 'User role not found');
    }

    // Check for admin role (case-insensitive)
    const isAdmin = userRole.toUpperCase() === 'ADMIN' || userRole.toUpperCase() === 'SUPERADMIN';

    if (!isAdmin) {
      logger.warn({ userEmail, userRole, correlationId: request.id }, 'Admin guard: User is not an admin');
      return ApiResponseHelper.error(
        reply,
        'Admin access required. Your account does not have admin privileges.',
        4030,
        403
      );
    }

    logger.debug({ userEmail, correlationId: request.id }, 'Admin guard: Access granted');
  } catch (error) {
    logger.error({ error, correlationId: request.id }, 'Admin guard: Error during authentication');
    return ApiResponseHelper.unauthorized(reply, 'Authentication failed');
  }
};

/**
 * Optional: Rate limiting middleware for admin endpoints
 * Prevents spam/abuse of admin management endpoints
 */
export const adminRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
  // This would typically use Redis or in-memory cache
  // For now, we'll leave it as a placeholder
  // Implementation would depend on your rate-limiting strategy
};
