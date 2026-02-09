# System Architecture

## High-Level Overview

The Afrisinc Notification Service is a production-grade microservices architecture designed for scalability, reliability, and maintainability.

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (Optional)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    Fastify API Server                        │
│                    Port: 8010                                │
├─────────────────────────────────────────────────────────────┤
│  Routes:                                                    │
│  POST   /notifications          - Create notification       │
│  GET    /notifications/:id      - Get notification          │
│  GET    /notifications          - List notifications        │
│  POST   /templates              - Create template           │
│  GET    /templates/:id          - Get template              │
│  GET    /templates              - List templates            │
│  GET    /health                 - Health check              │
└──────────┬──────────────────────────────────────────────────┘
           │
           │ Publish Events
           ↓
┌─────────────────────────────────────────────────────────────┐
│                   Message Queue (Bull)                       │
│                 Redis Backend                                │
└──┬───────────────────┬──────────────────────┬────────────────┘
   │                   │                      │
   ↓                   ↓                      ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ Email Worker │ │  SMS Worker  │ │ In-App Worker    │
├──────────────┤ ├──────────────┤ ├──────────────────┤
│ Processor    │ │ Processor    │ │ Processor        │
│ SMTP/        │ │ Twilio/      │ │ Database Write   │
│ SendGrid/    │ │ AfricasTalk  │ │ Real-time Sync   │
│ AWS SES      │ │              │ │                  │
└──────┬───────┘ └──────┬───────┘ └────────┬─────────┘
       │                │                   │
       ↓                ↓                   ↓
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│  ├── Notifications                                          │
│  ├── Templates                                              │
│  ├── Tenants                                                │
│  ├── Users                                                  │
│  ├── Audit Logs                                             │
│  └── Queue Jobs                                             │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. API Application (`apps/api`)
**Responsibilities:**
- HTTP request handling
- Authentication and authorization
- Request validation
- Response serialization
- Rate limiting
- Notification creation
- Template management

**Technologies:**
- Fastify web framework
- Pino logging
- Zod validation
- Redis caching
- JWT authentication

### 2. Worker Applications
#### Email Worker (`apps/worker-email`)
- Consumes email notification jobs
- Routes to configured provider (SMTP, SendGrid, AWS SES)
- Handles retry logic
- Tracks delivery status

#### SMS Worker (`apps/worker-sms`)
- Consumes SMS notification jobs
- Routes to configured provider (Twilio, AfricasTalking)
- Handles retry logic
- Tracks delivery status

#### In-App Worker (`apps/worker-inapp`)
- Consumes in-app notification jobs
- Stores in database
- Manages user preferences
- Tracks read/click events

### 3. Shared Packages

#### Common (`packages/common`)
- Type definitions
- Enums
- Error classes
- Constants
- Shared utilities

#### Config (`packages/config`)
- Environment validation
- Configuration management
- Provider-specific settings
- Secrets management

#### Database (`packages/db`)
- Prisma ORM setup
- Database client singleton
- Repository layer
- Migration management

## Communication Patterns

### Synchronous
- REST API calls from clients
- API to Queue (fire-and-forget)
- API to Database (CRUD operations)

### Asynchronous
- API → Queue: Notification jobs
- Queue → Worker: Job processing
- Worker → Database: Status updates
- Worker → External Services: Email/SMS delivery

## Data Flow

### Notification Creation Flow

```
1. Client sends POST /notifications
2. API validates request
3. API creates Notification record (status: pending)
4. API publishes events to Bull queues
5. Return 202 Accepted with notification ID
6. Workers consume from respective queues
7. Workers send via external providers
8. Workers update status in database
9. Client polls or uses webhooks for status updates
```

### Template Usage Flow

```
1. Client creates template with variables
2. API stores template in database
3. When creating notification:
   - Reference template by ID
   - API merges variables into template
   - Create notification with merged content
   - Proceed with normal flow
```

## Deployment Architecture

### Development
- Docker Compose
- Local PostgreSQL
- Local Redis
- All services in containers

### Production
- Kubernetes orchestration
- Managed database (RDS/Cloud SQL)
- Managed cache (ElastiCache/Memorystore)
- Load balancing
- Auto-scaling based on metrics
- Health checks and readiness probes

## Scalability Strategy

### Horizontal Scaling
- Stateless API instances
- Worker instances scale with queue depth
- Load balancer distributes requests

### Vertical Scaling
- Database connection pooling
- Redis cluster mode
- Worker process optimization

### Queue Management
- Bull queue with Redis backend
- Job prioritization
- Automatic retries with exponential backoff
- Dead letter queue (DLQ) for failed jobs

## Security Architecture

### Authentication
- JWT tokens
- API key for tenant-level access
- Role-based access control (RBAC)

### Data Protection
- Encryption at rest (database)
- Encryption in transit (TLS)
- Input validation and sanitization
- SQL injection prevention (Prisma ORM)
- XSS prevention (JSON responses)

### Isolation
- Multi-tenant isolation at database level
- Tenant filtering in all queries
- API key segregation

## Monitoring and Observability

### Logging
- Structured logging with Pino
- Request correlation IDs
- Log levels: trace, debug, info, warn, error, fatal

### Metrics
- Queue job count
- Processing times
- Error rates
- Delivery success rates

### Health Checks
- Liveness probe: `/health/live`
- Readiness probe: `/health/ready`
- Database connectivity
- Redis connectivity
- Queue health

## Error Handling Strategy

### API Level
- Input validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Resource not found (404)
- Rate limit errors (429)
- Server errors (500)

### Worker Level
- Retry with exponential backoff
- Maximum retry attempts
- Dead letter queue for failures
- Error logging and notifications

### Database Level
- Transaction support for atomicity
- Foreign key constraints
- Unique constraints for data integrity

## Caching Strategy

### Cache Layers
1. **Application Cache**: Redis for hot data
2. **Database Cache**: Prisma query caching
3. **HTTP Cache**: Client-side caching with ETag/Last-Modified

### Cache Invalidation
- Time-based (TTL)
- Event-based (on data update)
- Manual purge for critical data

## Performance Optimization

### Database
- Connection pooling
- Query optimization
- Indexed lookups
- Pagination for large result sets

### Queue Processing
- Batch processing when applicable
- Priority-based processing
- Parallel processing

### API Response
- Compression (gzip)
- JSON minification
- Lazy loading of related data
