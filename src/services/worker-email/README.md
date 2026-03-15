# Email Worker

Consumes email notifications from message queue and sends them via configured provider (SMTP, SendGrid, AWS SES).

## Overview

Independent worker service that:

- Listens to `notifications.email` queue topic
- Fetches notification details from database
- Sends email via configured provider
- Handles failures with exponential backoff
- Updates notification status
- Supports DLQ (Dead Letter Queue) for unrecoverable failures

## Structure

```
worker-email/
├── src/
│   ├── worker.ts                  # Worker initialization
│   ├── processor.ts               # Queue message processor
│   ├── sender.ts                  # Email sending orchestrator
│   ├── providers/
│   │   ├── base.provider.ts       # Abstract base class
│   │   ├── smtp.provider.ts       # SMTP provider
│   │   ├── sendgrid.provider.ts   # SendGrid API
│   │   └── aws-ses.provider.ts    # AWS SES
│   ├── config/
│   │   └── logger.ts              # Logger configuration
│   └── index.ts
├── Dockerfile
└── package.json
```

## Supported Providers

### SMTP

- Protocol: SMTP/TLS
- Configuration:
  ```env
  EMAIL_PROVIDER=smtp
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=user@gmail.com
  SMTP_PASS=password
  SMTP_TLS=true
  ```

### SendGrid

- API-based email service
- Configuration:
  ```env
  EMAIL_PROVIDER=sendgrid
  SENDGRID_API_KEY=SG.xxx
  EMAIL_FROM=noreply@example.com
  ```

### AWS SES

- AWS service
- Configuration:
  ```env
  EMAIL_PROVIDER=aws-ses
  AWS_REGION=us-east-1
  AWS_ACCESS_KEY_ID=xxx
  AWS_SECRET_ACCESS_KEY=xxx
  EMAIL_FROM=noreply@example.com
  ```

## Message Format

Receives from queue:

```typescript
interface EmailNotificationMessage {
  notificationId: string;
  tenantId: string;
  recipient: string;
  subject: string;
  body: string;
  htmlBody?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
  metadata?: Record<string, any>;
}
```

## Processing Flow

```
1. Receive message from queue
   ↓
2. Validate message
   ↓
3. Fetch notification from database
   ↓
4. Resolve template (if applicable)
   ↓
5. Validate email address
   ↓
6. Send via provider
   ↓
7. On success:
   - Update status to 'sent'
   - Log delivery
   - Mark message as consumed
   ↓
8. On failure:
   - Check if retryable
   - If yes: Schedule retry with backoff
   - If no: Move to DLQ, mark as failed
```

## Features

### Retry Logic

- Automatic retry on transient failures
- Exponential backoff
- Max 3 retries by default
- Configurable backoff parameters

### Error Handling

- Distinguishes retryable vs permanent errors
- Invalid email: Non-retryable
- Provider timeout: Retryable
- Authentication failure: Non-retryable

### Dead Letter Queue (DLQ)

- Unrecoverable failures sent to DLQ
- Manual replay capability
- Preserved for investigation

### Monitoring

- Structured logging per message
- Correlation ID tracking
- Success/failure metrics
- Provider-specific error details

## Development

### Setup

```bash
cd apps/worker-email
npm install
```

### Run

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
npm test:coverage
```

## Environment Variables

```env
# Common
NODE_ENV=development
LOG_LEVEL=debug

# Queue
QUEUE_TYPE=bull
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/notify_db

# Email Provider
EMAIL_PROVIDER=smtp|sendgrid|aws-ses
EMAIL_FROM=noreply@example.com

# SMTP specific
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password

# Retry Settings
MAX_RETRIES=3
RETRY_BACKOFF_INITIAL=1000
RETRY_BACKOFF_MAX=60000

# Rate limiting
EMAIL_RATE_LIMIT=100  # emails per minute
```

## Docker

```bash
# Build
docker build -t notification-worker-email:latest -f apps/worker-email/Dockerfile .

# Run
docker run -e DATABASE_URL="..." \
  -e REDIS_URL="..." \
  -e EMAIL_PROVIDER="smtp" \
  notification-worker-email:latest
```

## Health Checks

Worker implements health check endpoint:

```
GET /health

{
  "status": "UP",
  "uptime": 3600,
  "lastProcessed": "2024-01-15T10:30:00Z",
  "messagesProcessed": 1250,
  "failureRate": 0.02,
  "checks": {
    "queue": { "status": "UP" },
    "database": { "status": "UP" }
  }
}
```

## Scaling

Run multiple instances for parallel processing:

```bash
docker run ... worker-1
docker run ... worker-2
docker run ... worker-3
```

Load balanced via message queue:

- Bull: Redis-backed, automatic distribution
- RabbitMQ: Queue-based distribution

## Monitoring

### Metrics to Track

- Messages processed per minute
- Success/failure rate
- Average processing time
- Queue depth
- Retry attempts
- DLQ size

### Logging

```
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Email sent successfully",
  "notificationId": "notif-123",
  "tenantId": "tenant-1",
  "recipient": "user@example.com",
  "provider": "smtp",
  "processingTime": 245,
  "externalId": "email-id-123"
}
```

## Troubleshooting

### Provider Connection Issues

```bash
# Test SMTP
telnet smtp.example.com 587

# Test SendGrid
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $SENDGRID_API_KEY"
```

### Queue Connection Issues

```bash
# Check Redis
redis-cli ping

# Check RabbitMQ
rabbitmqctl status
```

### Message Stuck in Queue

```bash
# Check queue
npm run queue:status

# Replay message
npm run queue:replay -- <message-id>
```

## See Also

- [Root README](../../README.md)
- [Architecture Documentation](../../docs/architecture.md)
- [Email Providers Setup](../../docs/providers.md)
