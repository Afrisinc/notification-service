# End-to-End Testing Guide - Email Worker

## Overview

This guide explains how to perform end-to-end testing of the email notification worker to ensure it works correctly from notification creation to email delivery.

## Prerequisites

1. **Docker Services Running:**
   ```bash
   docker-compose up -d
   # Verify services
   docker-compose ps
   ```

2. **Environment Configured:**
   ```bash
   cp .env.example .env
   # Edit .env with your email provider credentials
   ```

3. **Database Set Up:**
   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

4. **Dependencies Installed:**
   ```bash
   npm install
   ```

## Scenario 1: SMTP Email Testing

### Setup

Configure `.env` for SMTP (Gmail example):
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM=noreply@yourcompany.com
```

**Note:** For Gmail, use [App Passwords](https://support.google.com/accounts/answer/185833) instead of your main password.

### Steps

1. **Start Email Worker:**
   ```bash
   npm run worker:email:dev
   ```

2. **Monitor Worker Logs:**
   ```bash
   # In another terminal
   docker-compose logs -f
   ```

3. **Create Test Notification (via database):**
   ```bash
   # Using Prisma Studio
   npm run db:studio

   # Or insert directly
   INSERT INTO "Notification" (
     id, "tenantId", "recipientId", channel, subject, body, status, priority, "createdAt"
   ) VALUES (
     'test-smtp-001',
     'tenant-test',
     'user-test',
     'email',
     'E2E Test - SMTP',
     'This is a test email sent via SMTP',
     'pending',
     'normal',
     NOW()
   );
   ```

4. **Queue Job (manual):**
   ```bash
   # Connect to Redis
   redis-cli

   # Push job to queue
   > RPUSH bull:email-notifications:jobs '{"id":"test-smtp-001","tenantId":"tenant-test","recipientId":"user-test","to":"test@example.com","subject":"E2E Test - SMTP","body":"Test body","priority":"normal","createdAt":"2024-02-04T20:00:00Z"}'
   ```

5. **Verify Delivery:**
   ```bash
   # Check notification status
   SELECT * FROM "Notification" WHERE id = 'test-smtp-001';

   # Should show status = 'sent'
   ```

### Expected Results

- ✅ Notification record created with status 'pending'
- ✅ Worker processes job from queue
- ✅ Email sent successfully
- ✅ Notification status updated to 'sent'
- ✅ External message ID stored
- ✅ No errors in logs

## Scenario 2: SendGrid Email Testing

### Setup

Configure `.env` for SendGrid:
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your_api_key_here
SMTP_FROM=noreply@yourcompany.com
```

### Steps

1. **Start Email Worker:**
   ```bash
   npm run worker:email:dev
   ```

2. **Create Test Notification:**
   ```sql
   INSERT INTO "Notification" (
     id, "tenantId", "recipientId", channel, subject, body, status, priority, "createdAt"
   ) VALUES (
     'test-sendgrid-001',
     'tenant-test',
     'user-test',
     'email',
     'E2E Test - SendGrid',
     'This is a test email sent via SendGrid',
     'pending',
     'normal',
     NOW()
   );
   ```

3. **Queue Job:**
   ```bash
   redis-cli
   > RPUSH bull:email-notifications:jobs '{"id":"test-sendgrid-001","tenantId":"tenant-test","recipientId":"user-test","to":"test@example.com","subject":"E2E Test - SendGrid","body":"Test body","priority":"normal"}'
   ```

4. **Monitor Delivery:**
   ```bash
   # Check SendGrid dashboard for delivery confirmation
   # https://app.sendgrid.com/
   ```

### Expected Results

- ✅ Email delivered via SendGrid API
- ✅ Status updated to 'sent'
- ✅ SendGrid message ID stored in externalId
- ✅ Visible in SendGrid Mail Activity

## Scenario 3: Error Handling

### Test Invalid Email Address

1. **Create notification with invalid email:**
   ```sql
   INSERT INTO "Notification" (
     id, "tenantId", "recipientId", channel, subject, body, status, priority, "createdAt"
   ) VALUES (
     'test-error-001',
     'tenant-test',
     'user-test',
     'email',
     'Error Test',
     'Test invalid email',
     'pending',
     'normal',
     NOW()
   );
   ```

2. **Queue with invalid email address:**
   ```bash
   redis-cli
   > RPUSH bull:email-notifications:jobs '{"id":"test-error-001","tenantId":"tenant-test","recipientId":"user-test","to":"invalid-email","subject":"Test","body":"Test"}'
   ```

3. **Verify Error Handling:**
   ```sql
   -- Should show status = 'failed'
   SELECT * FROM "Notification" WHERE id = 'test-error-001';

   -- Should have failure reason
   SELECT "failureReason" FROM "Notification" WHERE id = 'test-error-001';
   ```

### Expected Results

- ✅ Notification status changed to 'failed'
- ✅ Failure reason captured
- ✅ Worker did not crash
- ✅ Error logged appropriately

