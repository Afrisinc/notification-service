# RabbitMQ Setup & Email Flow Test Guide

## Overview

This guide explains how to set up and test the complete email notification flow:

```
API (send notification)
  → RabbitMQ (message queue)
  → Worker Email (consume & process)
  → SMTP/MailHog (send email)
  → Recipient (receives email)
```

## Architecture

### Components

- **API Service**: Fastify server that receives notification requests and publishes to RabbitMQ
- **RabbitMQ**: Message broker that queues notifications for processing
- **Worker Email**: Consumes messages from RabbitMQ and sends emails via SMTP
- **MailHog**: Development SMTP server that captures all outgoing emails
- **PostgreSQL**: Database for storing notifications and templates
- **Redis**: Cache layer (optional for this flow)

### Message Flow

```
1. Client sends: POST /api/notify/send
   ↓
2. API validates request & template
   ↓
3. API publishes message to RabbitMQ queue: "email-notifications"
   ↓
4. Worker consumes message from queue
   ↓
5. Worker processes email (load template, render, validate)
   ↓
6. Worker sends via SMTP (MailHog in dev)
   ↓
7. Worker updates notification status to SENT
   ↓
8. Database updated with final status
```

## Quick Start

### 1. Install Dependencies

```bash
# Install all dependencies
npm install

# Or for just the changed packages
npm install -w @afrisinc-notify/api -w @afrisinc-notify/worker-email
```

### 2. Start Services

```bash
# Start all services with docker-compose
docker-compose up -d

# Check service status
docker-compose ps

# Expected output:
# NAME                         STATUS
# notification-postgres        Up (healthy)
# notification-redis           Up (healthy)
# notification-rabbitmq        Up (healthy)
# notification-mailhog         Up
# notification-api             Up (healthy)
# notification-worker-email    Up
# notification-pgadmin         Up
```

### 3. Verify Services Are Ready

```bash
# Check API health
curl http://localhost:8010/health/live

# Check RabbitMQ
curl -u admin:password http://localhost:15672/api/overview

# Check MailHog
curl http://localhost:8025/api/v1/messages
```

### 4. View Service Dashboards

- **API Swagger**: http://localhost:8010/docs
- **RabbitMQ Management**: http://localhost:15672 (admin:password)
- **MailHog**: http://localhost:8025
- **PgAdmin**: http://localhost:5050

## Testing the Full Email Flow

### Step 1: Create a Tenant

```bash
curl -X POST http://localhost:8010/api/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "code": "test-tenant",
    "name": "Test Tenant"
  }'

# Response:
{
  "success": true,
  "data": {
    "id": "tenant-uuid-here",
    "code": "test-tenant",
    "name": "Test Tenant",
    "status": "ACTIVE"
  }
}
```

Save the tenant ID for next steps: `TENANT_ID=tenant-uuid-here`

### Step 2: Create API Key

```bash
TENANT_ID="your-tenant-id"

curl -X POST http://localhost:8010/api/admin/tenants/$TENANT_ID/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name": "test-key"}'

# Response:
{
  "success": true,
  "data": {
    "id": "key-uuid",
    "name": "test-key",
    "key": "full-key-shown-once",
    "createdAt": "2024-02-10T..."
  }
}
```

Save the API key: `API_KEY=full-key-shown-once`

### Step 3: Create Email Template

```bash
API_KEY="your-api-key"

curl -X POST http://localhost:8010/api/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "code": "WELCOME_EMAIL",
    "channel": "EMAIL",
    "language": "en",
    "subject": "Welcome to {{appName}}, {{userName}}!",
    "content": "<h1>Welcome {{userName}}</h1><p>Thank you for joining {{appName}}!</p>",
    "description": "Welcome email template"
  }'

# Response includes template ID
```

### Step 4: Send Test Notification

```bash
API_KEY="your-api-key"

curl -X POST http://localhost:8010/api/notify/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "channel": "EMAIL",
    "recipient": "john@example.com",
    "templateCode": "WELCOME_EMAIL",
    "payload": {
      "appName": "Afrisinc Notify",
      "userName": "John Doe"
    },
    "priority": "NORMAL"
  }'

# Response:
{
  "success": true,
  "resp_msg": "Notification queued for processing",
  "resp_code": 202,
  "data": {
    "notificationId": "notif-uuid",
    "status": "PENDING"
  }
}
```

Save notification ID: `NOTIFICATION_ID=notif-uuid`

### Step 5: Monitor Worker Processing

```bash
# View worker logs in real-time
docker-compose logs -f worker-email

# Expected logs:
# ✅ Email worker connected to RabbitMQ
# 🔄 Processing email from queue
# 📧 Email sent successfully via SMTP
# ✅ Email job completed and acknowledged
```

### Step 6: Check Email in MailHog

