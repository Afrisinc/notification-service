# Applications Directory

This directory contains independent applications that make up the Afrisinc Notification Service platform.

## Structure

### `api/`
**Fastify HTTP API Server** - Main entry point for notification management

- Purpose: RESTful API for managing notifications and templates
- Responsibilities:
  - Receive notification requests
  - Validate and persist notifications
  - Publish events to message queue
  - Handle authentication/authorization
  - Provide notification status updates
  - Serve API documentation

- Key Technologies:
  - Fastify (HTTP framework)
  - Zod (validation)
  - JWT (authentication)
  - Prisma (database ORM)

- Entry Point: `src/server.ts`
- Port: 3000 (default)

---

### `worker-email/`
**Email Notification Worker** - Processes and sends email notifications

- Purpose: Consume email notification events and send emails
- Responsibilities:
  - Listen for email notification events
  - Retrieve notification details
  - Connect to email provider (SMTP/SendGrid/AWS SES)
  - Send email
  - Handle failures and retries
  - Update notification status

- Supported Providers:
  - SMTP (built-in)
  - SendGrid
  - AWS SES

- Entry Point: `src/worker.ts`
- Message Queue Topic: `notifications.email`

---

### `worker-sms/`
**SMS Notification Worker** - Processes and sends SMS notifications

- Purpose: Consume SMS notification events and send SMS messages
- Responsibilities:
  - Listen for SMS notification events
  - Retrieve notification details
  - Connect to SMS provider (Twilio/AfricasTalking)
  - Send SMS
  - Handle failures and retries
  - Update notification status

- Supported Providers:
  - Twilio
  - AfricasTalking

- Entry Point: `src/worker.ts`
- Message Queue Topic: `notifications.sms`

---

### `worker-inapp/`
**In-App Notification Worker** - Processes and stores in-app notifications

- Purpose: Consume in-app notification events and persist them
- Responsibilities:
  - Listen for in-app notification events
  - Retrieve notification details
  - Store in-app notifications in database
  - Mark as available for UI consumption
  - Handle failures and retries
  - Update notification status

- Entry Point: `src/worker.ts`
- Message Queue Topic: `notifications.inapp`

---

## Application Communication

```
API (port 3000)
├── Receives notification request
├── Validates and stores
├── Publishes to Message Queue
│
├─→ worker-email
│   ├── Consumes from notifications.email topic
│   ├── Sends via email provider
│   └── Updates status
│
├─→ worker-sms
│   ├── Consumes from notifications.sms topic
│   ├── Sends via SMS provider
│   └── Updates status
│
└─→ worker-inapp
    ├── Consumes from notifications.inapp topic
    ├── Stores in database
    └── Updates status
```

## Package.json Structure

Each app has its own `package.json` with:
- App-specific dependencies
- Build/run scripts
- Docker configuration

Common scripts pattern:
```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "lint": "eslint src",
    "format": "prettier --write src"
  }
}
```

## Environment Variables

Each app reads from root `.env` file but can have app-specific variables:

```env
# Common
NODE_ENV=development
LOG_LEVEL=debug

# API specific
API_PORT=3000

# Workers
QUEUE_TYPE=bull
REDIS_URL=redis://localhost:6379

# Providers
EMAIL_PROVIDER=smtp
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
```

## Development Workflow

### Run All Apps
```bash
npm run dev
```

### Run Specific App
```bash
npm run api:dev
npm run worker:email:dev
npm run worker:sms:dev
npm run worker:inapp:dev
```

### Build All
```bash
npm run build
```

### Test All
```bash
npm test
```

## Docker

Each app has its own Dockerfile for independent deployment:

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

## Health Checks

Each application implements health check endpoints:

**API**: `GET /health` - Returns database, Redis, queue status
**Workers**: Health checks via environment/orchestration

## Logging

All apps use structured logging (Pino) with correlation IDs:

```typescript
logger.info({ correlationId, userId }, 'Notification created');
```

## Error Handling

- Common error classes in `packages/common/errors`
- Centralized error handlers in each app
- Proper HTTP status codes and error messages

## Independent Deployability

Each app can be:
- Developed independently
- Tested independently
- Deployed independently
- Scaled independently

Example: Deploy 10 API instances and 5 email workers.

---

See each app's README for specific details and setup instructions.