## Scenario 4: Batch Email Processing

### Test Multiple Emails

1. **Seed notifications:**
   ```bash
   npm run db:seed
   ```

2. **Queue multiple jobs:**
   ```bash
   redis-cli
   # Queue 5 emails
   for i in {1..5}; do
     RPUSH bull:email-notifications:jobs "{\"id\":\"batch-$i\",\"tenantId\":\"tenant-batch\",\"recipientId\":\"user-$i\",\"to\":\"user$i@example.com\",\"subject\":\"Batch Test $i\",\"body\":\"Email $i\"}"
   done
   ```

3. **Monitor Processing:**
   ```bash
   # Watch queue depth
   redis-cli
   > LLEN bull:email-notifications:jobs
   ```

4. **Verify All Sent:**
   ```sql
   SELECT COUNT(*) as total,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
   FROM "Notification"
   WHERE id LIKE 'batch-%';
   ```

### Expected Results

- ✅ All emails processed
- ✅ Success count matches sent count
- ✅ No pending notifications
- ✅ Worker handled concurrent processing

## Scenario 5: Provider Switching

### Test Switching Between Providers

1. **Start with SMTP:**
   ```bash
   # Set EMAIL_PROVIDER=smtp in .env
   npm run worker:email:dev

   # Send test email
   # Verify it works
   ```

2. **Switch to SendGrid:**
   ```bash
   # Update .env
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.xxx

   # Restart worker
   # Send test email
   ```

3. **Verify Both Work:**
   ```sql
   -- Check notifications from both providers
   SELECT channel, COUNT(*) FROM "Notification"
   WHERE status = 'sent'
   GROUP BY channel;
   ```

### Expected Results

- ✅ Can switch between providers
- ✅ Both providers work correctly
- ✅ No data loss or conflicts

## Monitoring During E2E Tests

### Real-Time Queue Monitoring

```bash
# Terminal 1: Watch queue size
while true; do
  redis-cli LLEN bull:email-notifications:jobs
  sleep 1
done

# Terminal 2: Watch notification status changes
watch -n 1 "psql -d notification_db -c 'SELECT status, COUNT(*) FROM \"Notification\" GROUP BY status'"
```

### Log Monitoring

```bash
# Terminal 3: Tail worker logs
npm run worker:email:dev -- 2>&1 | grep -E "sent|failed|error"
```

### Database Monitoring

```bash
# Terminal 4: Prisma Studio
npm run db:studio
# Open http://localhost:5555
```

## Performance Testing

### Load Testing

Send high volume of notifications:

```bash
# Create 100 notifications
for i in {1..100}; do
  psql -d notification_db -c "
    INSERT INTO \"Notification\" (id, \"tenantId\", \"recipientId\", channel, subject, body, status, priority, \"createdAt\")
    VALUES ('load-test-$i', 'tenant-load', 'user-$i', 'email', 'Load Test $i', 'Body $i', 'pending', 'normal', NOW());
  "
done

# Queue all jobs
redis-cli EVAL "
  for i=1,100 do
    redis.call('RPUSH', 'bull:email-notifications:jobs', '{\"id\":\"load-test-'..i..'\",\"to\":\"user'..i..'@example.com\"}')
  end
" 0

# Monitor processing
watch -n 0.5 "redis-cli LLEN bull:email-notifications:jobs"
```

### Expected Metrics

- Processing rate: 5-10 emails/second
- Memory stable: <500MB
- No errors during load
- All emails delivered

## Troubleshooting

### Worker Won't Start

```bash
# Check logs
npm run worker:email:dev

# Verify config
echo $EMAIL_PROVIDER
echo $SMTP_HOST

# Check database
psql notification_db -c "SELECT 1"

# Check Redis
redis-cli ping
```

### Emails Not Processing

```bash
# Check queue
redis-cli LLEN bull:email-notifications:jobs

# Check if worker is running
ps aux | grep "worker:email"

# Verify database connection
npm run db:studio

# Check notification status
SELECT * FROM "Notification" LIMIT 5;
```

### Provider Authentication Error

```bash
# SMTP Test
telnet smtp.gmail.com 587

# SendGrid Test
curl -X GET "https://api.sendgrid.com/v3/mail/check" \
  -H "Authorization: Bearer SG.xxxxxxxx"
```

## Success Criteria

An E2E test is successful when:

- ✅ Notification created in database
- ✅ Job added to queue
- ✅ Worker processes job
- ✅ Email sent to recipient
- ✅ Status updated to 'sent'
- ✅ External ID stored
- ✅ No errors in logs
- ✅ All fields populated correctly

## Cleanup

```bash
# Reset notifications
psql notification_db -c "DELETE FROM \"Notification\" WHERE id LIKE 'test-%' OR id LIKE 'batch-%' OR id LIKE 'load-test-%';"

# Clear Redis queue
redis-cli FLUSHDB

# Stop worker
Ctrl+C
```
