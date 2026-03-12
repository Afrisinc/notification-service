import type { FastifyReply } from 'fastify';

/**
 * Afrisinc API Response Codes
 * Based on Afrisinc Response Standard v1.0.0
 * Categorized by error type and severity
 */
export enum ResponseCode {
  // 1xxx - Success
  SUCCESS = 1000,
  CREATED = 1001,
  UPDATED = 1002,
  DELETED = 1003,
  ACCEPTED = 1004,

  // 2xxx - Client Errors
  INVALID_REQUEST = 2000,
  MISSING_FIELDS = 2001,
  INVALID_FORMAT = 2002,
  DUPLICATE_ENTRY = 2003,
  NOT_FOUND = 2004,
  UNSUPPORTED_ACTION = 2005,

  // 3xxx - Authentication & Authorization
  AUTH_REQUIRED = 8010,
  INVALID_CREDENTIALS = 3001,
  TOKEN_EXPIRED = 3002,
  TOKEN_INVALID = 3003,
  ACCESS_DENIED = 3004,

  // 4xxx - Business Logic Errors
  OPERATION_NOT_ALLOWED = 4000,
  BUSINESS_RULE_VIOLATION = 4001,
  QUOTA_EXCEEDED = 4002,
  CONFLICT = 4003,
  EXTERNAL_SERVICE_ERROR = 4004,

  // 5xxx - System Errors
  INTERNAL_ERROR = 5000,
  DATABASE_ERROR = 5001,
  SERVICE_UNAVAILABLE = 5002,
  UNEXPECTED_ERROR = 5003,
  TIMEOUT = 5004,

  // 9xxx - Critical Errors
  SYSTEM_FAILURE = 9000,
  DATA_CORRUPTION = 9001,
  SECURITY_INCIDENT = 9002,
  INFRASTRUCTURE_OUTAGE = 9003,
}

/**
 * Standard API Response Structure
 * Follows Afrisinc Response Standard v1.0.0
 */
interface ApiResponse<T = any> {
  success: boolean;
  resp_msg: string;
  resp_code: number;
  data?: T | null;
}

/**
 * Professional API Response Helper
 * Standardizes all API responses across the platform
 *
 * Usage:
 * ```typescript
 * // Success
 * ApiResponseHelper.success(reply, 'User created', user);
 * ApiResponseHelper.created(reply, 'Template created', template);
 *
 * // Errors
 * ApiResponseHelper.notFound(reply, 'Template not found');
 * ApiResponseHelper.duplicate(reply, 'Template already exists');
 * ```
 */
export class ApiResponseHelper {
  /**
   * Send a success response with custom HTTP status
   * @param reply FastifyReply object
   * @param message Human-readable message
   * @param data Response payload
   * @param respCode Internal response code (default: 1000)
   * @param httpCode HTTP status code (default: 200)
   */
  static success<T = any>(
    reply: FastifyReply,
    message: string,
    data?: T,
    respCode: number = ResponseCode.SUCCESS,
    httpCode: number = 200
  ): FastifyReply {
    const response: ApiResponse<T> = {
      success: true,
      resp_msg: message,
      resp_code: respCode,
      data: data ?? null,
    };
    return reply.status(httpCode).send(response);
  }

  /**
   * Send a success response for list/array data with metadata
   * Flattens data and meta to root level instead of nesting under data
   * @param reply FastifyReply object
   * @param message Human-readable message
   * @param data Array of items
   * @param meta Pagination or metadata
   * @param respCode Internal response code (default: 1000)
   * @param httpCode HTTP status code (default: 200)
   */
  static successList<T = any>(
    reply: FastifyReply,
    message: string,
    data: T[],
    meta?: Record<string, any>,
    respCode: number = ResponseCode.SUCCESS,
    httpCode: number = 200
  ): FastifyReply {
    const response: any = {
      success: true,
      resp_msg: message,
      resp_code: respCode,
      data: data ?? [],
    };
    if (meta) {
      response.meta = meta;
    }
    return reply.status(httpCode).send(response);
  }

  /**
   * Send a created (201) response
   * @param reply FastifyReply object
   * @param message Human-readable message
   * @param data Created resource data
   */
  static created<T = any>(reply: FastifyReply, message: string, data?: T): FastifyReply {
    return this.success(reply, message, data, ResponseCode.CREATED, 201);
  }

