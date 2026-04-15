# Custom Email Domain Feature - Testing Guide

## Setup & Prerequisites

### 1. Run Database Migration
```bash
# Build the Prisma schema
pnpm run db:build-schema

# Push the schema changes to database
npx prisma db push

# Generate Prisma client
npx prisma generate
```

### 2. Environment Variables
Ensure your `.env` file has:
```env
HOST_IP=<your-host-ip-address>
SMTP_HOST=<your-postfix-smtp-host>
SMTP_PORT=587
JWT_SECRET=<your-jwt-secret>
```

### 3. Prerequisites
- OpenDKIM installed and running on your VPS
- Postfix configured for outgoing mail
- DNS access to add TXT records
- Valid JWT token with `x-account-id` header or Bearer token

---

## Testing Endpoints

All endpoints require authentication. Use either:
- **Bearer Token**: `Authorization: Bearer <jwt-token>`
- **Account ID Header**: `x-account-id: <account-id>`

### Base URL
```
http://localhost:3000/api
```

---

## 1. Create a Domain
### Endpoint
```
POST /api/apps/:appId/domains
```

### Request
```bash
curl -X POST http://localhost:3000/api/apps/550e8400-e29b-41d4-a716-446655440000/domains \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "domain": "mail.example.com",
    "fromName": "Example Company",
    "fromEmail": "noreply@example.com"
  }'
```

### Success Response (201)
```json
{
  "success": true,
  "resp_msg": "Domain created successfully",
  "resp_code": 201,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "domain": "mail.example.com",
    "status": "pending",
    "dnsRecords": [
      {
        "type": "TXT",
        "name": "@",
        "value": "v=spf1 ip4:<HOST_IP> include:mail.afrisinc.com ~all",
        "label": "SPF",
        "purpose": "Authorizes our server to send email on your behalf"
      },
      {
        "type": "TXT",
        "name": "afrisinc._domainkey",
        "value": "v=DKIM1; k=rsa; p=MIGfMA0GCSq...",
        "label": "DKIM",
        "purpose": "Cryptographic signature proving email authenticity"
      },
      {
        "type": "TXT",
        "name": "_dmarc",
        "value": "v=DMARC1; p=none; rua=mailto:dmarc@afrisinc.com",
        "label": "DMARC",
        "purpose": "Policy for handling failed authentication"
      }
    ]
  }
}
```

### Error Cases
- **409 Conflict**: Domain already registered
```json
{
  "success": false,
  "resp_msg": "Domain is already registered",
  "resp_code": 409
}
```

- **400 Bad Request**: Missing required fields
```json
{
  "success": false,
  "resp_msg": "domain, fromName, and fromEmail are required",
  "resp_code": 400
}
```

---

## 2. Get Domain Records
### Endpoint
```
GET /api/apps/:appId/domains/:domainId/records
```

### Request
```bash
curl -X GET http://localhost:3000/api/apps/app-123/domains/550e8400-e29b-41d4-a716-446655440000/records \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Success Response (200)
```json
{
  "success": true,
  "resp_msg": "DNS records retrieved successfully",
  "resp_code": 200,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "domain": "mail.example.com",
    "fromName": "Example Company",
    "fromEmail": "noreply@example.com",
    "status": "pending",
    "verified": {
      "spf": false,
      "dkim": false,
      "dmarc": false
    },
    "dnsRecords": [
      {
        "type": "TXT",
        "name": "@",
        "value": "v=spf1 ip4:<HOST_IP> include:mail.afrisinc.com ~all",
        "label": "SPF",
        "purpose": "Authorizes our server to send email on your behalf"
      },
      {
        "type": "TXT",
        "name": "afrisinc._domainkey",
        "value": "v=DKIM1; k=rsa; p=MIGfMA0GCSq...",
        "label": "DKIM",
        "purpose": "Cryptographic signature proving email authenticity"
      },
      {
        "type": "TXT",
        "name": "_dmarc",
        "value": "v=DMARC1; p=none; rua=mailto:dmarc@afrisinc.com",
        "label": "DMARC",
        "purpose": "Policy for handling failed authentication"
      }
    ],
    "verifiedAt": null,
    "createdAt": "2025-02-16T10:30:00Z"
  }
}
```

---

## 3. Verify Domain DNS Records
### Endpoint
```
POST /api/apps/:appId/domains/:domainId/verify
```

This endpoint checks if DNS records are properly configured and activates the domain in OpenDKIM if all checks pass.

### Request
```bash
curl -X POST http://localhost:3000/api/apps/app-123/domains/550e8400-e29b-41d4-a716-446655440000/verify \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Success Response - All Records Valid (200)
```json
{
  "success": true,
  "resp_msg": "Domain verification completed",
  "resp_code": 200,
  "data": {
    "verified": true,
    "checks": {
      "spf": true,
      "dkim": true,
      "dmarc": true
    }
  }
}
```

