# Common Package

Shared types, enums, events, utilities, and error classes used across all applications.

## Overview

This package provides the building blocks for type-safe development across the notification service platform.

## Directory Structure

```
common/
├── src/
│   ├── types/
│   │   ├── notification.types.ts    # Notification-related types
│   │   ├── template.types.ts        # Template-related types
│   │   ├── tenant.types.ts          # Tenant/User types
│   │   ├── queue.types.ts           # Message queue types
│   │   ├── provider.types.ts        # Email/SMS provider types
│   │   └── webhook.types.ts         # Webhook types
│   │
│   ├── enums/
│   │   ├── channel.enum.ts          # Email, SMS, InApp
│   │   ├── status.enum.ts           # Pending, Sent, Failed, etc.
│   │   ├── priority.enum.ts         # Low, Normal, High
│   │   └── provider.enum.ts         # Provider names
│   │
│   ├── events/
│   │   ├── notification.events.ts   # Notification event interfaces
│   │   ├── template.events.ts       # Template event interfaces
│   │   └── index.ts                 # Event exports
│   │
│   ├── queue/
│   │   ├── publisher.ts             # Event publisher interface
│   │   ├── consumer.ts              # Event consumer interface
│   │   └── index.ts
│   │
│   ├── errors/
│   │   ├── service.error.ts         # Base error class
│   │   ├── validation.error.ts      # Validation errors
│   │   ├── provider.error.ts        # Provider-specific errors
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── idempotency.ts           # Idempotency helpers
│   │   ├── backoff.ts               # Exponential backoff
│   │   ├── validation.ts            # Input validation
│   │   ├── template.ts              # Template variable parsing
│   │   ├── logger.ts                # Logging utilities
│   │   └── index.ts
│   │
│   ├── constants/
│   │   ├── notifications.ts         # Notification constants
│   │   ├── templates.ts             # Template constants
│   │   ├── providers.ts             # Provider constants
│   │   └── index.ts
│   │
│   └── index.ts                     # Main exports
│
├── package.json
└── tsconfig.json
```

## Key Exports

### Types

```typescript
import { Notification, NotificationTemplate, Tenant, NotificationLog, WebhookConfig } from '@afrisinc/notify-common';
```

### Enums

```typescript
import { NotificationChannel, NotificationStatus, NotificationPriority, ProviderName } from '@afrisinc/notify-common';

// Usage
const notification: Notification = {
  channel: NotificationChannel.EMAIL,
  status: NotificationStatus.PENDING,
  priority: NotificationPriority.HIGH,
};
```

### Events

```typescript
import {
  NotificationCreatedEvent,
  NotificationSentEvent,
  NotificationFailedEvent,
  TemplateUpdatedEvent,
} from '@afrisinc/notify-common';
```

### Errors

```typescript
import { ServiceError, ValidationError, ProviderError, RetryableError } from '@afrisinc/notify-common';

throw new ValidationError('Invalid email format');
throw new ProviderError('Failed to send email', { provider: 'sendgrid' });
```

### Utilities

```typescript
import {
  generateIdempotencyKey,
  calculateBackoff,
  validateEmail,
  parseTemplateVariables,
  logger,
} from '@afrisinc/notify-common';
```

## Type Definitions

### Notification

```typescript
interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  templateId?: string;
  templateData?: Record<string, any>;
  status: NotificationStatus;
  priority: NotificationPriority;
  providerId?: string;
  externalId?: string;
  retries: number;
  nextRetryAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

### NotificationTemplate

```typescript
interface NotificationTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Enums

### NotificationChannel

```typescript
enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'inapp',
}
```

### NotificationStatus

```typescript
enum NotificationStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  UNSUBSCRIBED = 'unsubscribed',
}
```

### NotificationPriority

```typescript
enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}
```

## Events

### Notification Events

```typescript
interface NotificationCreatedEvent {
  type: 'notification.created';
  timestamp: Date;
  data: {
    notificationId: string;
    tenantId: string;
    channel: NotificationChannel;
    recipient: string;
  };
}

interface NotificationSentEvent {
  type: 'notification.sent';
  timestamp: Date;
  data: {
    notificationId: string;
    sentAt: Date;
    externalId?: string;
  };
}

interface NotificationFailedEvent {
  type: 'notification.failed';
  timestamp: Date;
  data: {
    notificationId: string;
    reason: string;
    retryable: boolean;
  };
}
```

## Usage Examples

### Validation Error

```typescript
import { ValidationError } from '@afrisinc/notify-common';

try {
  if (!email.includes('@')) {
    throw new ValidationError('Invalid email format', {
      field: 'email',
      value: email,
    });
  }
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.context);
  }
}
```

### Template Variables

```typescript
import { parseTemplateVariables } from '@afrisinc/notify-common';

const template = 'Hello {{name}}, your order {{orderId}} is confirmed';
const variables = parseTemplateVariables(template);
// Returns: ['name', 'orderId']
```

### Exponential Backoff

```typescript
import { calculateBackoff } from '@afrisinc/notify-common';

const delay = calculateBackoff(retryCount, {
  initialDelay: 1000,
  maxDelay: 60000,
  multiplier: 2,
});
```

## Adding New Types/Enums

1. Create in appropriate subdirectory under `src/`
2. Export from `src/index.ts`
3. Update this README with documentation
4. Run `npm run build` in this package
5. Update consuming applications to use new types

## Best Practices

- Keep types focused and single-purpose
- Use enums for fixed sets of values
- Document complex type structures
- Export all public types from `src/index.ts`
- Don't export implementation details
- Use consistent naming conventions

## Testing

```bash
npm test
npm test:watch
npm test:coverage
```

## Building

```bash
npm run build
npm run type-check
```

## Linting

```bash
npm run lint
npm run lint:fix
npm run format
```

## Dependencies

- zod (for runtime validation)
- No external dependencies for types/enums

## See Also

- [Root README](../../README.md)
- [Architecture Documentation](../../docs/architecture.md)
- [Config Package](../config/README.md)
- [DB Package](../db/README.md)
