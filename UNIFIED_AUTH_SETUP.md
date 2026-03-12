# Unified Authentication Setup

## Overview

The notification-service is now integrated with the auth-service for **unified authentication**. Both services:
- Use the same JWT signature verification
- Share the same JWT_SECRET environment variable
- Support the same token structure (base tokens and product-scoped tokens)
- Have compatible authentication middleware

---

## Key Components

### 1. Shared JWT Utility
**Location:** `src/shared/utils/jwt.ts`

Provides token verification and validation functions:
```typescript
// Verify JWT with signature validation
const payload = verifyToken(token);

// Validate token is not expired
const expired = isTokenExpired(payload);

// Validate product-scoped token (required for tenant access)
const validation = validateProductToken(payload);

// Extract tenant ID and user ID
const tenantId = extractTenantId(payload);
const userId = extractUserId(payload);
```

### 2. Updated Auth Middleware
**Location:** `src/services/api/src/middlewares/auth.middleware.ts`

Improved middleware that:
- ✅ Verifies JWT signature (secure - not just decoding)
- ✅ Validates token expiration
- ✅ Validates product-scoped token structure
- ✅ Validates tenant exists in database
- ✅ Sets context headers for downstream handlers
- ✅ Compatible with auth-service tokens

### 3. Supported Token Types

#### Base Token (from auth-service login)
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "account_ids": ["account-1", "account-2"],
  "type": "base",
  "iat": 1234567890,
  "exp": 1234654290
}
```
**Expiry:** 7 days
**Usage:** List accounts, select products

#### Product-Scoped Token (from auth-service /auth/switch-product)
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "account_id": "account-uuid",
  "account_type": "INDIVIDUAL",
  "product": "notify",
  "resource_id": "tenant-uuid",
  "role": "admin",
  "type": "product",
  "iat": 1234567890,
  "exp": 1234654290
}
```
**Expiry:** 7 days
**Usage:** Access notification-service APIs (current token type required)

---

## Environment Variables

### Required
```bash
JWT_SECRET=your-production-secret-key-32-chars-min
```

**⚠️ IMPORTANT:** This secret must be:
1. **Identical** in both auth-service and notification-service
2. **At least 32 characters** for production
3. **Changed** from default in production
4. **Never committed** to version control

### Location
Add to `.env` file:
```bash
# JWT Configuration
JWT_SECRET=your-super-secret-key-that-is-at-least-32-characters-long
```

---

## Request Flow

### Client Requests

```
1. POST /auth/login (auth-service)
   └─ Returns: baseToken (7-day expiry)

2. POST /auth/switch-product (auth-service)
   with query param: ?product=notify
   Request: { accountId: "..." }
   └─ Returns: productToken (product-scoped)

3. GET /api/projects (notification-service)
   Header: Authorization: Bearer productToken
   └─ authMiddleware validates token
   └─ Extracts tenantId (resource_id)
   └─ Validates tenant is ACTIVE
   └─ Sets context headers
   └─ Route handler processes request
```

### Token Validation Flow

```
authMiddleware
├─ Extract token from Authorization header
├─ Call verifyToken(token)
│  ├─ Verify JWT signature with JWT_SECRET
│  ├─ Return payload or null
├─ Validate not expired
├─ Validate token type = 'product'
├─ Validate required claims: resource_id, account_id, product
├─ Validate tenant exists in database
├─ Validate tenant.status = 'ACTIVE'
├─ Set context headers
│  ├─ x-tenant-id: resource_id
│  ├─ x-user-id: sub
│  ├─ x-user-email: email
│  ├─ x-user-role: role
│  ├─ x-account-id: account_id
│  └─ x-account-type: account_type
└─ Continue to route handler
```

---

## API Endpoints Using Auth

### Protected Endpoints (Require Bearer Token)

All endpoints below require:
```
Authorization: Bearer <product-scoped-token>
```

#### Project Management
- `POST /api/projects` - Create project
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

#### Template Management
- `POST /api/templates/:id/install` - Install template to project
- `GET /api/templates/:id/status` - Get installation status
- `GET /api/templates/:id/analytics` - Get template analytics
- `GET /api/templates/:id` - Get template details
- `GET /api/templates` - List templates (with pagination)
- `GET /api/templates/all` - Get all templates
- `GET /api/templates/search` - Search templates

#### Notifications
- `POST /api/notify/send` - Send notification
- `GET /api/notifications` - List notifications

### Public Endpoints (No Auth Required)

- `GET /templates/search` - Search templates
- `GET /templates` - List templates (public view)
- `GET /templates/all` - Get all templates
- `GET /templates/:id` - Get template details

---

## Integration Checklist

