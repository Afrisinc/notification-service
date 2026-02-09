# API Application - Notification Service

FastifyHTTP API server for managing notifications and templates in the Afrisinc Notification Service.

## Overview

The API application provides RESTful endpoints for:
- Creating and managing notifications
- Managing notification templates
- Querying notification history and statistics
- Webhook management
- Tenant/user management

## Structure

```
api/
├── src/
│   ├── app.ts                  # Fastify app initialization
│   ├── server.ts               # Server startup
│   ├── routes/
│   │   ├── index.ts           # Route registration
│   │   ├── notify.routes.ts   # Notification endpoints
│   │   ├── template.routes.ts # Template endpoints
│   │   └── health.routes.ts   # Health check endpoints
│   ├── controllers/
│   │   ├── notify.controller.ts   # Notification handlers
│   │   └── template.controller.ts # Template handlers
│   ├── services/
│   │   ├── notify.service.ts      # Notification business logic
│   │   ├── template.service.ts    # Template business logic
│   │   └── tenant.service.ts      # Tenant business logic
│   ├── validators/
│   │   └── notify.schema.ts       # Zod validation schemas
│   ├── middlewares/
│   │   ├── auth.middleware.ts        # JWT/API key auth
│   │   ├── rate-limit.middleware.ts  # Rate limiting
│   │   └── correlation-id.middleware.ts # Request tracking
│   ├── config/
│   │   ├── env.ts              # Environment variables
│   │   ├── logger.ts           # Logger configuration
│   │   └── redis.ts            # Redis configuration
│   └── index.ts                # Entry point
├── Dockerfile                  # Production Docker image
├── package.json               # Dependencies and scripts
└── tsconfig.json             # TypeScript config
```

## Key Features

### Authentication
- JWT token authentication
- API key authentication
- Multi-tenant support
- Authorization middleware

### Request Validation
- Zod schemas for all endpoints
- Automatic request/response validation
- Custom error messages
- OpenAPI/Swagger documentation

### Rate Limiting
- Per-API-key rate limiting
- Configurable limits
- Redis-backed counter

### Message Queue Integration
- Publish events to message queue
- Async notification processing
- Retry logic on failures

### Health Checks
- Database connectivity
- Redis connectivity
- Message queue connectivity
- Dependency status

### Monitoring
- Request/response logging
- Correlation ID tracking
- Performance metrics
- Error tracking

## API Endpoints

### Notifications

#### Create Notification
```
POST /api/v1/notifications
Authorization: Bearer <token>

{
  "type": "email" | "sms" | "inapp",
  "recipient": "user@example.com",
  "subject": "Notification Title",
  "body": "Notification content",
  "templateId": "welcome-template",
  "templateData": { "name": "John" },
  "priority": "low" | "normal" | "high",
  "scheduledAt": "2024-01-15T10:00:00Z"
}
```

#### Get Notification
```
GET /api/v1/notifications/:id
Authorization: Bearer <token>
```

#### List Notifications
```
GET /api/v1/notifications?page=1&limit=20&status=sent
Authorization: Bearer <token>
```

#### Update Notification
```
PUT /api/v1/notifications/:id
Authorization: Bearer <token>
```

#### Delete Notification
```
DELETE /api/v1/notifications/:id
Authorization: Bearer <token>
```

### Templates

#### Create Template
```
POST /api/v1/templates
Authorization: Bearer <token>

{
  "name": "Welcome Email",
  "type": "email",
  "subject": "Welcome {{name}}",
  "body": "<h1>Hello {{name}}</h1>",
  "variables": ["name"]
}
```

#### Get/Update/Delete Templates
```
GET    /api/v1/templates/:id
PUT    /api/v1/templates/:id
DELETE /api/v1/templates/:id
```

### Health Checks

```
GET /health              # Basic health
GET /health/live         # Liveness probe
GET /health/ready        # Readiness probe
```

## Environment Variables

```env
# Server
NODE_ENV=development
API_PORT=8010
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/notify_db

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRATION=24h
API_KEY_ENABLED=true

# Message Queue
QUEUE_TYPE=bull
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Providers (for defaults)
EMAIL_PROVIDER=smtp
SMS_PROVIDER=twilio
```

## Development

### Setup
```bash
cd apps/api
npm install
```

### Run
```bash
npm run dev
```

### Test
```bash
npm test
npm test:watch
npm test:coverage
```

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
npm run lint:fix
npm run format
```

## Production

### Build Docker Image
```bash
docker build -t notification-api:latest -f Dockerfile .
```

### Run Container
```bash
docker run -p 8010:8010 \
  -e DATABASE_URL="..." \
  -e JWT_SECRET="..." \
  notification-api:latest
```

## Scaling

The API is stateless and can be scaled horizontally:
- Deploy multiple instances
- Use load balancer (nginx, cloud load balancer)
- Share session storage via Redis
- Share database (PostgreSQL)

## Error Handling

Standard error response format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [...]
  }
}
```

## Security

- JWT token validation
- Input validation with Zod
- Rate limiting per API key
- CORS protection
- Helmet security headers
- SQL injection prevention (Prisma)
- XSS protection

## Monitoring & Logging

- Structured JSON logging
- Request/response logging
- Correlation ID tracking
- Error stack traces
- Performance metrics
- Prometheus metrics ready

## OpenAPI Documentation

Interactive API docs available at:
- Development: `http://localhost:8010/docs`
- Swagger JSON: `http://localhost:8010/docs/json`

---

See root documentation for system overview and deployment instructions.
