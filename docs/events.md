# Event Specifications

## Overview

The notification service uses event-driven architecture for asynchronous processing. Events are published to Bull queues for consumption by worker services.

## Event Types

### 1. Email Notification Event

**Queue:** `email-notifications`

**Payload:**
```json
{
  "id": "notif_1234567890_abc123def",
  "tenantId": "tenant-uuid",
  "recipientId": "user-uuid",
  "channel": "email",
  "subject": "Welcome to Platform",
  "body": "Plain text body",
  "htmlBody": "<h1>Welcome</h1>",
  "recipient": "user@example.com",
  "templateId": "template-uuid",
  "priority": "normal",
  "metadata": {
    "userId": "user-uuid",
    "campaignId": "campaign-uuid"
  }
}
```

**Processing:**
- Email worker consumes job
- Selects provider based on tenant configuration
- Sends email via SMTP/SendGrid/AWS SES
- Updates notification status to "sent" or "failed"
- Logs delivery information

**Retry Strategy:**
- Maximum 3 attempts
- Exponential backoff: 2s, 4s, 8s
- Failed jobs moved to DLQ after max retries

---

### 2. SMS Notification Event

**Queue:** `sms-notifications`

**Payload:**
```json
{
  "id": "notif_1234567890_abc123def",
  "tenantId": "tenant-uuid",
  "recipientId": "user-uuid",
  "channel": "sms",
  "body": "Your verification code is 123456",
  "recipient": "+1234567890",
  "priority": "high",
  "metadata": {
    "code": "123456",
    "expiresAt": "2024-02-04T12:00:00Z"
  }
}
```

**Processing:**
- SMS worker consumes job
- Selects provider based on tenant configuration
- Sends SMS via Twilio/AfricasTalking
- Updates notification status
- Logs delivery information

**Retry Strategy:**
- Maximum 3 attempts
- Exponential backoff: 2s, 4s, 8s
- Failed jobs moved to DLQ

---

### 3. In-App Notification Event

**Queue:** `inapp-notifications`

**Payload:**
```json
{
  "id": "notif_1234567890_abc123def",
  "tenantId": "tenant-uuid",
  "recipientId": "user-uuid",
  "channel": "inapp",
  "subject": "Order Confirmed",
  "body": "Your order #12345 has been confirmed",
  "priority": "normal",
  "metadata": {
    "orderId": "order-uuid",
    "actionUrl": "/orders/order-uuid"
  }
}
```

**Processing:**
- In-app worker consumes job
- Stores notification in database
- Checks user preferences
- Sends real-time push (if enabled)
- Updates notification status to "sent"

**Retry Strategy:**
- Maximum 3 attempts
- Exponential backoff: 2s, 4s, 8s

---

## Webhook Events

Webhooks are sent to notify external systems of notification events.

### Webhook Event Types

#### notification.created
Triggered when a notification is created.

```json
{
  "event": "notification.created",
  "timestamp": "2024-02-04T10:30:00Z",
  "data": {
    "id": "notif_1234567890_abc123def",
    "tenantId": "tenant-uuid",
    "recipientId": "user-uuid",
    "channel": "email",
    "status": "pending"
  }
}
```

#### notification.sent
Triggered when a notification is successfully delivered.

```json
{
  "event": "notification.sent",
  "timestamp": "2024-02-04T10:35:00Z",
  "data": {
    "id": "notif_1234567890_abc123def",
    "tenantId": "tenant-uuid",
    "channel": "email",
    "externalId": "sg-message-id-123",
    "sentAt": "2024-02-04T10:35:00Z"
  }
}
```

#### notification.failed
Triggered when a notification fails to deliver.

```json
{
  "event": "notification.failed",
  "timestamp": "2024-02-04T10:40:00Z",
  "data": {
    "id": "notif_1234567890_abc123def",
    "tenantId": "tenant-uuid",
    "channel": "email",
    "reason": "Invalid email address",
    "failedAt": "2024-02-04T10:40:00Z"
  }
}
```

#### notification.opened
Triggered when an in-app notification is opened.

```json
{
  "event": "notification.opened",
  "timestamp": "2024-02-04T10:45:00Z",
  "data": {
    "id": "notif_1234567890_abc123def",
    "tenantId": "tenant-uuid",
    "recipientId": "user-uuid",
    "openedAt": "2024-02-04T10:45:00Z"
  }
}
```

#### notification.clicked
Triggered when an in-app notification is clicked.

```json
{
  "event": "notification.clicked",
  "timestamp": "2024-02-04T10:50:00Z",
  "data": {
    "id": "notif_1234567890_abc123def",
    "tenantId": "tenant-uuid",
    "recipientId": "user-uuid",
    "clickedAt": "2024-02-04T10:50:00Z"
  }
}
```

### Webhook Delivery

**Configuration:**
- Endpoint URL: Set in tenant settings
- Secret: Used for HMAC-SHA256 signature
- Retry Strategy: Exponential backoff (up to 5 retries)
- Timeout: 30 seconds

**Headers:**
```
X-Webhook-Event: notification.sent
X-Webhook-Signature: sha256=abcd1234...
X-Webhook-Delivery-ID: delivery-uuid
X-Webhook-Timestamp: 2024-02-04T10:35:00Z
```

**Verification:**
```javascript
const crypto = require('crypto');

const signature = req.headers['x-webhook-signature'];
const body = req.rawBody;
const secret = process.env.WEBHOOK_SECRET;

const expected = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');

const valid = crypto.timingSafeEqual(signature, expected);
```

---

## Event Status Transitions

```
Notification Status Flow:
┌──────────┐
│ pending  │  ← Created, waiting for processing
└────┬─────┘
     │
     ├─→ ┌──────────┐
     │   │ sent     │  ← Successfully delivered
     │   └──────────┘
     │
     ├─→ ┌──────────┐
     │   │ failed   │  ← Failed after max retries
     │   └──────────┘
     │
     └─→ ┌──────────┐
         │ bounced  │  ← Delivery bounced (email)
         └──────────┘

In-App Additional Statuses:
sent → ┌──────────┐ → opened → ┌──────────┐
       │ opened   │            │ clicked  │
       └──────────┘            └──────────┘
```

---

## Dead Letter Queue (DLQ)

Failed jobs are moved to DLQ after exceeding max retries.

**DLQ Processing:**
- Manual review required
- Retry capability
- Analysis for systemic issues
- Metrics and alerting

**DLQ Structure:**
```
dlq:email-notifications       → Failed email jobs
dlq:sms-notifications        → Failed SMS jobs
dlq:inapp-notifications      → Failed in-app jobs
```

---

## Event Ordering

Events are processed in priority order:
1. High priority (weight: 10)
2. Normal priority (weight: 5)
3. Low priority (weight: 1)

Within same priority, FIFO (First-In-First-Out) order is maintained.

---

## Event Schema Validation

All events are validated against Zod schemas before processing:

```typescript
const NotificationEventSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  recipientId: z.string(),
  channel: z.enum(['email', 'sms', 'inapp']),
  subject: z.string().optional(),
  body: z.string(),
  recipient: z.string(),
  priority: z.enum(['low', 'normal', 'high']),
  metadata: z.record(z.unknown()).optional(),
});
```

Invalid events are rejected and logged.
