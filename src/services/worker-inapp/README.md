# In-App Worker

Consumes in-app notifications from message queue and persists them in the database for UI consumption.

## Overview

Independent worker service that:

- Listens to `notifications.inapp` queue topic
- Stores in-app notifications in database
- Marks as ready for retrieval
- Handles data persistence failures
- Updates notification status
- Supports user preference filtering

## Structure

```
worker-inapp/
├── src/
│   ├── worker.ts
│   ├── processor.ts
│   ├── sender.ts
│   ├── preferences/
│   │   └── filter.ts            # User notification preferences
│   ├── config/
│   │   └── logger.ts
│   └── index.ts
├── Dockerfile
└── package.json
```

## Message Format

```typescript
interface InAppNotificationMessage {
  notificationId: string;
  tenantId: string;
  userId: string;
  title: string;
  body: string;
  icon?: string;
  action?: {
    label: string;
    url: string;
  };
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
}
```

## Processing Flow

1. Receive message from queue
2. Validate user exists
3. Check user preferences (opt-out, etc.)
4. Create in-app notification record
5. Mark as "unread"
6. Index for retrieval
7. Update notification status

## Features

- User preference filtering
- Bulk creation for multiple users
- Automatic timestamp tracking
- Unread/read status management
- Full-text searchable
- TTL support (auto-delete old messages)

## Development

```bash
cd apps/worker-inapp
npm install
npm run dev
```

## Environment Variables

```env
NODE_ENV=development
LOG_LEVEL=debug

QUEUE_TYPE=bull
REDIS_URL=redis://localhost:6379

DATABASE_URL=postgresql://...

# Retention
INAPP_TTL=2592000      # 30 days in seconds
INAPP_MAX_PER_USER=100 # Maximum stored notifications per user
```

## Docker

```bash
docker build -t notification-worker-inapp:latest -f apps/worker-inapp/Dockerfile .

docker run -e DATABASE_URL=... \
  -e REDIS_URL=... \
  notification-worker-inapp:latest
```

## Database Schema

```prisma
model InAppNotification {
  id          String    @id @default(cuid())
  tenantId    String
  userId      String
  title       String
  body        String
  icon        String?
  actionUrl   String?
  actionLabel String?

  isRead      Boolean   @default(false)
  readAt      DateTime?

  priority    String    @default("normal")
  metadata    Json?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([tenantId])
  @@index([userId])
  @@index([isRead])
  @@index([createdAt])
}
```

## API Endpoints

Accessed via main API:

```
GET  /api/v1/notifications/inapp              # List notifications
GET  /api/v1/notifications/inapp/:id         # Get single
PATCH /api/v1/notifications/inapp/:id/read   # Mark as read
DELETE /api/v1/notifications/inapp/:id       # Delete
POST  /api/v1/notifications/inapp/mark-all   # Mark all as read
```

## Performance Considerations

- Batch operations for multiple users
- Periodic cleanup of old notifications
- Database indexing on userId, createdAt
- Redis caching for frequently accessed notifications

## Scaling

Run multiple instances for parallel processing:

```bash
docker run ... worker-inapp-1
docker run ... worker-inapp-2
```

## Health Checks

```
GET /health
```

Returns database and queue status.

## See Also

- [Root README](../../README.md)
- [Architecture Documentation](../../docs/architecture.md)
