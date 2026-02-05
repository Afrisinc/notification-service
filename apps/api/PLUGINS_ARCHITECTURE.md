# Plugins Architecture

## Overview

The Afrisinc Notify API uses a plugin-based architecture for clean separation of concerns. Each plugin handles a specific aspect of application initialization, making the codebase more maintainable and testable.

## Plugin Directory Structure

```
src/plugins/
├── index.ts                    # Central export point for all plugins
├── swagger.ts                  # OpenAPI/Swagger documentation setup
├── security.ts                 # Security headers (Helmet) and CORS
├── request-lifecycle.ts        # Request/response logging and correlation ID
├── routes.ts                   # Route registration
└── error-handler.ts            # Global error handling
```

## Plugins

### 1. **Security Plugin** (`security.ts`)

Handles application security configuration.

**Responsibilities:**
- Helmet security headers (CSP, X-Frame-Options, X-XSS-Protection, etc.)
- CORS configuration with origin, credentials, and allowed methods
- Allowed headers definition

**Registration Order:** First (before other plugins that may make requests)

**Example:**
```typescript
await registerSecurityPlugin(fastify);
```

### 2. **Request Lifecycle Plugin** (`request-lifecycle.ts`)

Manages request and response lifecycle hooks.

**Responsibilities:**
- Correlation ID propagation
- Request logging (method, URL, request ID)
- Response logging (status code, response time)
- Structured logging with pino

**Features:**
- Automatic request/response tracking
- Performance metrics (response time)
- Distributed tracing support via `x-correlation-id` header

**Registration Order:** Second (after security)

**Example:**
```typescript
await registerRequestLifecyclePlugin(fastify);
```

### 3. **Swagger Plugin** (`swagger.ts`)

Provides OpenAPI/Swagger documentation.

**Responsibilities:**
- OpenAPI 3.0.0 schema generation
- API metadata (title, version, description, contact)
- Server configuration (development and production)
- Security scheme definition (Bearer token)
- Swagger UI at `/docs`

**Features:**
- Interactive API documentation
- Request/response schema validation
- Server selection in Swagger UI
- CSP configuration for Swagger assets

**Registration Order:** Third (after request lifecycle)

**Example:**
```typescript
await registerSwaggerPlugin(fastify);
```

**Access:**
- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/documentation/json

### 4. **Routes Plugin** (`routes.ts`)

Registers all API routes.

**Responsibilities:**
- Health check routes (`/health`, `/health/live`, `/health/ready`)
- Notification routes (`/notify/*`)
- Template management routes (`/templates/*`)

**Registration Order:** Fourth (after documentation)

**Example:**
```typescript
await registerRoutesPlugin(fastify);
```

### 5. **Error Handler Plugin** (`error-handler.ts`)

Global error handling and formatting.

**Responsibilities:**
- Centralized error handling
- Error logging with stack traces
- Standardized error responses
- Request ID inclusion in error responses
- Stack trace exposure in non-production environments

**Error Response Format:**
```json
{
  "error": "Error message",
  "requestId": "unique-request-id",
  "stack": "..." // Only in development
}
```

**Registration Order:** Last (wraps all other plugins)

**Example:**
```typescript
await registerErrorHandlerPlugin(fastify);
```

## Plugin Registration Order

The order of plugin registration is critical:

```typescript
// 1. Security first
await registerSecurityPlugin(fastify);

// 2. Request tracking
await registerRequestLifecyclePlugin(fastify);

// 3. Documentation
await registerSwaggerPlugin(fastify);

// 4. Routes
await registerRoutesPlugin(fastify);

// 5. Error handling (last to wrap everything)
await registerErrorHandlerPlugin(fastify);
```

## Adding New Plugins

### Step 1: Create Plugin File

Create a new file in `src/plugins/` with the naming convention `[feature-name].ts`:

```typescript
// src/plugins/my-feature.ts
import { FastifyInstance } from 'fastify';

export async function registerMyFeaturePlugin(fastify: FastifyInstance) {
  // Plugin implementation
  fastify.register(/* ... */);
  // or
  fastify.addHook(/* ... */);
}
```

### Step 2: Export from Index

Add export to `src/plugins/index.ts`:

```typescript
export { registerMyFeaturePlugin } from './my-feature';
```

### Step 3: Register in App

Update `src/app.ts` to register the plugin in the appropriate order:

```typescript
import { registerMyFeaturePlugin } from './plugins';

export async function createFastifyApp(): Promise<FastifyInstance> {
  // ... initialization code ...

  await registerSecurityPlugin(fastify);
  await registerRequestLifecyclePlugin(fastify);
  await registerMyFeaturePlugin(fastify);  // Add in appropriate position
  await registerSwaggerPlugin(fastify);
  await registerRoutesPlugin(fastify);
  await registerErrorHandlerPlugin(fastify);

  return fastify;
}
```

## Plugin Guidelines

### ✅ Do's

1. **Single Responsibility**: Each plugin should handle one concern
2. **Idempotent Registration**: Plugins should be safe to call multiple times
3. **Async Functions**: Always use `async` functions for consistency
4. **Logging**: Use the logger for important operations
5. **Error Handling**: Let errors propagate to the error handler
6. **Type Safety**: Use proper TypeScript types

### ❌ Don'ts

1. **Don't Create Routes**: Routes belong in the Routes plugin
2. **Don't Add Controllers**: Controller logic belongs in `src/controllers/`
3. **Don't Duplicate Logic**: Extract common logic to utilities
4. **Don't Suppress Errors**: Let errors propagate (error handler will catch them)
5. **Don't Hardcode Config**: Use environment variables via `src/config/env.ts`

## Plugin Dependencies

```
request-lifecycle.ts (correlationIdMiddleware)
↓
swagger.ts
  └─ Uses OpenAPI spec that references security schemes
↓
routes.ts (depends on controllers)
  └─ Controllers → Services → Repositories
↓
error-handler.ts (wraps all)
```

## Testing Plugins

Each plugin can be tested independently:

```typescript
import { createFastifyApp } from '../app';

describe('Security Plugin', () => {
  it('should add security headers', async () => {
    const fastify = await createFastifyApp();
    const response = await fastify.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.headers['x-frame-options']).toBeDefined();
  });
});
```

## Performance Considerations

- **Plugin Registration Order**: Plugins are registered sequentially; order matters
- **Lazy Loading**: Use Fastify's native plugin system for lazy loading if needed
- **Request Lifecycle**: All request hooks run for every request; keep them lean
- **Error Handling**: The global error handler catches all errors; no need for try-catch in routes

## Environment-Specific Configuration

```typescript
// Example: Different error handling for production
export async function registerErrorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;

    // Production: Don't expose stack traces
    if (process.env.NODE_ENV === 'production') {
      return reply.code(statusCode).send({
        error: statusCode === 500 ? 'Internal Server Error' : error.message
      });
    }

    // Development: Include stack traces
    return reply.code(statusCode).send({
      error: error.message,
      stack: error.stack
    });
  });
}
```

## Maintenance Checklist

- [ ] Plugin has a single, clear responsibility
- [ ] Plugin is documented in this file
- [ ] Plugin is exported from `src/plugins/index.ts`
- [ ] Plugin is registered in `src/app.ts` in correct order
- [ ] Plugin handles errors gracefully
- [ ] Plugin uses logger for important events
- [ ] Plugin includes TypeScript types
- [ ] Plugin has no side effects outside its scope