- [x] Created shared JWT utility (`src/shared/utils/jwt.ts`)
- [x] Updated auth middleware to use JWT verification
- [x] Added JWT type declarations
- [x] Created project CRUD endpoints
- [x] Added authorization checks on all protected routes
- [x] Validated token structure and claims
- [ ] **TODO:** Configure JWT_SECRET in production `.env`
- [ ] **TODO:** Test end-to-end auth flow with auth-service
- [ ] **TODO:** Update API documentation with token examples

---

## Testing Authentication

### 1. Get Base Token
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Response
{
  "success": true,
  "data": {
    "baseToken": "eyJhbGc..."
  }
}
```

### 2. Get Product Token
```bash
curl -X POST "http://localhost:3001/auth/switch-product?product=notify" \
  -H "Authorization: Bearer <baseToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "account-uuid"
  }'

# Response
{
  "success": true,
  "data": {
    "productToken": "eyJhbGc...",
    "product": "notify",
    "resourceId": "tenant-uuid"
  }
}
```

### 3. Use Product Token (Notification Service)
```bash
curl -X GET http://localhost:3000/api/projects \
  -H "Authorization: Bearer <productToken>"

# Response
{
  "success": true,
  "resp_code": 1000,
  "resp_msg": "Projects retrieved successfully",
  "data": [
    {
      "id": "project-uuid",
      "name": "My Project",
      "description": "...",
      "createdAt": "2025-03-08T...",
      "updatedAt": "2025-03-08T..."
    }
  ],
  "meta": {
    "limit": 50,
    "offset": 0,
    "total": 1
  }
}
```

---

## Token Troubleshooting

### Error: "Invalid or malformed token"
**Cause:** JWT signature verification failed
**Solution:**
- Verify JWT_SECRET is identical in both services
- Ensure token hasn't been tampered with
- Check token format starts with `Bearer `

### Error: "Token has expired"
**Cause:** Token exp claim is in the past
**Solution:**
- Get new token from auth-service
- Note: Token expiry is 7 days

### Error: "Token must be product-scoped"
**Cause:** Using base token instead of product token
**Solution:**
```bash
# From auth-service, get product token:
POST /auth/switch-product?product=notify
```

### Error: "Tenant not found"
**Cause:** resource_id claim doesn't match any tenant
**Solution:**
- Ensure user is enrolled in the correct tenant/account
- Check tenant exists in notification-service database

### Error: "Tenant is not active"
**Cause:** Tenant status is not 'ACTIVE'
**Solution:**
- Check tenant status in database
- Reactivate tenant if needed

---

## Security Considerations

### 1. JWT_SECRET Management
- ✅ Store JWT_SECRET in secure environment variables
- ✅ Use different secrets for dev/staging/prod
- ✅ Rotate secrets periodically (requires re-login)
- ✅ Never log or expose JWT_SECRET

### 2. Token Security
- ✅ Tokens signed with HMAC-SHA256 (HS256)
- ✅ Signature verified on every request (not just decoded)
- ✅ Token type validation (base vs product)
- ✅ Tenant validation against database
- ✅ 7-day expiry enforced

### 3. CORS & Headers
- ✅ Set `x-tenant-id` from token (not from client)
- ✅ Set `x-user-id` from token claim `sub`
- ✅ Validate tenant ownership before operations
- ✅ Log authentication failures

---

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│        Client Application                   │
└─────────────────────────────────────────────┘
         │                    │
         │                    │
         ▼                    ▼
┌──────────────────┐  ┌─────────────────────┐
│  Auth Service    │  │ Notification Service│
│  :3001           │  │ :3000               │
├──────────────────┤  ├─────────────────────┤
│ POST /login      │  │ authMiddleware      │
│ POST /switch-    │  │ (verify JWT)        │
│   product        │  ├─────────────────────┤
│ (generates JWT)  │  │ ✓ Check signature   │
│                  │  │ ✓ Check expiry      │
│                  │  │ ✓ Validate claims   │
│                  │  │ ✓ Tenant lookup     │
└──────────────────┘  │ ✓ Set headers       │
        │             │                     │
        │             │ Protected Routes:   │
        │             │ • /projects         │
        │             │ • /templates        │
        │             │ • /notifications    │
        │             └─────────────────────┘
        │
   Shared: JWT_SECRET (HMAC key)
```

---

## Migration from Old Auth

If migrating from the old jwt-decode method:

**Before:**
```typescript
import { jwtDecode } from 'jwt-decode';
const payload = jwtDecode(token); // ❌ No signature verification
```

**After:**
```typescript
import { verifyToken } from '@shared/utils/jwt';
const payload = verifyToken(token); // ✅ Signature verified
```

Benefits:
- Signature verification (secure)
- Standardized error handling
- Compatible with auth-service tokens
- Type-safe payload extraction

---

## Support

For issues with:
- **Auth-service:** See auth-service repository
- **JWT validation:** Check JWT_SECRET matches
- **Tenant access:** Verify tenant exists and is ACTIVE
- **Token expiry:** Request new token from auth-service

