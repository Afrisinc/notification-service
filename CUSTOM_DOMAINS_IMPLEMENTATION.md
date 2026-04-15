# Custom Email Domain Feature - Implementation Guide

## Overview

The custom email domain feature allows customers to connect their own domain (e.g., `mail.theirdomain.com`) so emails sent through Afrisinc Notify appear as coming from their domain instead of the platform's default domain.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Facing API                       │
├─────────────────────────────────────────────────────────────┤
│  POST   /api/domains                  Create new domain     │
│  GET    /api/domains/:id/records      Get DNS records       │
│  POST   /api/domains/:id/verify       Verify DNS records    │
│  PATCH  /api/domains/:id              Update domain         │
│  DELETE /api/domains/:id              Delete domain         │
└──────────────┬──────────────────────────────────────────────┘
               │
               ├─────────────────────────────────────────────┐
               │                                             │
         ┌─────▼────────┐              ┌────────────────────▼──┐
         │  Controller  │              │   Repositories       │
         └─────┬────────┘              │ ┌──────────────────┐  │
               │                       │ │CustomerDomain    │  │
               ├─────────────────────► │ │Repository        │  │
               │                       │ └────────┬─────────┘  │
               │                       │          │            │
         ┌─────▼────────────────────┐  │    ┌────▼────┐       │
         │  Domain Services          │  │    │ Prisma  │       │
         ├─────────────────────────┐ │  │    │ Client  │       │
         │  DKIMService            │ │  │    └────────┘       │
         │  ├─ generateKeyPair()   │ │  │                     │
         │  ├─ addToSigningTable() │ │  │  PostgreSQL DB     │
         │  ├─ addToKeyTable()     │ │  │ ┌──────────────────┐│
         │  ├─ removeFromDKIMTables│ │  │ │customer_domains  ││
         │  ├─ reloadOpenDKIM()    │ │  │ │table             ││
         │  └─ deleteKeys()        │ │  │ └──────────────────┘│
         │                         │ │  └────────────────────┘
         │  CustomDomainDNSService │ │
         │  ├─ verifyDomain()      │ │
         │  ├─ getDNSRecords()     │ │
         │  └─ verify*()           │ │
         └─────────────────────────┘ │
               │                      │
               └──────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐  ┌─────▼────┐  ┌─────▼────┐
   │ OpenDKIM│  │ Postfix  │  │   DNS    │
   │ Tables  │  │  SMTP    │  │ (Verify) │
   └─────────┘  └──────────┘  └──────────┘
```

## Database Schema

### `customer_domains` Table

```prisma
model CustomerDomain {
  id                  String   @id @default(uuid())
  app_id              String   // Link to app
  domain              String   @unique
  from_name           String   // Display name
  from_email          String   // Sender email
  selector            String   @default("afrisinc")
  public_key          String   // DKIM public key
  private_key_path    String   // Path to private key
  spf_verified        Boolean  @default(false)
  dkim_verified       Boolean  @default(false)
  dmarc_verified      Boolean  @default(false)
  status              String   @default("pending") // pending, verified, suspended
  verified_at         DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  app                 App      @relation(fields: [app_id], references: [id], onDelete: Cascade)
}
```

## Services

### 1. DKIMService (`dkim.service.ts`)

Handles DKIM key generation and OpenDKIM configuration management.

**Key Methods:**

#### `generateKeyPair(domain, selector)`
- Generates a 2048-bit RSA key pair using `opendkim-genkey`
- Creates `/etc/opendkim/keys/{domain}/` directory
- Returns public key and path to private key
- Sets proper permissions for opendkim user

**What it does:**
```bash
# 1. Create directory
mkdir -p /etc/opendkim/keys/example.com

# 2. Generate keys
opendkim-genkey -b 2048 -d example.com -D /etc/opendkim/keys/example.com -s afrisinc -v

# 3. Set permissions
chown -R opendkim:opendkim /etc/opendkim/keys/example.com

