# Afrisinc Notify API - Testing Guide

## 🚀 Quick Start

The API is running at **http://localhost:3000**
Swagger UI available at **http://localhost:3000/docs**

---

## 📋 Test Tokens & Headers

Use these for testing all endpoints:

```bash
Authorization: Bearer valid-service-token
X-Tenant-ID: afrisinc-auth
X-Correlation-ID: optional-request-id
Content-Type: application/json
```

---

## ✅ Health Check Endpoints

### 1. Liveness Check

```bash
curl -X GET http://localhost:3000/health
```

**Expected Response (200):**
```json
{
  "success": true,
  "resp_msg": "OK",
  "resp_code": 1000,
  "data": {
    "status": "ok",
    "service": "afrisinc-notify-api",
    "timestamp": "2026-02-05T20:52:38.000Z"
  }
}
```

### 2. Readiness Check

```bash
curl -X GET http://localhost:3000/health/ready
```

### 3. Liveness Probe (K8s)

```bash
curl -X GET http://localhost:3000/health/live
```

---

## 📧 Template Endpoints

### Create Template

```bash
curl -X POST http://localhost:3000/templates \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WELCOME_USER",
    "channel": "EMAIL",
    "subject": "Welcome to Afrisinc",
    "content": "Hello {{name}}, welcome to Afrisinc!",
    "language": "en"
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "resp_msg": "Template created successfully",
  "resp_code": 1001,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "WELCOME_USER",
    "channel": "EMAIL",
    "active": true
  }
}
```

### List Templates

```bash
curl -X GET "http://localhost:3000/templates?limit=10&offset=0" \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth"
```

### Get Template

```bash
curl -X GET http://localhost:3000/templates/{TEMPLATE_ID} \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth"
```

### Update Template

```bash
curl -X PUT http://localhost:3000/templates/{TEMPLATE_ID} \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Updated content with {{variable}}",
    "active": true
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "resp_msg": "Template updated successfully",
  "resp_code": 1002,
  "data": { /* template object */ }
}
```

### Delete Template

```bash
curl -X DELETE http://localhost:3000/templates/{TEMPLATE_ID} \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth"
```

**Expected Response (204):** No content

---

## 📬 Notification Endpoints

### Send Single Notification

```bash
curl -X POST http://localhost:3000/notify/send \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "EMAIL",
    "recipient": "user@example.com",
    "templateCode": "WELCOME_USER",
    "payload": {
      "name": "John Doe",
      "loginUrl": "https://app.afrisinc.com/login"
    },
    "priority": "NORMAL"
  }'
```

**Expected Response (202 - Accepted):**
```json
{
  "success": true,
  "resp_msg": "Notification queued for processing",
  "resp_code": 1004,
  "data": {
    "notificationId": "a1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d5",
    "status": "QUEUED"
  }
}
```

### Send Bulk Notifications

```bash
curl -X POST http://localhost:3000/notify/bulk \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth" \
  -H "Content-Type: application/json" \
  -d '{
    "notifications": [
      {
        "channel": "SMS",
        "recipient": "+2507XXXXXXXX",
        "templateCode": "OTP_CODE",
        "payload": { "code": "123456" }
      },
      {
        "channel": "EMAIL",
        "recipient": "another@example.com",
        "templateCode": "WELCOME_USER",
        "payload": { "name": "Jane Doe" }
      }
    ]
  }'
```

**Expected Response (202):**
```json
{
  "success": true,
  "resp_msg": "Bulk notifications queued for processing",
  "resp_code": 1004,
  "data": {
    "accepted": 2,
    "rejected": 0
  }
}
```

### Get Notification Status

```bash
curl -X GET http://localhost:3000/notify/{NOTIFICATION_ID} \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth"
```

**Expected Response (200):**
```json
{
  "success": true,
  "resp_msg": "Notification status retrieved",
  "resp_code": 1000,
  "data": {
    "id": "a1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d5",
    "channel": "EMAIL",
    "recipient": "user@example.com",
    "status": "QUEUED",
    "createdAt": "2026-02-05T20:52:38Z",
    "updatedAt": "2026-02-05T20:52:38Z"
  }
}
```

### List Notifications