### Success Response - Partial Records (200)
```json
{
  "success": true,
  "resp_msg": "Domain verification completed",
  "resp_code": 200,
  "data": {
    "verified": false,
    "checks": {
      "spf": true,
      "dkim": false,
      "dmarc": true
    }
  }
}
```

### What Happens When Verification Succeeds
1. ✅ DNS records are checked
2. ✅ Domain is added to OpenDKIM signing table
3. ✅ Domain is added to OpenDKIM key table
4. ✅ OpenDKIM service is reloaded
5. ✅ Domain status updated to `verified`
6. ✅ Emails can now be sent from this domain

---

## 4. Update Domain (From Name & Email)
### Endpoint
```
PATCH /api/apps/:appId/domains/:domainId
```

Only verified domains can be updated.

### Request
```bash
curl -X PATCH http://localhost:3000/api/apps/app-123/domains/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "fromName": "New Company Name",
    "fromEmail": "hello@example.com"
  }'
```

### Success Response (200)
```json
{
  "success": true,
  "resp_msg": "Domain updated successfully",
  "resp_code": 200,
  "data": {
    "success": true,
    "domain": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "account_id": "user-account-id",
      "domain": "mail.example.com",
      "from_name": "New Company Name",
      "from_email": "hello@example.com",
      "selector": "afrisinc",
      "status": "verified",
      "spf_verified": true,
      "dkim_verified": true,
      "dmarc_verified": true,
      "verified_at": "2025-02-16T11:00:00Z",
      "createdAt": "2025-02-16T10:30:00Z",
      "updatedAt": "2025-02-16T11:15:00Z"
    }
  }
}
```

### Error Response - Not Verified (400)
```json
{
  "success": false,
  "resp_msg": "Only verified domains can be updated",
  "resp_code": 400
}
```

---

## 5. Delete Domain
### Endpoint
```
DELETE /api/apps/:appId/domains/:domainId
```

When deleted, the domain is:
- Removed from OpenDKIM signing table
- Removed from OpenDKIM key table
- DKIM keys deleted from `/etc/opendkim/keys/{domain}/`
- Domain record deleted from database

### Request
```bash
curl -X DELETE http://localhost:3000/api/apps/app-123/domains/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Success Response (200)
```json
{
  "success": true,
  "resp_msg": "Domain deleted successfully",
  "resp_code": 200,
  "data": {
    "success": true
  }
}
```

---

## Complete Testing Workflow

### Step 1: Create Domain
```bash
APP_ID="550e8400-e29b-41d4-a716-446655440000"

DOMAIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/apps/$APP_ID/domains \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "domain": "mail.test.com",
    "fromName": "Test Company",
    "fromEmail": "noreply@test.com"
  }')

DOMAIN_ID=$(echo $DOMAIN_RESPONSE | jq -r '.data.id')
echo "Created domain: $DOMAIN_ID"
```

### Step 2: Display DNS Records
```bash
curl -s -X GET http://localhost:3000/api/apps/$APP_ID/domains/$DOMAIN_ID/records \
  -H "Authorization: Bearer eyJhbGc..." | jq '.data.dnsRecords'
```

**Output will show the three DNS records to add to your domain registrar:**
```
[
  {
    "type": "TXT",
    "name": "@",
    "value": "v=spf1 ip4:192.168.1.100 include:mail.afrisinc.com ~all",
    "label": "SPF"
  },
  {
    "type": "TXT",
    "name": "afrisinc._domainkey",
    "value": "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3...",
    "label": "DKIM"
  },
  {
    "type": "TXT",
    "name": "_dmarc",
    "value": "v=DMARC1; p=none; rua=mailto:dmarc@afrisinc.com",
    "label": "DMARC"
  }
]
```

### Step 3: Add DNS Records
In your domain registrar (GoDaddy, Namecheap, etc.):
1. Go to DNS settings
2. Add three TXT records as shown above
3. Wait 5-30 minutes for propagation

### Step 4: Verify Domain
```bash
curl -s -X POST http://localhost:3000/api/apps/$APP_ID/domains/$DOMAIN_ID/verify \
  -H "Authorization: Bearer eyJhbGc..." | jq '.data'
