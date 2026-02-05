# Complete Setup Guide - Email Notification Service

## System Requirements

- Node.js 20+
- npm 9+ or pnpm 8+
- Docker & Docker Compose
- PostgreSQL 16+ (or Docker)
- Redis 7+ (or Docker)

## Installation Steps

### 1. Clone & Install Dependencies

```bash
# Clone repository
git clone <repository-url>
cd notification-service

# Install dependencies using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

### 2. Start Infrastructure Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps

# Expected output:
# postgres    running on port 5432
# redis       running on port 6379
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Required Environment Variables:**

```env
# Database
DATABASE_URL=postgresql://notification:password@localhost:5432/notification_db

# Redis
REDIS_URL=redis://localhost:6379

# Email Provider (choose one: smtp or sendgrid)
EMAIL_PROVIDER=smtp
# Or: EMAIL_PROVIDER=sendgrid

# For SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourcompany.com

# For SendGrid
# SENDGRID_API_KEY=SG.xxxxx
```

### 4. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Create and run migrations
npm run db:migrate

# Seed sample data
npm run db:seed

# Verify database
npm run db:studio  # Opens Prisma Studio on http://localhost:5555
```

### 5. Build Project

```bash
# Build all packages
npm run build

# Or build specific package
npm run build -w @afrisinc-notify/worker-email
```

## Running the Email Worker

### Development Mode (with hot reload)

```bash
# In separate terminals

# Terminal 1: Email Worker
npm run worker:email:dev

# Terminal 2: Monitor logs
docker-compose logs -f

# Terminal 3: Database Studio (optional)
npm run db:studio
```

### Production Mode

```bash
# Build first
npm run build

# Run worker
npm start -w @afrisinc-notify/worker-email
```

## Testing

### Run All Tests

```bash
# Unit and integration tests
npm test

# With coverage report
npm run test:coverage

# Watch mode (auto-rerun on changes)
npm run test:watch
```

### Run Specific Tests

```bash
# Email worker tests
npm test -- processor.test.ts

# SMTP provider tests
npm test -- smtp.test.ts

# Integration tests
npm test -- __tests__/integration
```

## Verification Checklist

### ✅ Services Running

```bash
# Check all services
docker-compose ps

# Test database
psql notification_db -c "SELECT 1"

# Test Redis
redis-cli ping
# Should return: PONG
```

### ✅ Database Ready

```bash
# Check Prisma client generated
ls node_modules/.prisma/client/

# Check schema initialized
npm run db:studio
# Open http://localhost:5555 and verify Notification table exists
```

### ✅ Worker Ready

```bash
# Start worker
npm run worker:email:dev

# Should see output similar to:
# Email worker started successfully
# Listening on queue: email-notifications
```

### ✅ Configuration Loaded

```bash
# Verify environment variables
echo "Provider: $EMAIL_PROVIDER"
echo "Database: $DATABASE_URL"
echo "Redis: $REDIS_URL"
```

## Troubleshooting Setup

### Port Already in Use

```bash
# Find process using port
lsof -i :5432   # PostgreSQL
lsof -i :6379   # Redis

# Kill the process
kill -9 <PID>

# Or use different port in docker-compose.yml
```

### Database Connection Error

```bash
# Check PostgreSQL is running
docker-compose logs postgres

# Verify DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:password@localhost:5432/dbname

# Create database if missing
docker-compose exec postgres createdb -U notification notification_db
```

### Redis Connection Error

```bash
# Check Redis is running
docker-compose logs redis

# Test connection
redis-cli -u $REDIS_URL ping

# Should return: PONG
```

### Prisma Client Not Found

```bash
# Generate Prisma client
npm run db:generate

# Clear cache
rm -rf node_modules/.prisma

# Reinstall
npm install
npm run db:generate
```

### Email Provider Configuration

