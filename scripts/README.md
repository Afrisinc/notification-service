# Scripts Directory

Utility scripts for database management, data migration, and queue operations.

## Overview

This directory contains production-ready scripts for:
- Database migrations
- Database seeding
- DLQ replay
- Data backup/restore
- Queue management

## Available Scripts

### Database Scripts

#### `migrate.ts` - Run Database Migrations

```bash
npm run db:migrate

# With specific migration
npm run db:migrate -- --name add_user_preferences

# Dry run
npm run db:migrate -- --dry-run

# Rollback
npm run db:migrate -- --rollback
```

**Purpose**: Execute pending database migrations

**Features**:
- Automatic migration detection
- Transaction support
- Rollback capability
- Dry run preview

---

#### `seed.ts` - Database Seeding

```bash
npm run db:seed

# Specific seed
npm run db:seed -- --name users

# Clear before seeding
npm run db:seed -- --reset

# Dry run
npm run db:seed -- --dry-run
```

**Purpose**: Populate database with sample/initial data

**Includes**:
- Test tenants
- Test users
- Sample templates
- API keys
- Webhook configurations

**Use Cases**:
- Development setup
- Testing with realistic data
- Demo environment setup

---

### Queue Scripts

#### `replay-dlq.ts` - Replay Dead Letter Queue

```bash
npm run queue:replay-dlq

# Specific message
npm run queue:replay-dlq -- --id <message-id>

# From specific time
npm run queue:replay-dlq -- --since 2024-01-15T10:00:00Z

# Dry run
npm run queue:replay-dlq -- --dry-run
```

**Purpose**: Reprocess messages from Dead Letter Queue

**Features**:
- Selective replay by ID or date range
- Dry run preview
- Batch processing
- Success/failure tracking

**Use Cases**:
- Recover from provider downtime
- Reprocess after code fixes
- Manual correction

---

#### `queue-status.ts` - Check Queue Status

```bash
npm run queue:status

# Detailed output
npm run queue:status -- --verbose

# Specific queue
npm run queue:status -- --queue notifications.email
```

**Purpose**: Monitor message queue health

**Shows**:
- Queue depth
- Failed messages count
- Delayed messages
- Processing rate
- Consumer status

---

#### `queue-clear.ts` - Clear Queue (Development Only)

```bash
npm run queue:clear

# Specific queue
npm run queue:clear -- --queue notifications.email

# All queues
npm run queue:clear -- --all

# Confirm before clearing
npm run queue:clear -- --interactive
```

**Purpose**: Remove messages from development queue

**Warning**: Use only in development environment

---

### Data Management Scripts

#### `backup.ts` - Backup Database

```bash
npm run db:backup

# With timestamp
npm run db:backup -- --timestamp

# Specific location
npm run db:backup -- --path ./backups/

# Include credentials
npm run db:backup -- --include-credentials
```

**Purpose**: Create database backup

**Output**: SQL dump file

---

#### `restore.ts` - Restore Database

```bash
npm run db:restore --file ./backup.sql

# Dry run
npm run db:restore --file ./backup.sql --dry-run

# Drop existing
npm run db:restore --file ./backup.sql --force
```

**Purpose**: Restore database from backup

**Caution**: Will overwrite existing data

---

### Utility Scripts

#### `stats.ts` - Database Statistics

```bash
npm run db:stats

# By tenant
npm run db:stats -- --by-tenant

# Time range
npm run db:stats -- --from 2024-01-01 --to 2024-01-31
```

**Purpose**: Get system statistics

**Shows**:
- Total notifications
- Success/failure rate
- Average delivery time
- Top performers
- Error breakdown

---

#### `cleanup.ts` - Cleanup Old Data

```bash
npm run db:cleanup

# Older than days
npm run db:cleanup -- --older-than 30

# Specific status
npm run db:cleanup -- --status failed

# Dry run
npm run db:cleanup -- --dry-run
```

**Purpose**: Remove old/unwanted data

**Use Cases**:
- Archival
- Storage optimization
- GDPR compliance

---

## Script Structure

All scripts follow this pattern:

```typescript
// scripts/example.ts
import { getConfig } from '@afrisinc/notify-config';
import { prisma } from '@afrisinc/notify-db';
import { logger } from './logger';

async function main() {
  try {
    const config = getConfig();
    // Script logic here
    logger.info({}, 'Script completed successfully');
  } catch (error) {
    logger.error({ error }, 'Script failed');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
```

## Running Scripts

### Development

```bash
npm run script-name
```

### Production

```bash
NODE_ENV=production npm run script-name
```

## Environment Requirements

Scripts require:
- `.env` file in root
- Database connection
- Queue connection (if queue operations)
- Proper permissions

## Best Practices

1. **Always dry-run first**
   ```bash
   npm run script -- --dry-run
   ```

2. **Backup before destructive operations**
   ```bash
   npm run db:backup
   npm run db:cleanup -- --dry-run
   npm run db:cleanup
   ```

3. **Test in development first**
   - Run script locally
   - Verify output
   - Then run in staging/production

4. **Monitor script execution**
   - Check logs
   - Verify data integrity
   - Monitor queue status

5. **Document manual operations**
   - Keep audit log
   - Record timestamps
   - Note any issues

## Error Handling

Scripts include comprehensive error handling:
- Database connection errors
- Queue connection errors
- Permission errors
- Data validation errors

All errors are logged with:
- Error message
- Stack trace
- Context information

## Monitoring

### Before Running

```bash
npm run queue:status
npm run db:stats
```

### During Execution

Monitor:
- CPU usage
- Memory usage
- Database connections
- Queue depth

### After Completion

```bash
npm run db:stats
npm run queue:status
npm run db:verify
```

## Troubleshooting

### Connection Issues

```bash
# Test database
psql $DATABASE_URL -c "SELECT 1"

# Test Redis
redis-cli ping
```

### Rollback Operations

Scripts support rollback:
```bash
npm run script -- --rollback
npm run db:migrate -- --rollback
npm run db:restore --file backup.sql
```

## Automation

Scripts can be scheduled via cron:

```bash
# Daily backup
0 2 * * * cd /app && npm run db:backup

# Weekly cleanup
0 3 * * 0 cd /app && npm run db:cleanup -- --older-than 30

# Hourly queue check
0 * * * * cd /app && npm run queue:status
```

## See Also

- [Database Package Documentation](../packages/db/README.md)
- [Configuration Documentation](../packages/config/README.md)
- [Root README](../README.md)


## RUN SEEDS AND SETUP
<!-- docker exec -it notification-api-production sh -c "npx prisma@5 db push --schema=src/shared/database/models && npm run db:seed"

docker exec -it notification-api-production sh -c "npx prisma@5 db push --schema=src/shared/database/models && pnpm db:setup"


docker exec -it notification-api-production sh -c "npx tsx src/shared/database/seeds/users.seed.ts" -->