```bash
curl -X GET "http://localhost:3000/notify/logs?channel=EMAIL&status=QUEUED&limit=20&offset=0" \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth"
```

**Expected Response (200):**
```json
{
  "success": true,
  "resp_msg": "Notifications listed",
  "resp_code": 1000,
  "data": {
    "data": [
      {
        "id": "a1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d5",
        "channel": "EMAIL",
        "recipient": "user@example.com",
        "status": "QUEUED",
        "createdAt": "2026-02-05T20:52:38Z",
        "updatedAt": "2026-02-05T20:52:38Z"
      }
    ],
    "meta": {
      "limit": 20,
      "offset": 0,
      "total": 1
    }
  }
}
```

---

## ❌ Error Response Examples

### 400 Bad Request - Invalid Payload

```json
{
  "success": false,
  "resp_msg": "Invalid request payload",
  "resp_code": 2000
}
```

### 401 Unauthorized - Missing Token

```json
{
  "success": false,
  "resp_msg": "Missing authorization header",
  "resp_code": 3000
}
```

### 404 Not Found - Template Not Found

```json
{
  "success": false,
  "resp_msg": "Template not found: INVALID_CODE",
  "resp_code": 2004
}
```

### 409 Conflict - Duplicate Template

```json
{
  "success": false,
  "resp_msg": "Template with code WELCOME_USER already exists",
  "resp_code": 2003
}
```

---

## 🧪 Testing Workflows

### Complete Workflow: Create Template → Send Notification

```bash
# 1. Create a template
TEMPLATE_RESPONSE=$(curl -s -X POST http://localhost:3000/templates \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "ORDER_CONFIRMED",
    "channel": "EMAIL",
    "subject": "Your order is confirmed",
    "content": "Thank you {{name}}, your order #{{orderId}} is confirmed!",
    "language": "en"
  }')

echo "Template created: $TEMPLATE_RESPONSE"

# 2. Send a notification using the template
curl -X POST http://localhost:3000/notify/send \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "EMAIL",
    "recipient": "customer@example.com",
    "templateCode": "ORDER_CONFIRMED",
    "payload": {
      "name": "John Doe",
      "orderId": "ORD-12345"
    }
  }'

# 3. List all notifications
curl -X GET "http://localhost:3000/notify/logs?limit=5" \
  -H "Authorization: Bearer valid-service-token" \
  -H "X-Tenant-ID: afrisinc-auth"
```

---

## 🔗 Using Postman

### Import Configuration

1. Open Postman
2. Create a new environment variable:
   - `base_url`: http://localhost:3000
   - `token`: valid-service-token
   - `tenant_id`: afrisinc-auth

3. Use in requests:
   - URL: `{{base_url}}/templates`
   - Authorization: Bearer `{{token}}`
   - Header `X-Tenant-ID`: `{{tenant_id}}`

---

## 📊 Response Code Reference

| Code | Status | Meaning |
|------|--------|---------|
| 1000 | 200 | Success |
| 1001 | 201 | Created |
| 1002 | 200 | Updated |
| 1003 | 204 | Deleted |
| 1004 | 202 | Accepted (async) |
| 2000 | 400 | Invalid request |
| 2003 | 409 | Duplicate |
| 2004 | 404 | Not found |
| 3000 | 401 | Auth required |
| 3004 | 403 | Access denied |

---

## 🐛 Troubleshooting

### 401 Unauthorized
- Check Authorization header is present
- Use token: `valid-service-token`
- Use X-Tenant-ID header: `afrisinc-auth`

### 404 Template Not Found
- Template code must exist
- Check template was created successfully
- Verify correct tenant is being used

### 400 Invalid Request
- Check JSON payload is valid
- Verify required fields are present
- Check field types match schema

### Server Won't Start
- Check port 3000 is available
- Check all dependencies installed: `pnpm install`
- Check TypeScript compilation: `pnpm build`

---

## 📝 Notes

- All timestamps are in ISO 8601 format
- Template codes must be uppercase with underscores (UPPERCASE_WITH_UNDERSCORES)
- Notifications are queued asynchronously (202 Accepted response)
- Use X-Correlation-ID for distributed tracing
- All responses follow Afrisinc Response Standard v1.0.0