**For SMTP (Gmail):**
1. Enable 2-Factor Authentication
2. Create [App Password](https://support.google.com/accounts/answer/185833)
3. Use app password in SMTP_PASSWORD

**For SendGrid:**
1. Create account at https://sendgrid.com
2. Generate API key in dashboard
3. Verify sender domain/email

## Project Structure

```
notification-service/
├── apps/
│   ├── api/                    # Fastify API server
│   ├── worker-email/           # Email worker (MAIN)
│   ├── worker-sms/             # SMS worker (coming soon)
│   └── worker-inapp/           # In-app worker (coming soon)
├── packages/
│   ├── common/                 # Shared types & enums
│   ├── config/                 # Configuration management
│   └── db/                     # Database & Prisma setup
├── __tests__/                  # Test suites
├── scripts/                    # Utility scripts
├── docs/                       # Documentation
├── docker-compose.yml          # Container orchestration
├── pnpm-workspace.yaml         # Monorepo configuration
├── jest.config.ts              # Jest configuration
└── package.json                # Root package configuration
```

## Available Commands

### Development

```bash
npm run worker:email:dev        # Email worker (dev mode)
npm run api:dev                 # API server (dev mode)
npm run build                   # Build all packages
npm test                        # Run tests
npm run test:watch              # Watch mode for tests
npm run test:coverage           # Generate coverage report
npm run lint                    # Lint all code
npm run format                  # Format all code
```

### Database

```bash
npm run db:generate             # Generate Prisma client
npm run db:migrate              # Run migrations
npm run db:seed                 # Seed database
npm run db:studio               # Open Prisma Studio UI
npm run db:push                 # Push schema to database
npm run db:reset                # Reset database (dev only)
```

### Docker

```bash
npm run docker:up               # Start services
npm run docker:down             # Stop services
npm run docker:build            # Build Docker images
npm run docker:logs             # View logs
```

## Next Steps

1. ✅ Infrastructure running
2. ✅ Database configured
3. ✅ Email worker tested
4. ⬜ Implement SMS worker (follow same pattern)
5. ⬜ Implement In-App worker
6. ⬜ Deploy to production

## Production Deployment

### Build Docker Image

```bash
# Build image
npm run docker:build worker-email

# Or manually
docker build -f apps/worker-email/Dockerfile -t notification-service:email-worker .
```

### Deploy to Kubernetes

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/base/
# Or with overlays
kubectl apply -k k8s/overlays/prod/
```

### Environment Variables (Production)

Set these securely in your deployment:
- `DATABASE_URL` - Managed database connection string
- `REDIS_URL` - Managed Redis instance
- `EMAIL_PROVIDER` - Production email provider
- `SENDGRID_API_KEY` or SMTP credentials
- `NODE_ENV=production`
- `LOG_LEVEL=warn`

## Support & Documentation

- **Quick Start:** See [QUICK_START.md](./QUICK_START.md)
- **Testing Guide:** See [TESTING.md](./TESTING.md)
- **E2E Testing:** See [E2E_TESTING.md](./E2E_TESTING.md)
- **Architecture:** See [docs/architecture.md](./docs/architecture.md)

## Monitoring & Logs

### View Logs

```bash
# Worker logs
npm run worker:email:dev 2>&1 | tee worker.log

# Docker logs
docker-compose logs -f

# Specific service
docker-compose logs postgres
docker-compose logs redis
```

### Database Monitoring

```bash
# Connect to database
psql notification_db

# Check notification count
SELECT status, COUNT(*) FROM "Notification" GROUP BY status;

# View recent notifications
SELECT id, status, "sentAt" FROM "Notification" ORDER BY "createdAt" DESC LIMIT 10;
```

### Queue Monitoring

```bash
# Check queue depth
redis-cli LLEN bull:email-notifications:jobs

# View pending jobs
redis-cli LRANGE bull:email-notifications:jobs 0 -1

# Check failed jobs
redis-cli LLEN bull:email-notifications:failed
```

## Health Checks

```bash
# API Health
curl http://localhost:3000/health

# Database Connection
npm run db:studio

# Redis Connection
redis-cli ping

# Email Provider
# SMTP: telnet smtp.gmail.com 587
# SendGrid: curl https://api.sendgrid.com/v3/mail/check -H "Authorization: Bearer $SENDGRID_API_KEY"
```

## Common Issues

### Worker Crashes on Start
- Check environment variables are set
- Verify Redis is running
- Check database connection

### Emails Not Sending
- Check email provider credentials
- Verify recipient email address format
- Check email provider status page
- Review worker logs for errors

### High Memory Usage
- Check notification queue size
- Monitor database connections
- Review logs for memory leaks

## Getting Help

1. Check logs: `docker-compose logs -f`
2. Review documentation: `TESTING.md`, `E2E_TESTING.md`
3. Check troubleshooting: See above section
4. Open GitHub issue with logs and error messages
