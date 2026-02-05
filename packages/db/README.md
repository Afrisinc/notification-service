# Database Package

PostgreSQL database layer with Prisma ORM, migrations, repositories, and seeding.

## Overview

Centralized database access layer for the Afrisinc Notification Service. Provides:
- Prisma ORM schema and client
- Database migrations
- Repository pattern implementations
- Seeding scripts
- Query builders

## Directory Structure

```
db/
├── prisma/
│   ├── schema.prisma          # Complete Prisma schema
│   ├── seed.ts                # Database seed script
│   └── migrations/            # Versioned migrations (auto-generated)
│       └── migration_lock.toml
│
├── src/
│   ├── index.ts               # Main exports
│   ├── client.ts              # Prisma client singleton
│   ├── repositories/
│   │   ├── base.repository.ts
│   │   ├── notification.repository.ts
│   │   ├── template.repository.ts
│   │   ├── tenant.repository.ts
│   │   ├── webhook.repository.ts
│   │   ├── api-key.repository.ts
│   │   └── index.ts
│   │
│   ├── migrations/
│   │   ├── runner.ts          # Migration executor
│   │   ├── status.ts          # Migration status checker
│   │   └── index.ts
│   │
│   └── seed/
│       ├── index.ts
│       ├── users.seed.ts
│       ├── templates.seed.ts
│       └── api-keys.seed.ts
│
├── package.json
└── tsconfig.json
```

## Schema

### Core Tables

#### Tenant
```prisma
model Tenant {
  id            String    @id @default(cuid())
  name          String
  slug          String    @unique
  email         String
  maxNotifications Int   @default(100000)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  users         User[]
  notifications Notification[]
  templates     NotificationTemplate[]
  webhooks      WebhookConfig[]
  apiKeys       ApiKey[]
  logs          NotificationLog[]
}
```

#### User
```prisma
model User {
  id          String    @id @default(cuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  email       String
  name        String
  role        String    @default("user")
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([tenantId, email])
}
```

#### Notification
```prisma
model Notification {
  id              String    @id @default(cuid())
  tenantId        String
  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userId          String?
  templateId      String?
  template        NotificationTemplate? @relation(fields: [templateId], references: [id])

  channel         String    // email, sms, inapp
  recipient       String
  subject         String?
  body            String
  templateData    Json?

  status          String    @default("pending")
  priority        String    @default("normal")

  providerId      String?
  externalId      String?

  retries         Int       @default(0)
  nextRetryAt     DateTime?

  sentAt          DateTime?
  deliveredAt     DateTime?
  failedAt        DateTime?
  failureReason   String?

  metadata        Json?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  logs            NotificationLog[]

  @@index([tenantId])
  @@index([status])
  @@index([channel])
  @@index([createdAt])
}
```

#### NotificationTemplate
```prisma
model NotificationTemplate {
  id          String    @id @default(cuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  name        String
  description String?
  channel     String
  subject     String?
  body        String
  variables   String[]

  isActive    Boolean   @default(true)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  notifications Notification[]

  @@unique([tenantId, name])
  @@index([channel])
}
```

#### WebhookConfig
```prisma
model WebhookConfig {
  id          String    @id @default(cuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  url         String
  events      String[]
  secret      String
  isActive    Boolean   @default(true)

  lastTriggeredAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([tenantId])
}
```

#### ApiKey
```prisma
model ApiKey {
  id          String    @id @default(cuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  name        String
  key         String    @unique
  secret      String

  isActive    Boolean   @default(true)
  lastUsedAt  DateTime?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([tenantId])
  @@unique([tenantId, name])
}
```

#### NotificationLog
```prisma
model NotificationLog {
  id              String    @id @default(cuid())
  tenantId        String
  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  notificationId  String
  notification    Notification @relation(fields: [notificationId], references: [id], onDelete: Cascade)

  event           String
  message         String
  metadata        Json?

  createdAt       DateTime  @default(now())

  @@index([tenantId])
  @@index([notificationId])
  @@index([event])
}
```

## Repositories

Each repository provides type-safe database access:

```typescript
import { notificationRepository } from '@afrisinc/notify-db';

// Create
const notif = await notificationRepository.create({
  tenantId: 'tenant-1',
  channel: 'email',
  recipient: 'user@example.com',
  body: 'Hello!',
});

// Find
const found = await notificationRepository.findById(notif.id);

// Update
const updated = await notificationRepository.update(notif.id, {
  status: 'sent',
});

// List with pagination
const { data, total } = await notificationRepository.findPaginated({
  tenantId: 'tenant-1',
  status: 'pending',
}, 1, 20);

// Query
const failed = await notificationRepository.findFailed(
  'tenant-1',
  { limit: 100 }
);
```

## Database Setup

### Initial Setup

```bash
# Install dependencies
npm install

# Create .env
cp ../../.env.example .env

# Run migrations
npm run migrate:deploy

# Seed database (optional)
npm run seed
```

### Migrations

```bash
# Create new migration
npm run migrate:create -- --name add_user_preferences

# Apply pending migrations
npm run migrate:deploy

# Reset database (development only)
npm run migrate:reset

# Check migration status
npm run migrate:status
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/notify_db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

## Usage

### Import Prisma Client

```typescript
import { prisma } from '@afrisinc/notify-db';

// Direct access to Prisma models
const notifications = await prisma.notification.findMany({
  where: { status: 'pending' },
});
```

### Use Repositories

```typescript
import {
  notificationRepository,
  templateRepository,
  tenantRepository,
} from '@afrisinc/notify-db';

// Create notification
const notif = await notificationRepository.create({...});

// Find templates
const templates = await templateRepository.findByChannel('email');

// Get tenant
const tenant = await tenantRepository.findById('tenant-1');
```

## Best Practices

1. **Always use repositories** for business logic
2. **Use transactions** for multi-table operations
3. **Index frequently queried fields**
4. **Soft delete** instead of hard delete
5. **Keep migration files** for auditing
6. **Test migrations** in development first
7. **Use connection pooling** in production

## Performance Optimization

### Connection Pooling

```env
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

### Query Optimization

- Use `select` to fetch only needed fields
- Use `include` for relations instead of separate queries
- Use `findMany` with `skip/take` for pagination
- Create indexes on frequently filtered columns

### Migration Strategies

- Create indexes before mass operations
- Use `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` for safe migrations
- Test migrations on staging before production
- Plan for zero-downtime deployments

## Troubleshooting

### Migration Failures

```bash
# Check migration status
npm run migrate:status

# Reset migrations (dev only)
npm run migrate:reset

# Manually fix migration file and retry
npm run migrate:deploy
```

### Connection Issues

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check pool status
npm run db:status
```

## Seeding

Seed provides sample data for development:

```bash
npm run seed
```

Includes:
- Test tenants
- Test users
- Sample templates
- API keys for testing

## See Also

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Root README](../../README.md)
- [Architecture Documentation](../../docs/architecture.md)
