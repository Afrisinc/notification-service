# Quick Start - Email Worker

## ✅ What's Implemented

### Structure
```
notification-service/
├── packages/
│   ├── common/src/          ✅ Types & Enums
│   ├── config/src/          ✅ Environment validation
│   ├── db/
│   │   ├── prisma/          ✅ Database schema
│   │   └── src/             ✅ Prisma client
│   └── config/              ✅ Configuration
├── apps/
│   ├── api/src/             ✅ Fastify API (basic)
│   └── worker-email/src/    ✅ Email Worker (MAIN)
│       ├── index.ts         ✅ Worker entry point
│       ├── processor.ts     ✅ Email processor
│       └── providers/
│           ├── smtp.ts      ✅ SMTP provider
│           └── sendgrid.ts  ✅ SendGrid provider
└── pnpm-workspace.yaml      ✅ Monorepo config
```

## 🚀 Running the Email Worker

### Prerequisites
Make sure you have the services running:
```bash
# Start database and cache
docker-compose up -d

# This starts:
# - PostgreSQL on port 5432
# - Redis on port 6379
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your email provider credentials:
```

**For SMTP (Gmail example):**
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@example.com
```

**For SendGrid:**
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SMTP_FROM=noreply@example.com
```

### Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Create and run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### Run the Email Worker
```bash
# Development mode (with hot reload)
npm run worker:email:dev

# OR Production mode
npm run build
npm start -w @afrisinc-notify/worker-email
```

## 📋 Project Scripts

### Development
```bash
npm run worker:email:dev       # Run email worker (dev mode)
npm run api:dev                # Run API server (dev mode)
npm run build                  # Build all packages
npm run lint                   # Lint all code
npm run format                 # Format all code
```

### Database
```bash
npm run db:generate            # Generate Prisma client
npm run db:migrate             # Run migrations
npm run db:seed                # Seed database
npm run db:studio              # Open Prisma Studio UI
```

### Docker
```bash
npm run docker:up              # Start services
npm run docker:down            # Stop services
npm run docker:logs            # View logs
```

## 🏗️ Architecture

### Email Worker Flow
```
1. Worker starts and connects to Redis
2. Listens for jobs on 'email-notifications' queue
3. Processes each job:
   - Validates email data
   - Selects email provider (SMTP or SendGrid)
   - Sends email
   - Updates database with status (sent/failed)
4. Handles retries with exponential backoff
5. Graceful shutdown on SIGTERM
```

### Database
- **Table**: `Notification`
- **Fields**: id, tenantId, recipientId, channel, subject, body, status, externalId, failureReason, timestamps
- **Status Values**: pending, sent, failed, bounced

## 🔧 Testing the Email Worker

### 1. Test SMTP Connection (for debugging)
```bash
# Using telnet (for SMTP_HOST and SMTP_PORT)
telnet smtp.gmail.com 587
```

### 2. Send Test Email via API (when API is ready)
```bash
curl -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-tenant",
    "recipientId": "user-123",
    "channels": [{"type": "email", "recipient": "test@example.com"}],
    "subject": "Test Email",
    "body": "This is a test notification"
  }'
```

### 3. Monitor Queue
```bash
# Check queue status
npm run queue:status

# View Redis
redis-cli
> KEYS bull:email-notifications:*
> LLEN bull:email-notifications:jobs
```

## 🐛 Troubleshooting

### Email worker not processing jobs?
```bash
# 1. Check Redis is running
redis-cli ping
# Should return: PONG

# 2. Check logs
docker-compose logs redis
docker-compose logs postgres

# 3. Verify environment variables
echo $EMAIL_PROVIDER
echo $REDIS_URL
```

### "Cannot find module" errors?
```bash
# Regenerate Prisma client
npm run db:generate

# Rebuild packages
npm run build
```

### Database connection errors?
```bash
# Check database is running
docker-compose logs postgres

# Reset database (development only!)
npm run db:reset

# Run migrations
npm run db:migrate
```

## 📦 Dependencies

- **bull**: Job queue
- **nodemailer**: SMTP email sending
- **@sendgrid/mail**: SendGrid API
- **@prisma/client**: Database ORM
- **fastify**: Web framework
- **pino**: Logging
- **zod**: Environment validation

## 🔐 Environment Variables

Required:
```env
DATABASE_URL          # PostgreSQL connection string
REDIS_URL            # Redis connection string
EMAIL_PROVIDER       # smtp or sendgrid
```

Optional:
```env
NODE_ENV             # development or production (default: development)
LOG_LEVEL            # trace, debug, info, warn, error (default: info)
SMTP_HOST            # For SMTP provider
SMTP_PORT            # For SMTP provider
SMTP_USER            # For SMTP provider
SMTP_PASSWORD        # For SMTP provider
SMTP_FROM            # Sender email address
SENDGRID_API_KEY     # For SendGrid provider
```

## 📞 Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Review database schema: `npm run db:studio`
3. Check queue status: `npm run queue:status`
4. Review code in `apps/worker-email/src/`

## ✨ Next Steps

1. ✅ Email worker implemented
2. ⬜ SMS worker (similar pattern)
3. ⬜ In-App worker
4. ⬜ Complete API endpoints
5. ⬜ Add tests
6. ⬜ Deploy to production