```bash
# View all emails
curl http://localhost:8025/api/v1/messages

# View specific email
curl http://localhost:8025/api/v1/messages/0

# Or open browser: http://localhost:8025
```

### Step 7: Check Notification Status

```bash
API_KEY="your-api-key"
NOTIFICATION_ID="your-notification-id"

curl http://localhost:8010/api/notify/$NOTIFICATION_ID \
  -H "Authorization: Bearer $API_KEY"

# Expected response shows status: SENT
```

## Docker Compose Configuration

### Environment Variables

The `docker-compose.yml` includes:

```yaml
API Service:
  - QUEUE_PROVIDER=rabbitmq
  - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672

Worker Service:
  - RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
  - EMAIL_PROVIDER=smtp
  - SMTP_HOST=mailhog
  - SMTP_PORT=1025
```

### RabbitMQ Queue Configuration

- **Queue Name**: `email-notifications`
- **Durable**: Yes (survives server restarts)
- **Message TTL**: 24 hours
- **Prefetch**: 1 (fair distribution to workers)

## Troubleshooting

### API Won't Start

```bash
# Check logs
docker-compose logs api

# Common issues:
# - Database not ready: Wait for postgres health check
# - RabbitMQ not ready: Ensure RabbitMQ service is healthy
# - Port 8010 in use: Change PORT in docker-compose.yml
```

### Worker Not Processing Messages

```bash
# Check worker logs
docker-compose logs worker-email

# Check RabbitMQ queue
curl -u admin:password http://localhost:15672/api/queues/%2F/email-notifications

# Verify worker is consuming
# Should see "🔄 Processing email from queue" messages

# If stuck, restart worker:
docker-compose restart worker-email
```

### Email Not Arriving in MailHog

```bash
# Check MailHog is running
docker-compose ps mailhog

# View MailHog logs
docker-compose logs mailhog

# Check SMTP connection from worker
docker-compose logs worker-email | grep -i smtp
```

### Template Code Format Error

```bash
# Error: pattern: ^[A-Z_]+$

# Template codes must be:
# ✅ WELCOME_EMAIL
# ✅ ORDER_CONFIRMATION
# ✅ PASSWORD_RESET
# ❌ welcome-email (lowercase)
# ❌ Welcome Email (spaces)
```

## Performance Monitoring

### Check Queue Depth

```bash
curl -u admin:password \
  http://localhost:15672/api/queues/%2F/email-notifications | jq '.messages_ready'
```

### Monitor Worker Throughput

```bash
# Count processed emails per minute
docker-compose logs worker-email | grep "Email job completed" | wc -l
```

### Database Queries

```bash
# Via PgAdmin (http://localhost:5050)
# - Count notifications: SELECT COUNT(*) FROM "Notification"
# - Check statuses: SELECT status, COUNT(*) FROM "Notification" GROUP BY status
```

## Advanced Configuration

### Scale Workers

```bash
# Run multiple worker instances
docker-compose up -d --scale worker-email=3
```

### Change Email Provider

```yaml
# In docker-compose.yml, change for API service:
EMAIL_PROVIDER: sendgrid
SENDGRID_API_KEY: your-key-here
```

### Increase Queue Retention

```yaml
# In worker-email environment:
# x-message-ttl: 86400000 (24 hours)
# Change to: 604800000 (7 days)
```

## Testing with PowerShell

If using PowerShell instead of bash:

```powershell
# Create tenant
$tenant = curl -X POST http://localhost:8010/api/admin/tenants `
  -H "Content-Type: application/json" `
  -d '{"code":"test","name":"Test"}' | ConvertFrom-Json

$TENANT_ID = $tenant.data.id

# Create API key
$key = curl -X POST "http://localhost:8010/api/admin/tenants/$TENANT_ID/api-keys" `
  -H "Content-Type: application/json" `
  -d '{"name":"test"}' | ConvertFrom-Json

$API_KEY = $key.data.key

# Send notification
curl -X POST http://localhost:8010/api/notify/send `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $API_KEY" `
  -d '{...}' | ConvertFrom-Json
```

## Clean Up

```bash
# Stop all services
docker-compose down

# Remove all data (volumes)
docker-compose down -v

# View logs before cleanup
docker-compose logs > logs.txt
```

## Next Steps

1. ✅ Complete end-to-end email flow working
2. Add SMS notifications (Twilio/Nexmo)
3. Add Push notifications (Firebase/OneSignal)
4. Add In-App notifications (WebSocket)
5. Scale to multiple workers
6. Add metrics & monitoring
7. Deploy to production (AWS/GCP/Azure)

## Support

Check logs for detailed error messages:

```bash
docker-compose logs api
docker-compose logs worker-email
docker-compose logs rabbitmq
docker-compose logs postgres
```

All services log to stdout and stderr for easy debugging.
