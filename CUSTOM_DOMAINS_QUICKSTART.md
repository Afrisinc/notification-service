# Custom Email Domain Feature - Quick Start

## 📋 What Was Built

A complete custom email domain feature allowing customers to:
- ✅ Register their own domain (e.g., `mail.theirdomain.com`)
- ✅ Have emails sent with their brand
- ✅ Verify DNS ownership
- ✅ Automatically sign emails with DKIM
- ✅ Update sender information
- ✅ Remove domains with complete cleanup

## 📦 What Was Implemented

### Database
- **Model**: `CustomerDomain` with account isolation and verification flags
- **File**: `src/shared/database/models/customer-domain.model.prisma`

### Services
- **DKIMService**: DKIM key generation & OpenDKIM management
- **CustomDomainDNSService**: DNS verification
- **CustomerDomainRepository**: Database operations

### API (5 Endpoints)
```
POST   /api/apps/:appId/domains                Create domain for app
GET    /api/apps/:appId/domains/:id/records   Get DNS records
POST   /api/apps/:appId/domains/:id/verify    Verify DNS
PATCH  /api/apps/:appId/domains/:id           Update domain
DELETE /api/apps/:appId/domains/:id           Delete domain
```

### Integration
- **Email Sending**: SMTPProvider now checks for custom domains before sending
- **Priority**: Custom Domain > App Config > Platform Default

## 🚀 Getting Started

### 1. Database Setup
```bash
# Build schema from models
pnpm run db:build-schema

# Apply migrations
npx prisma db push

# Generate client
npx prisma generate
```

### 2. Environment Configuration
```env
HOST_IP=192.168.1.100             # Your host IP for SPF records
SMTP_HOST=mail.afrisinc.com       # Your Postfix server
SMTP_PORT=587
JWT_SECRET=your-secret-here        # For authentication
```

### 3. OpenDKIM Preparation
```bash
# Create and configure directories
sudo mkdir -p /etc/opendkim/keys
sudo chown -R opendkim:opendkim /etc/opendkim/keys
sudo touch /etc/opendkim/signing.table
sudo touch /etc/opendkim/key.table
sudo chown opendkim:opendkim /etc/opendkim/signing.table
sudo chown opendkim:opendkim /etc/opendkim/key.table

# Restart services
sudo systemctl restart opendkim
sudo systemctl restart postfix
```

## 🔄 User Workflow

### Step 1: Create Domain
```bash
curl -X POST http://localhost:3000/api/domains \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "domain": "mail.example.com",
    "fromName": "Example Corp",
    "fromEmail": "noreply@example.com"
  }'
```

Response includes DNS records to add ↓

