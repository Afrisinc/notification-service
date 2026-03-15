# SMS Worker

Consumes SMS notifications from message queue and sends them via configured provider (Twilio or AfricasTalking).

## Overview

Independent worker service that:

- Listens to `notifications.sms` queue topic
- Validates phone numbers
- Sends SMS via configured provider
- Handles provider-specific rate limiting
- Updates notification status
- Implements retry with exponential backoff

## Supported Providers

### Twilio

```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1234567890
```

### AfricasTalking

```env
SMS_PROVIDER=africastalking
AFRICASTALKING_API_KEY=...
AFRICASTALKING_USERNAME=...
AFRICASTALKING_FROM_NAME=...
```

## Structure

```
worker-sms/
├── src/
│   ├── worker.ts
│   ├── processor.ts
│   ├── sender.ts
│   ├── providers/
│   │   ├── base.provider.ts
│   │   ├── twilio.provider.ts
│   │   └── africastalking.provider.ts
│   ├── validators/
│   │   └── phone.validator.ts
│   └── config/
│       └── logger.ts
├── Dockerfile
└── package.json
```

## Message Format

```typescript
interface SmsNotificationMessage {
  notificationId: string;
  tenantId: string;
  recipient: string; // Phone number
  body: string;
  metadata?: Record<string, any>;
}
```

## Processing Flow

1. Receive message from queue
2. Validate phone number
3. Fetch notification details
4. Resolve template (if applicable)
5. Check provider rate limits
6. Send SMS
7. Update notification status
8. Handle failures/retries

## Development

```bash
cd apps/worker-sms
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

SMS_PROVIDER=twilio|africastalking
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1234567890

# Retry
MAX_RETRIES=3
RETRY_BACKOFF_INITIAL=1000

# Rate Limiting
SMS_RATE_LIMIT=60  # per minute
```

## Docker

```bash
docker build -t notification-worker-sms:latest -f apps/worker-sms/Dockerfile .

docker run -e SMS_PROVIDER=twilio \
  -e TWILIO_ACCOUNT_SID=... \
  notification-worker-sms:latest
```

## Health Checks

```
GET /health
```

Returns queue, database, and provider connectivity status.

## Features

- Phone number validation (E.164 format)
- Provider rate limit handling
- Automatic retry on transient failures
- DLQ for permanent failures
- Structured logging
- Correlation ID tracking
- Provider-specific metrics

## Scaling

Run multiple instances:

```bash
docker run ... worker-sms-1
docker run ... worker-sms-2
docker run ... worker-sms-3
```

## See Also

- [Root README](../../README.md)
- [Architecture Documentation](../../docs/architecture.md)
