import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtDecode } from 'jwt-decode';
import { logger } from '../config/logger';
import { tenantRepository } from '../repositories/tenant.repository';
import { ApiResponseHelper } from '../utils';

/**
 * JWT Payload interface extracted from token
 */
interface JWTPayload {
  sub: string;
  email: string;
  account_id: string;
  account_type: 'INDIVIDUAL' | 'ORGANIZATION';
  product: string;
  resource_id: string;
  role: string;
  type: string;
  iat: number;
  exp: number;
}

/**
 * Validate JWT token and extract tenant context from resource_id
 *
 * Functionality:
 * - Expects Bearer token with JWT format
 * - Decodes JWT without signature verification (assumes trusted issuer)
 * - Extracts resource_id (tenant ID) from JWT payload
 * - Validates tenant exists in database
 * - Validates tenant is active
 * - Sets x-tenant-id header from resource_id (replaces x-tenant-id header requirement)
 * - Sets user context headers for logging and downstream handlers
 *
 * JWT Payload Required Fields:
 * - resource_id: UUID of tenant
 * - exp: Token expiration time (Unix timestamp)
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    logger.warn({ requestId: request.id }, 'Missing authorization header');
    ApiResponseHelper.unauthorized(reply, 'Missing authorization header');
    return;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer') {
    logger.warn({ requestId: request.id }, 'Invalid authorization scheme');
    ApiResponseHelper.unauthorized(reply, 'Invalid authorization scheme');
    return;
  }

  if (!token) {
    logger.warn({ requestId: request.id }, 'Missing bearer token');
    ApiResponseHelper.unauthorized(reply, 'Missing bearer token');
    return;
  }

  try {
    // Decode JWT token (without signature verification - assumes trusted issuer)
    const payload = jwtDecode<JWTPayload>(token);

    // Validate token is not expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      logger.warn({ requestId: request.id }, 'Token has expired');
      ApiResponseHelper.tokenExpired(reply, 'Token has expired');
      return;
    }

    // Extract resource_id from token (this is the tenant ID)
    const resourceId = payload.resource_id;

    if (!resourceId) {
      logger.warn({ requestId: request.id }, 'Token missing required resource_id claim');
      ApiResponseHelper.tokenInvalid(reply, 'Token missing required resource_id claim');
      return;
    }

    // Validate tenant exists in database
    const tenant = await tenantRepository.findById(resourceId);

    if (!tenant) {
      logger.warn({ requestId: request.id, resourceId }, 'Tenant not found for provided resource_id');
      ApiResponseHelper.notFound(reply, 'Tenant not found for provided resource_id');
      return;
    }

    // Validate tenant is active
    if (tenant.status !== 'ACTIVE') {
      logger.warn({ requestId: request.id, tenantId: resourceId }, 'Tenant is not active');
      ApiResponseHelper.forbidden(reply, 'Tenant is not active');
      return;
    }

    // Set tenant context from JWT resource_id
    // This replaces the need for x-tenant-id header in client requests
    request.headers['x-tenant-id'] = resourceId;

    // Set user context headers for logging, audit, and downstream handlers
    request.headers['x-user-id'] = payload.sub;
    request.headers['x-user-email'] = payload.email;
    request.headers['x-user-role'] = payload.role;
    request.headers['x-account-id'] = payload.account_id;
    request.headers['x-account-type'] = payload.account_type;

    logger.debug(
      {
        requestId: request.id,
        tenantId: resourceId,
        userId: payload.sub,
        userEmail: payload.email,
        accountId: payload.account_id,
      },
      'JWT token decoded and validated - tenant context set from resource_id'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        requestId: request.id,
        error: errorMessage,
      },
      'JWT token validation failed'
    );

    if (errorMessage.includes('Invalid token') || errorMessage.includes('Malformed')) {
      ApiResponseHelper.tokenInvalid(reply, 'Invalid token format');
    } else {
      ApiResponseHelper.tokenInvalid(reply, 'Token validation failed');
    }
  }
}
