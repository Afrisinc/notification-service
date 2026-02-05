# Shared Packages

This directory contains reusable packages shared across all applications (API and Workers).

## Structure

### `common/`
**Shared types, utilities, and event definitions**

- Purpose: Centralize types and utilities used across all services
- Exports:
  - Type definitions for notifications, templates, tenants
  - Enums for channels, statuses, priorities
  - Event interface definitions
  - Queue publisher/consumer interfaces
  - Utility functions (idempotency, backoff, etc.)
  - Custom error classes

- Key Files:
  - `src/types/` - TypeScript interfaces
  - `src/enums/` - Enum definitions
  - `src/events/` - Event interfaces
  - `src/queue/` - Queue abstractions
  - `src/errors/` - Error classes
  - `src/utils/` - Shared utilities

- Usage:
  ```typescript
  import { NotificationTypes, NotificationStatus } from '@afrisinc/notify-common';
  ```

---

### `db/`
**Database layer with Prisma ORM**

- Purpose: Centralize database schema and data access patterns
- Exports:
  - Prisma client
  - Database migration functions
  - Seed scripts
  - Repository patterns
  - Query builders

- Structure:
  ```
  db/
  ├── prisma/
  │   ├── schema.prisma        # Complete Prisma schema
  │   ├── migrations/          # Versioned migrations
  │   └── README.md
  ├── src/
  │   ├── repositories/        # Repository classes
  │   ├── migrations.ts        # Migration runners
  │   └── seed.ts             # Database seeding
  └── package.json
  ```

- Key Tables:
  - `Tenant` - Multi-tenant support
  - `User` - Users
  - `Notification` - Notification records
  - `NotificationTemplate` - Email/SMS templates
  - `NotificationLog` - Audit log
  - `Webhook` - Webhook configurations
  - `ApiKey` - API key management

- Usage:
  ```typescript
  import { prisma } from '@afrisinc/notify-db';
  const notification = await prisma.notification.create({...});
  ```

---

### `config/`
**Centralized configuration management**

- Purpose: Manage environment variables and configuration across services
- Exports:
  - Environment variable schemas
  - Configuration getters
  - Type-safe config access
  - Provider configurations

- Key Exports:
  - `getConfig()` - Get all configuration
  - `isDevelopment()` - Environment checks
  - `isProduction()`
  - Provider configs (email, SMS, queue, etc.)

- Environment Variables:
  - Application (NODE_ENV, PORT, LOG_LEVEL)
  - Database (DATABASE_URL, pool settings)
  - Redis (REDIS_URL, REDIS_PASSWORD)
  - Queue (QUEUE_TYPE, RABBITMQ_URL, BULL_REDIS_URL)
  - Authentication (JWT_SECRET, API_KEY_ENABLED)
  - Email Provider (EMAIL_PROVIDER, SMTP settings, SendGrid, AWS SES)
  - SMS Provider (SMS_PROVIDER, Twilio, AfricasTalking)
  - External Services (Sentry, Datadog, etc.)

- Usage:
  ```typescript
  import { getConfig, isDevelopment } from '@afrisinc/notify-config';
  const config = getConfig();
  ```

---

## Dependency Graph

```
API → Common ← Workers
 ↓
DB ← (Migrations, Repositories)
 ↓
Config ← (All services)
```

## Monorepo Workspace Setup

The project uses npm workspaces:

```json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

Run commands across all workspaces:
```bash
npm install                    # Install all deps
npm run build -ws             # Build all workspaces
npm test -ws                  # Test all workspaces
npm run dev -ws               # Dev all workspaces
```

Run command in specific workspace:
```bash
npm run build -w @afrisinc/notify-db
npm run dev -w @afrisinc/notify-api
```

## Version Management

All packages use semantic versioning and are versioned together for simplicity.

Current version: 1.0.0

## Publishing

These packages are internal and not published to npm registry. They're consumed via workspace references.

## Adding New Shared Code

1. Create in appropriate package (common, db, or config)
2. Export from `src/index.ts`
3. Update `package.json` exports if needed
4. Update workspace dependencies if adding new package
5. Document in this README

## Internal Usage

```typescript
// ✅ Correct - use workspace imports
import { getConfig } from '@afrisinc/notify-config';
import { prisma } from '@afrisinc/notify-db';
import { NotificationStatus } from '@afrisinc/notify-common';

// ❌ Avoid - relative imports
import config from '../../../packages/config';
```

## Consistency Across Services

These shared packages ensure:
- Single source of truth for types and enums
- Consistent error handling
- Unified configuration
- Standard database patterns
- Shared utilities and helpers

## Further Reading

- See each package's README for detailed documentation
- See root ARCHITECTURE.md for system design
- See CONTRIBUTING.md for development guidelines

---

Maintain these packages carefully as they're the backbone of the system.