# 4. Extract public key from example.com/afrisinc.txt
```

#### `addToSigningTable(domain, selector, privateKeyPath)`
- Appends entry to `/etc/opendkim/signing.table`
- Format: `*@{domain}    {domain}:{selector}:{privateKeyPath}`
- Idempotent - checks if entry already exists

#### `addToKeyTable(domain, selector, privateKeyPath)`
- Appends entry to `/etc/opendkim/key.table`
- Format: `{domain}:{selector}    {domain}:{selector}:{privateKeyPath}`
- Idempotent - checks if entry already exists

#### `removeFromDKIMTables(domain, selector)`
- Removes entries from both signing and key tables
- Filters out lines matching the domain
- Non-destructive - writes back modified file

#### `reloadOpenDKIM()`
- Executes `systemctl reload opendkim`
- Picks up new tables without restarting service

#### `deleteKeys(domain)`
- Removes `/etc/opendkim/keys/{domain}/` directory entirely
- Cleaned up when domain is deleted

### 2. CustomDomainDNSService (`custom-domain-dns.service.ts`)

Verifies DNS records and generates record specifications.

**Key Methods:**

#### `verifyDomain(domain, publicKey, vpsIp, selector)`
- Verifies all three DNS records exist and are correct
- Returns `{verified: boolean, checks: {spf, dkim, dmarc}}`
- Non-blocking - returns false for missing records instead of throwing

**Verification Logic:**

```
SPF Record:
  - Query: TXT on domain root
  - Check: Contains "v=spf1", includes VPS IP, includes mail.afrisinc.com
  - Example: v=spf1 ip4:192.168.1.100 include:mail.afrisinc.com ~all

DKIM Record:
  - Query: TXT on {selector}._domainkey.{domain}
  - Check: Contains "v=DKIM1", contains first 30 chars of public key
  - Example: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3...

DMARC Record:
  - Query: TXT on _dmarc.{domain}
  - Check: Starts with "v=DMARC1"
  - Example: v=DMARC1; p=none; rua=mailto:dmarc@afrisinc.com
```

#### `getDNSRecords(domain, publicKey, vpsIp, selector)`
- Returns array of three DNS records customer needs to add
- Used in API responses so customers can copy/paste
- Includes labels and purpose descriptions

### 3. CustomerDomainRepository (`customer-domain.repository.ts`)

Data access layer for `customer_domains` table.

**Key Methods:**
- `create()` - Insert new domain
- `findById()` - Get domain by ID (scoped to account)
- `findByDomain()` - Check if domain exists
- `findVerifiedDomainByAccountId()` - Get account's verified domain (if any)
- `listByAccountId()` - List all domains for account
- `updateVerification()` - Update DNS verification flags
- `update()` - Update from name/email
- `delete()` - Remove domain
- `domainExists()` - Check existence

## Controllers

### Domain Controller (`domain.controller.ts`)

Five endpoints implementing the full domain lifecycle:

#### 1. POST /api/domains
**Create Domain**
- Validates input (domain, fromName, fromEmail)
- Checks domain not already registered
- Generates DKIM key pair
- Saves to database with status "pending"
- Returns domain ID and DNS records to add

#### 2. GET /api/domains/:domainId/records
**Get DNS Records**
- Fetches domain from database
- Returns current verification status
- Provides three DNS records to add

#### 3. POST /api/domains/:domainId/verify
**Verify DNS Records**
- Checks all three DNS records via DNS queries
- Updates verification flags in database
- If all pass:
  - Adds domain to OpenDKIM signing/key tables
  - Reloads OpenDKIM
  - Sets status to "verified"
- Returns verification results

#### 4. PATCH /api/domains/:domainId
**Update Domain**
- Updates fromName and/or fromEmail
- Only allowed for verified domains
- Changes immediately apply to new emails

#### 5. DELETE /api/domains/:domainId
**Delete Domain**
- Removes from OpenDKIM tables
- Deletes DKIM keys from server
- Removes database record
- After deletion, emails revert to default domain

## Integration with Email Sending

### SMTPProvider (`src/services/worker-email/src/providers/smtp.ts`)

Updated to check for custom domains before sending:

```typescript
1. If appId provided:
   - Query: SELECT * FROM customer_domains 
             WHERE app_id = ? AND status = 'verified'
   - If found: Use custom domain from/fromName
             Set replyTo to custom fromEmail

2. Else if appId provided (secondary check):
   - Check app-specific email config (app_email_config table)
   - Use that from/fromName

3. Else:
   - Use platform default: Afrisinc Notify <notify@afrisinc.com>