  /**
   * Send an accepted (202) response for async operations
   * @param reply FastifyReply object
   * @param message Human-readable message
   * @param data Response payload
   */
  static accepted<T = any>(reply: FastifyReply, message: string, data?: T): FastifyReply {
    return this.success(reply, message, data, ResponseCode.ACCEPTED, 202);
  }

  /**
   * Send an updated (200) response
   * @param reply FastifyReply object
   * @param message Human-readable message
   * @param data Updated resource data
   */
  static updated<T = any>(reply: FastifyReply, message: string, data?: T): FastifyReply {
    return this.success(reply, message, data, ResponseCode.UPDATED, 200);
  }

  /**
   * Send a deleted (204) response
   * @param reply FastifyReply object
   * @param message Human-readable message
   */
  static deleted(reply: FastifyReply, message: string = 'Resource deleted successfully'): FastifyReply {
    const response: ApiResponse = {
      success: true,
      resp_msg: message,
      resp_code: ResponseCode.DELETED,
    };
    return reply.status(204).send(response);
  }

  /**
   * Send an error response with custom HTTP status
   * @param reply FastifyReply object
   * @param message Human-readable error message
   * @param respCode Internal response code
   * @param httpCode HTTP status code
   */
  static error(
    reply: FastifyReply,
    message: string,
    respCode: number = ResponseCode.INVALID_REQUEST,
    httpCode: number = 400
  ): FastifyReply {
    const response: ApiResponse = {
      success: false,
      resp_msg: message,
      resp_code: respCode,
    };
    return reply.status(httpCode).send(response);
  }

  // ============= Client Error Responses (4xx) =============

  /**
   * 400 Bad Request - Invalid request payload
   */
  static badRequest(reply: FastifyReply, message: string = 'Invalid request payload'): FastifyReply {
    return this.error(reply, message, ResponseCode.INVALID_REQUEST, 400);
  }

  /**
   * 400 Bad Request - Missing required fields
   */
  static missingFields(reply: FastifyReply, message: string = 'Missing required fields'): FastifyReply {
    return this.error(reply, message, ResponseCode.MISSING_FIELDS, 400);
  }

  /**
   * 400 Bad Request - Invalid field format
   */
  static invalidFormat(reply: FastifyReply, message: string = 'Invalid field format'): FastifyReply {
    return this.error(reply, message, ResponseCode.INVALID_FORMAT, 400);
  }

  /**
   * 409 Conflict - Duplicate entry
   */
  static duplicate(reply: FastifyReply, message: string = 'Resource already exists'): FastifyReply {
    return this.error(reply, message, ResponseCode.DUPLICATE_ENTRY, 409);
  }

  /**
   * 404 Not Found - Resource not found
   */
  static notFound(reply: FastifyReply, message: string = 'Resource not found'): FastifyReply {
    return this.error(reply, message, ResponseCode.NOT_FOUND, 404);
  }

  /**
   * 405 Method Not Allowed - Unsupported action
   */
  static unsupported(reply: FastifyReply, message: string = 'Operation not supported'): FastifyReply {
    return this.error(reply, message, ResponseCode.UNSUPPORTED_ACTION, 405);
  }

  // ============= Authentication & Authorization (3xx/401/403) =============

  /**
   * 401 Unauthorized - Authentication required
   */
  static unauthorized(reply: FastifyReply, message: string = 'Authentication required'): FastifyReply {
    return this.error(reply, message, ResponseCode.AUTH_REQUIRED, 401);
  }

  /**
   * 401 Unauthorized - Invalid credentials
   */
  static invalidCredentials(reply: FastifyReply, message: string = 'Invalid credentials'): FastifyReply {
    return this.error(reply, message, ResponseCode.INVALID_CREDENTIALS, 401);
  }

  /**
   * 401 Unauthorized - Token expired
   */
  static tokenExpired(reply: FastifyReply, message: string = 'Token has expired'): FastifyReply {
    return this.error(reply, message, ResponseCode.TOKEN_EXPIRED, 401);
  }