```

### Step 5: Send Email Using Custom Domain
Once verified, emails sent from this app will automatically use the custom domain:
```bash
curl -X POST http://localhost:3000/api/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "channel": "EMAIL",
    "appId": "'$APP_ID'",
    "recipient": "user@example.com",
    "templateCode": "AUTH_VERIFY_EMAIL",
    "payload": {
      "firstName": "John",
      "verificationUrl": "https://..."
    }
  }'
```

The email will be sent FROM: `Test Company <noreply@test.com>` instead of the default `Afrisinc Notify <notify@afrisinc.com>`

### Step 6: Update Domain (Optional)
```bash
curl -X PATCH http://localhost:3000/api/apps/$APP_ID/domains/$DOMAIN_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "fromName": "Updated Company",
    "fromEmail": "support@test.com"
  }'
```

### Step 7: Delete Domain
```bash
curl -X DELETE http://localhost:3000/api/apps/$APP_ID/domains/$DOMAIN_ID \
  -H "Authorization: Bearer eyJhbGc..."
```

---

## DNS Verification Details

### SPF Check
- **Looks for**: TXT record on domain root starting with `v=spf1`
- **Validates**: Contains your VPS IP address and mail.afrisinc.com inclusion
- **Example**: `v=spf1 ip4:192.168.1.100 include:mail.afrisinc.com ~all`

### DKIM Check
- **Looks for**: TXT record on `afrisinc._domainkey.{domain}`
- **Validates**: Contains `v=DKIM1` and first 30 chars of public key
- **Example**: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3...`

### DMARC Check
- **Looks for**: TXT record on `_dmarc.{domain}`
- **Validates**: Starts with `v=DMARC1`
- **Example**: `v=DMARC1; p=none; rua=mailto:dmarc@afrisinc.com`

---

## Troubleshooting

### Domain Creation Fails
```json
{
  "success": false,
  "resp_msg": "Failed to generate DKIM keys",
  "resp_code": 500
}
```
**Solution**: Ensure OpenDKIM is installed and `/etc/opendkim/keys` directory exists with proper permissions.

### Verification Fails
- **SPF Check fails**: Ensure the TXT record exists and includes your VPS IP
- **DKIM Check fails**: Verify the public key matches the generated key
- **DMARC Check fails**: DMARC is optional; you can add it later

Check with:
```bash
dig mail.example.com TXT
dig afrisinc._domainkey.mail.example.com TXT
dig _dmarc.mail.example.com TXT
```

### OpenDKIM Activation Fails
```
Failed to activate domain in OpenDKIM
```
**Solution**: 
- Verify OpenDKIM service is running: `systemctl status opendkim`
- Check file permissions: `ls -la /etc/opendkim/signing.table`
- Reload manually: `systemctl reload opendkim`

### Emails Still Using Default Domain
- Ensure domain status is `verified` in the database
- Check email logs in notification_logs table
- Verify the account_id is being sent with the email notification

---

## Database Schema

```sql
CREATE TABLE customer_domains (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  domain VARCHAR(255) UNIQUE NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  selector VARCHAR(50) DEFAULT 'afrisinc',
  public_key TEXT NOT NULL,
  private_key_path TEXT NOT NULL,
  spf_verified BOOLEAN DEFAULT false,
  dkim_verified BOOLEAN DEFAULT false,
  dmarc_verified BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending', -- pending, verified, suspended
  verified_at TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_account_id ON customer_domains(account_id);
CREATE INDEX idx_status ON customer_domains(status);
CREATE UNIQUE INDEX idx_account_domain ON customer_domains(account_id, domain);
```

---

## File Structure

```
src/services/api/src/
├── controllers/
│   └── domain.controller.ts          # 5 endpoint handlers
├── repositories/
│   └── customer-domain.repository.ts # Database operations
├── routes/
│   └── domain.routes.ts              # Route registration
├── schemas/
│   └── routes/
│       └── domain.schema.ts          # Swagger & validation
└── services/
    ├── dkim.service.ts               # DKIM key generation & OpenDKIM mgmt
    └── custom-domain-dns.service.ts  # DNS verification

src/shared/database/models/
└── customer-domain.model.prisma      # Database schema

src/services/worker-email/src/providers/
└── smtp.ts                           # Updated to use custom domains
```

---

## API Response Format

All endpoints follow this format:

```json
{
  "success": boolean,
  "resp_msg": string,
  "resp_code": number,
  "data": object
}
```

**Status Codes**:
- `201` - Resource created
- `200` - Success
- `400` - Bad request / validation error
- `404` - Not found
- `409` - Conflict (domain already registered)
- `500` - Internal server error
