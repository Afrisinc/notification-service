/**
 * Common error response schemas used across all endpoints
 */

export const errorResponse = {
  type: "object",
  properties: {
    error: { type: "string", description: "Error message" },
    requestId: { type: "string", description: "Request ID for tracking" },
  },
  required: ["error"],
};

export const badRequestResponse = {
  400: {
    description: "Bad Request - Invalid input",
    ...errorResponse,
  },
};

export const unauthorizedResponse = {
  401: {
    description: "Unauthorized - Missing or invalid authentication",
    ...errorResponse,
  },
};

export const forbiddenResponse = {
  403: {
    description: "Forbidden - Access denied",
    ...errorResponse,
  },
};

export const notFoundResponse = {
  404: {
    description: "Not Found - Resource does not exist",
    ...errorResponse,
  },
};

export const conflictResponse = {
  409: {
    description: "Conflict - Resource already exists",
    ...errorResponse,
  },
};

export const internalErrorResponse = {
  500: {
    description: "Internal Server Error",
    ...errorResponse,
  },
};

export const standardErrorResponses = {
  ...badRequestResponse,
  ...unauthorizedResponse,
  ...forbiddenResponse,
  ...internalErrorResponse,
};

export const authHeaders = {
  type: "object",
  required: ["authorization", "x-tenant-id"],
  properties: {
    authorization: {
      type: "string",
      description: "Bearer token for authentication",
    },
    "x-tenant-id": {
      type: "string",
      description: "Tenant identifier",
    },
    "x-correlation-id": {
      type: "string",
      description: "Optional correlation ID for distributed tracing",
    },
  },
};

// Optional headers when auth is handled by API Gateway
export const gatewayHeaders = {
  type: "object",
  properties: {
    authorization: {
      type: "string",
      description: "Bearer token (set by API Gateway)",
    },
    "x-tenant-id": {
      type: "string",
      description: "Tenant identifier (set by API Gateway)",
    },
    "x-correlation-id": {
      type: "string",
      description: "Optional correlation ID for distributed tracing",
    },
  },
};

// Required headers for tenant-scoped template endpoints
export const templateHeaders = {
  type: "object",
  properties: {
    "x-tenant-id": {
      type: "string",
      description: "Tenant ID (required for multi-tenancy)",
    },
  },
};