  /**
   * 401 Unauthorized - Invalid token
   */
  static tokenInvalid(reply: FastifyReply, message: string = 'Invalid token'): FastifyReply {
    return this.error(reply, message, ResponseCode.TOKEN_INVALID, 401);
  }

  /**
   * 403 Forbidden - Access denied
   */
  static forbidden(reply: FastifyReply, message: string = 'Access denied'): FastifyReply {
    return this.error(reply, message, ResponseCode.ACCESS_DENIED, 403);
  }

  // ============= Business Logic Errors (4xx) =============

  /**
   * 400 Bad Request - Operation not allowed
   */
  static operationNotAllowed(reply: FastifyReply, message: string = 'Operation not allowed'): FastifyReply {
    return this.error(reply, message, ResponseCode.OPERATION_NOT_ALLOWED, 400);
  }

  /**
   * 409 Conflict - Business rule violation
   */
  static conflict(reply: FastifyReply, message: string = 'Operation conflict'): FastifyReply {
    return this.error(reply, message, ResponseCode.CONFLICT, 409);
  }

  /**
   * 429 Too Many Requests - Quota exceeded
   */
  static quotaExceeded(reply: FastifyReply, message: string = 'Quota limit exceeded'): FastifyReply {
    return this.error(reply, message, ResponseCode.QUOTA_EXCEEDED, 429);
  }

  /**
   * 400 Bad Request - Business rule violation
   */
  static businessRuleViolation(reply: FastifyReply, message: string = 'Business rule violation'): FastifyReply {
    return this.error(reply, message, ResponseCode.BUSINESS_RULE_VIOLATION, 400);
  }

  // ============= Server Error Responses (5xx) =============

  /**
   * 500 Internal Server Error
   */
  static internalError(reply: FastifyReply, message: string = 'Internal server error'): FastifyReply {
    return this.error(reply, message, ResponseCode.INTERNAL_ERROR, 500);
  }

  /**
   * 500 Internal Server Error - Database error
   */
  static databaseError(reply: FastifyReply, message: string = 'Database error'): FastifyReply {
    return this.error(reply, message, ResponseCode.DATABASE_ERROR, 500);
  }

  /**
   * 503 Service Unavailable
   */
  static serviceUnavailable(reply: FastifyReply, message: string = 'Service unavailable'): FastifyReply {
    return this.error(reply, message, ResponseCode.SERVICE_UNAVAILABLE, 503);
  }

  /**
   * 504 Gateway Timeout
   */
  static timeout(reply: FastifyReply, message: string = 'Request timeout'): FastifyReply {
    return this.error(reply, message, ResponseCode.TIMEOUT, 504);
  }

  /**
   * 500 Internal Server Error - Unexpected error
   */
  static unexpectedError(reply: FastifyReply, message: string = 'Unexpected error occurred'): FastifyReply {
    return this.error(reply, message, ResponseCode.UNEXPECTED_ERROR, 500);
  }

  /**
   * 503 Service Unavailable - External service error
   */
  static externalServiceError(reply: FastifyReply, message: string = 'External service error'): FastifyReply {
    return this.error(reply, message, ResponseCode.EXTERNAL_SERVICE_ERROR, 503);
  }

  // ============= Critical Errors (5xx/500) =============

  /**
   * 500 Internal Server Error - System failure
   */
  static systemFailure(reply: FastifyReply, message: string = 'System failure'): FastifyReply {
    return this.error(reply, message, ResponseCode.SYSTEM_FAILURE, 500);
  }

  /**
   * 500 Internal Server Error - Data corruption
   */
  static dataCorruption(reply: FastifyReply, message: string = 'Data corruption detected'): FastifyReply {
    return this.error(reply, message, ResponseCode.DATA_CORRUPTION, 500);
  }

  /**
   * 401 Unauthorized - Security incident
   */
  static securityIncident(reply: FastifyReply, message: string = 'Security incident detected'): FastifyReply {
    return this.error(reply, message, ResponseCode.SECURITY_INCIDENT, 401);
  }

  /**
   * 503 Service Unavailable - Infrastructure outage
   */
  static infrastructureOutage(reply: FastifyReply, message: string = 'Infrastructure outage'): FastifyReply {
    return this.error(reply, message, ResponseCode.INFRASTRUCTURE_OUTAGE, 503);
  }
}
