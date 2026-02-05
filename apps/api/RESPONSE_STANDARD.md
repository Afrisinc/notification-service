# Afrisinc API Response Standard v1.0.0

## Overview

This document describes the standardized API response format used throughout the Afrisinc Notify API. All endpoints follow this consistent structure to provide a predictable and professional API experience.

## Response Structure

All API responses follow a standardized JSON structure:

```json
{
  "success": boolean,
  "resp_msg": string,
  "resp_code": number,
  "data": any | null
}
```

### Fields

- **success** (boolean): Indicates whether the operation was successful
  - `true` for successful responses (1xxx and 2xx HTTP status codes)
  - `false` for error responses (3xx, 4xx, 5xx HTTP status codes)

- **resp_msg** (string): Human-readable message describing the result
  - Success: "Resource created successfully", "Notification queued for processing"
  - Error: "Resource not found", "Missing required fields"

- **resp_code** (number): Internal response code for programmatic handling
  - Success: 1000-1004 (1xxx range)
  - Client errors: 2000-2005 (2xxx range)
  - Auth errors: 3000-3004 (3xxx range)
  - Business logic: 4000-4004 (4xxx range)
  - System errors: 5000-5004 (5xxx range)
  - Critical: 9000-9003 (9xxx range)

- **data** (any | null): Response payload
  - Present for successful responses
  - Null/omitted for error responses
  - Can be an object, array, or scalar value

## Response Code Categories

### 1xxx - Success Responses

| Code | Name       | HTTP | Usage                                       |
|------|------------|------|---------------------------------------------|
| 1000 | SUCCESS    | 200  | Generic success response                   |
| 1001 | CREATED    | 201  | Resource created successfully              |
| 1002 | UPDATED    | 200  | Resource updated successfully              |
| 1003 | DELETED    | 204  | Resource deleted successfully              |
| 1004 | ACCEPTED   | 202  | Request accepted for async processing      |

### 2xxx - Client Errors

| Code | Name             | HTTP | Usage                                   |
|------|------------------|------|----------------------------------------|
| 2000 | INVALID_REQUEST  | 400  | Invalid request payload or parameters  |
| 2001 | MISSING_FIELDS   | 400  | Missing required fields                |
| 2002 | INVALID_FORMAT   | 400  | Invalid field format                   |
| 2003 | DUPLICATE_ENTRY  | 409  | Resource already exists                |
| 2004 | NOT_FOUND        | 404  | Resource not found                     |
| 2005 | UNSUPPORTED_ACTION | 405 | Operation not supported               |

### 3xxx - Authentication & Authorization

| Code | Name              | HTTP | Usage                              |
|------|-------------------|------|-----------------------------------|
| 3000 | AUTH_REQUIRED     | 401  | Authentication required            |
| 3001 | INVALID_CREDENTIALS | 401 | Invalid credentials               |
| 3002 | TOKEN_EXPIRED     | 401  | Token has expired                  |
| 3003 | TOKEN_INVALID     | 401  | Invalid or malformed token        |
| 3004 | ACCESS_DENIED     | 403  | Access forbidden                   |

### 4xxx - Business Logic Errors

| Code | Name                     | HTTP | Usage                            |
|------|--------------------------|------|----------------------------------|
| 4000 | OPERATION_NOT_ALLOWED    | 400  | Operation not allowed            |
| 4001 | BUSINESS_RULE_VIOLATION  | 400  | Business rule violation          |
| 4002 | QUOTA_EXCEEDED           | 429  | Quota/rate limit exceeded        |
| 4003 | CONFLICT                 | 409  | Conflicting operation            |
| 4004 | EXTERNAL_SERVICE_ERROR   | 503  | External service unavailable     |

### 5xxx - System Errors

| Code | Name                | HTTP | Usage                           |
|------|---------------------|------|--------------------------------|
| 5000 | INTERNAL_ERROR      | 500  | Internal server error           |
| 5001 | DATABASE_ERROR      | 500  | Database operation failed       |
| 5002 | SERVICE_UNAVAILABLE | 503  | Service temporarily unavailable |
| 5003 | UNEXPECTED_ERROR    | 500  | Unexpected error occurred       |
| 5004 | TIMEOUT             | 504  | Request timeout                 |

### 9xxx - Critical Errors

| Code | Name                   | HTTP | Usage                       |
|------|------------------------|------|---------------------------|
| 9000 | SYSTEM_FAILURE         | 500  | System failure              |
| 9001 | DATA_CORRUPTION        | 500  | Data corruption detected    |
| 9002 | SECURITY_INCIDENT      | 401  | Security incident detected  |
| 9003 | INFRASTRUCTURE_OUTAGE  | 503  | Infrastructure outage       |

## Usage Examples

### Success Response - Create (201)

```json
{
  "success": true,
  "resp_msg": "Template created successfully",
  "resp_code": 1001,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "WELCOME_USER",
    "channel": "EMAIL",
    "active": true
  }
}
```

### Success Response - List (200)