```

**Priority Order:**
1. Custom Domain (if verified)
2. App Email Config
3. Platform Default

## File Structure

```
src/
├── services/api/src/
│   ├── controllers/
│   │   └── domain.controller.ts
│   ├── repositories/
│   │   └── customer-domain.repository.ts
│   ├── routes/
│   │   └── domain.routes.ts
│   │   └── index.ts (updated)
│   ├── schemas/
│   │   └── routes/
│   │       └── domain.schema.ts
│   └── services/
│       ├── dkim.service.ts
│       └── custom-domain-dns.service.ts
├── shared/database/models/
│   ├── customer-domain.model.prisma (new)
│   ├── account.model.prisma (updated)
│   └── schema.prisma (auto-generated)
└── services/worker-email/src/providers/
    └── smtp.ts (updated)
```

## Setup Steps

### 1. Database Migration

```bash
# Build consolidated schema
pnpm run db:build-schema

# Apply migrations
npx prisma db push

# Generate client
npx prisma generate
```

### 2. Environment Configuration

```env
HOST_IP=<your-host-ip-address>      # Used in SPF records
SMTP_HOST=mail.afrisinc.com         # Your Postfix server
SMTP_PORT=587
SMTP_USER=<optional>
SMTP_PASSWORD=<optional>
```

### 3. OpenDKIM Setup

Ensure directories exist with correct permissions:

```bash
# Create keys directory
sudo mkdir -p /etc/opendkim/keys
sudo chown -R opendkim:opendkim /etc/opendkim/keys

# Ensure signing/key table files exist
sudo touch /etc/opendkim/signing.table
sudo touch /etc/opendkim/key.table
sudo chown opendkim:opendkim /etc/opendkim/signing.table
sudo chown opendkim:opendkim /etc/opendkim/key.table
```

### 4. Restart Services

```bash
sudo systemctl restart opendkim
sudo systemctl restart postfix
```

## API Response Structure

All endpoints return:

```json
{
  "success": true/false,
  "resp_msg": "Human readable message",
  "resp_code": 200/201/400/404/409/500,
  "data": {
    // Endpoint-specific data
  }
}
```

## Error Handling

### Graceful Degradation
- DNS verification failures don't crash (return false instead)
- OpenDKIM activation failure still updates DNS verification flags
- Email sending continues with fallback domain if custom lookup fails

### Server-Side Validation
- Domain uniqueness enforced at database level
- Account ownership enforced by requiring account_id match
- Status transitions validated (only verified domains can be updated)

### Client-Side Errors
- 400 Bad Request - Missing/invalid input
- 404 Not Found - Domain not found or doesn't belong to account
- 409 Conflict - Domain already registered
- 500 Internal Error - DKIM generation failed, systemctl failed

## Security Considerations

1. **Account Isolation**: Domains scoped to account_id at database level
2. **Private Key Protection**: Paths stored in DB, actual keys on filesystem only
3. **DNS Verification**: Ownership validated before enabling (via DNS records)
4. **DKIM Signing**: Private keys never leave server
5. **OpenDKIM Config**: Changes require server-side execution (not user-controlled)

## Performance

- **Creation**: ~2-3 seconds (opendkim-genkey execution)
- **Verification**: ~200-500ms (DNS queries × 3)
- **Deletion**: ~1-2 seconds (filesystem cleanup)
- **Email Sending**: +1-2ms per email (single database query)

## Monitoring & Logs

Check application logs for:
- DKIM key generation errors
- OpenDKIM reload failures
- DNS verification timeouts
- Database query errors

Example log entries:
```
[INFO] Generated DKIM keys for domain=mail.example.com
[WARN] SPF verification failed for domain=mail.example.com - record not found
[ERROR] Failed to reload OpenDKIM - systemctl error
[DEBUG] Using customer custom domain for email account_id=xxx domain=mail.example.com
```

## Future Enhancements

1. **Batch Domain Creation**: Upload CSV of domains
2. **DKIM Key Rotation**: Auto-rotate keys on schedule
3. **Webhook Notifications**: Alert when verification status changes
4. **DNSSEC Support**: Verify DNSSEC records
5. **Multi-Selector Support**: Use different selectors per domain
6. **Automatic Verification**: Poll DNS until records appear
7. **Return-Path Management**: Configure bounce handling per domain

## Testing Checklist

- [ ] Database schema created and migrated
- [ ] DKIM keys generated successfully
- [ ] OpenDKIM tables updated correctly
- [ ] DNS records retrieve and verify correctly
- [ ] Verified domains used for email sending
- [ ] Deletion cleans up OpenDKIM and filesystem
- [ ] Account isolation enforced
- [ ] Error cases handled gracefully