### Step 2: Add DNS Records
Customer copies three TXT records to their domain registrar:
1. **SPF**: `v=spf1 ip4:<HOST_IP> include:mail.afrisinc.com ~all`
2. **DKIM**: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3...`
3. **DMARC**: `v=DMARC1; p=none; rua=mailto:dmarc@afrisinc.com`

(Wait 5-30 minutes for DNS propagation)

### Step 3: Verify Domain
```bash
curl -X POST http://localhost:3000/api/domains/{DOMAIN_ID}/verify \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "verified": true,
  "checks": {
    "spf": true,
    "dkim": true,
    "dmarc": true
  }
}
```

### Step 4: Emails Now Use Custom Domain
Emails sent by this account now come from:
```
From: Example Corp <noreply@example.com>
Reply-To: noreply@example.com
```

Instead of:
```
From: Afrisinc Notify <notify@afrisinc.com>
```

## 📁 Files Created

### Controllers & Routes
```
src/services/api/src/
├── controllers/domain.controller.ts    (5 endpoints)
├── routes/domain.routes.ts              (route registration)
└── routes/index.ts                      (UPDATED - route import)
```

### Services
```
src/services/api/src/services/
├── dkim.service.ts                      (DKIM key gen & OpenDKIM mgmt)
└── custom-domain-dns.service.ts         (DNS verification)
```

### Repository & Schema
```
src/services/api/src/
├── repositories/customer-domain.repository.ts
└── schemas/routes/domain.schema.ts      (Swagger & validation)
```

### Database
```
src/shared/database/
├── models/customer-domain.model.prisma  (NEW)
└── models/account.model.prisma          (UPDATED - added relation)
```

### Email Integration
```
src/services/worker-email/src/providers/
└── smtp.ts                              (UPDATED - custom domain check)
```

## 🎯 Key Features

### Security
- ✅ Account isolation (domains scoped to account_id)
- ✅ DNS ownership verification
- ✅ DKIM signing never leaves server
- ✅ Private keys stored only on filesystem

### Reliability
- ✅ Graceful degradation on DNS failures
- ✅ OpenDKIM activation failure doesn't crash email sending
- ✅ Automatic fallback to app/platform defaults
- ✅ Comprehensive error handling

### Operations
- ✅ Complete cleanup on deletion (filesystem + database)
- ✅ Idempotent operations (safe to re-run)
- ✅ Detailed logging for troubleshooting
- ✅ OpenDKIM reloaded without restart

## 📊 API Response Format

All endpoints return:
```json
{
  "success": true/false,
  "resp_msg": "Human readable message",
  "resp_code": 200/201/400/404/409/500,
  "data": { /* endpoint-specific data */ }
}
```

## 🔍 Testing & Debugging

### Check Domain Status
```bash
# Get all details
curl -X GET http://localhost:3000/api/domains/{DOMAIN_ID}/records \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.data'
```

### Verify DNS Manually
```bash
# Check SPF
dig mail.example.com TXT

# Check DKIM
dig afrisinc._domainkey.mail.example.com TXT

# Check DMARC
dig _dmarc.mail.example.com TXT
```

### Check OpenDKIM Tables
```bash
# View signing table entries
grep "example.com" /etc/opendkim/signing.table

# View key table entries
grep "example.com" /etc/opendkim/key.table

# Verify keys exist
ls -la /etc/opendkim/keys/
```

### Monitor Email Logs
Check the `notification_logs` table:
```sql
SELECT * FROM notification_logs 
ORDER BY createdAt DESC 
LIMIT 10;
```

## 📚 Documentation Files

1. **`CUSTOM_DOMAINS_QUICKSTART.md`** (this file)
   - Quick overview and setup

2. **`CUSTOM_DOMAINS_IMPLEMENTATION.md`**
   - Architecture & design details
   - Complete service documentation
   - Setup instructions
   - Performance notes

3. **`CUSTOM_DOMAINS_TESTING.md`**
   - Complete API reference
   - Curl examples for all endpoints
   - Full workflow walkthrough
   - Troubleshooting guide
   - Database schema

## 🛠️ Maintenance

### Adding a New Domain
No changes needed - API handles everything

### Monitoring
Watch for:
- DKIM key generation failures → Check OpenDKIM installation
- OpenDKIM reload failures → Check file permissions
- DNS verification timeouts → Check DNS propagation

### Cleanup
Running `DELETE /api/domains/:id` automatically:
1. Removes from OpenDKIM signing table
2. Removes from OpenDKIM key table
3. Deletes DKIM keys from filesystem
4. Deletes database record

## 💡 Next Steps

1. **Test the endpoints** using the curl examples in CUSTOM_DOMAINS_TESTING.md
2. **Set up a test domain** with your registrar
3. **Verify the workflow** works end-to-end
4. **Monitor logs** for any issues
5. **Document for customers** how to add DNS records

## 🔗 Related Features

- **App Email Config** (`app_email_config.ts`) - Fallback for apps without custom domain
- **Notification Logs** (`notification_logs`) - Track all email send attempts
- **SMTP Provider** (`smtp.ts`) - Where custom domains are applied

## 📞 Support

For issues:
1. Check `CUSTOM_DOMAINS_TESTING.md` troubleshooting section
2. Review logs: `pnpm run logs` (or container logs)
3. Verify OpenDKIM: `systemctl status opendkim`
4. Test DNS: `dig domain.com TXT`

---

**Implementation Status**: ✅ Complete and Ready for Testing