```json
{
  "success": true,
  "resp_msg": "Notifications listed",
  "resp_code": 1000,
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "channel": "EMAIL",
        "recipient": "user@example.com",
        "status": "QUEUED",
        "createdAt": "2026-02-05T16:30:00Z",
        "updatedAt": "2026-02-05T16:30:00Z"
      }
    ],
    "meta": {
      "limit": 20,
      "offset": 0,
      "total": 100
    }
  }
}
```

### Success Response - Async Operation (202)

```json
{
  "success": true,
  "resp_msg": "Notification queued for processing",
  "resp_code": 1004,
  "data": {
    "notificationId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "QUEUED"
  }
}
```

### Error Response - Not Found (404)

```json
{
  "success": false,
  "resp_msg": "Template not found",
  "resp_code": 2004
}
```

### Error Response - Duplicate Entry (409)

```json
{
  "success": false,
  "resp_msg": "Template with code WELCOME_USER already exists",
  "resp_code": 2003
}
```

### Error Response - Unauthorized (401)

```json
{
  "success": false,
  "resp_msg": "Missing x-tenant-id header",
  "resp_code": 3000
}
```

## Using ApiResponseHelper in Controllers

The `ApiResponseHelper` class provides a fluent interface for generating consistent responses:

### Success Responses

```typescript
import { ApiResponseHelper } from '../utils';

// Generic success
ApiResponseHelper.success(reply, 'Message', data);

// Specific success responses
ApiResponseHelper.created(reply, 'Template created', template);
ApiResponseHelper.updated(reply, 'Template updated', template);
ApiResponseHelper.deleted(reply, 'Template deleted');
ApiResponseHelper.accepted(reply, 'Notification queued', notification);
```

### Error Responses

```typescript
// 400 Bad Request
ApiResponseHelper.badRequest(reply, 'Invalid input');
ApiResponseHelper.missingFields(reply, 'Name and email required');
ApiResponseHelper.invalidFormat(reply, 'Email must be valid');

// 404 Not Found
ApiResponseHelper.notFound(reply, 'Template not found');

// 409 Conflict
ApiResponseHelper.duplicate(reply, 'Template already exists');
ApiResponseHelper.conflict(reply, 'Operation conflict');

// 401 Unauthorized
ApiResponseHelper.unauthorized(reply, 'Authentication required');
ApiResponseHelper.tokenExpired(reply, 'Token has expired');
ApiResponseHelper.tokenInvalid(reply, 'Invalid token');

// 403 Forbidden
ApiResponseHelper.forbidden(reply, 'Access denied');

// 429 Too Many Requests
ApiResponseHelper.quotaExceeded(reply, 'Rate limit exceeded');

// 500 Internal Server Error
ApiResponseHelper.internalError(reply, 'Internal server error');
ApiResponseHelper.databaseError(reply, 'Database error');

// 503 Service Unavailable
ApiResponseHelper.serviceUnavailable(reply, 'Service unavailable');

// 504 Gateway Timeout
ApiResponseHelper.timeout(reply, 'Request timeout');
```

## Controller Example

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiResponseHelper } from '../utils';

export class TemplateController {
  async createTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const template = await templateService.create(request.body);
      return ApiResponseHelper.created(reply, 'Template created successfully', template);
    } catch (error) {
      if (error.message.includes('duplicate')) {
        return ApiResponseHelper.duplicate(reply, 'Template already exists');
      }
      if (error.message.includes('validation')) {
        return ApiResponseHelper.badRequest(reply, error.message);
      }
      return ApiResponseHelper.internalError(reply);
    }
  }
}
```

## Client Integration

### JavaScript/TypeScript

```typescript
const response = await fetch('/api/templates', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer token',
    'X-Tenant-ID': 'tenant-id'
  },
  body: JSON.stringify(template)
});

const result = await response.json();

if (result.success) {
  console.log('Success:', result.data);
} else {
  console.error('Error:', result.resp_msg);
}
```

### Error Handling

```typescript
const handleResponse = (result) => {
  if (!result.success) {
    switch (result.resp_code) {
      case 2004: // NOT_FOUND
        showError('Resource not found');
        break;
      case 3000: // AUTH_REQUIRED
        redirectToLogin();
        break;
      case 2003: // DUPLICATE_ENTRY
        showError('Resource already exists');
        break;
      default:
        showError(result.resp_msg);
    }
  }
};
```

## Best Practices

1. **Always include resp_msg**: Provide human-readable messages for both success and error cases
2. **Use specific response codes**: Choose the most specific resp_code for your use case
3. **Include data only on success**: Error responses should not include a data field
4. **Consistent HTTP status codes**: Align HTTP status codes with resp_code categories
5. **Meaningful messages**: Messages should help API consumers understand what happened
6. **Log everything**: Pair API responses with comprehensive logging for debugging
7. **Return minimal data**: Only return data that clients actually need

## Migration Guide

If you're migrating from an old response format:

Old:
```json
{
  "error": "Template not found"
}
```

New:
```json
{
  "success": false,
  "resp_msg": "Template not found",
  "resp_code": 2004
}
```

Clients can now:
1. Check `success` boolean first
2. Use `resp_code` for programmatic handling
3. Display `resp_msg` to users
4. Access `data` payload when needed

## Versioning

The Afrisinc Response Standard v1.0.0 is the current version. Any breaking changes to this format will result in a new major version number.
