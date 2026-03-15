# Config Package

Centralized environment variable and configuration management for all services.

## Overview

Type-safe configuration management using Zod schema validation. Ensures all services have consistent, validated configuration.

## Directory Structure

```
config/
├── src/
│   ├── index.ts                  # Main exports
│   ├── env.ts                    # Environment schema & validation
│   ├── config.ts                 # Configuration getters
│   ├── email/
│   │   └── providers.ts          # Email provider configs
│   ├── sms/
│   │   └── providers.ts          # SMS provider configs
│   ├── queue/
│   │   └── config.ts             # Message queue configs
│   └── validators/
│       ├── email.ts              # Email validation
│       └── phone.ts              # Phone validation
│
├── .env.example                  # Example configuration
├── package.json
└── tsconfig.json
```

## Environment Variables

### Application

```env
NODE_ENV=development|staging|production
LOG_LEVEL=debug|info|warn|error
APP_VERSION=1.0.0
```

### Server

```env
API_PORT=8010
API_HOST=0.0.0.0
CORS_ORIGIN=*|https://example.com
```

### Database

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/notify_db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_STATEMENT_CACHE_SIZE=25
DATABASE_TIMEOUT=80100
```

### Redis

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_URL=redis://localhost:6379
```

### Message Queue

```env
QUEUE_TYPE=bull|rabbitmq
# For Bull
BULL_REDIS_URL=redis://localhost:6379/1
# For RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

### Authentication

```env
JWT_SECRET=your-super-secret-key
JWT_EXPIRATION=24h
API_KEY_ENABLED=true
```

### Email Configuration

```env
EMAIL_PROVIDER=smtp|sendgrid|aws-ses
EMAIL_FROM=noreply@example.com

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_TLS=true

# SendGrid
SENDGRID_API_KEY=SG.xxx

# AWS SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

### SMS Configuration

```env
SMS_PROVIDER=twilio|africastalking

# Twilio
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_FROM_NUMBER=+1234567890

# AfricasTalking
AFRICASTALKING_API_KEY=xxx
AFRICASTALKING_USERNAME=xxx
AFRICASTALKING_FROM_NAME=xxx
```

### External Services

```env
SENTRY_DSN=https://xxx@sentry.io/xxx
DATADOG_API_KEY=xxx
JAEGER_ENDPOINT=http://localhost:14268/api/traces
```

### Feature Flags

```env
ENABLE_LOGGING=true
ENABLE_TRACING=false
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true
```

### Rate Limiting

```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Retry & Backoff

```env
MAX_RETRIES=3
RETRY_BACKOFF_INITIAL=1000
RETRY_BACKOFF_MAX=60000
RETRY_BACKOFF_MULTIPLIER=2
```

## Usage

### Get Configuration

```typescript
import { getConfig, isDevelopment } from '@afrisinc/notify-config';

const config = getConfig();
console.log(config.API_PORT); // 8010
console.log(config.DATABASE_URL); // postgresql://...
console.log(isDevelopment()); // true|false
```

### Email Provider Configuration

```typescript
import { getEmailProviderConfig } from '@afrisinc/notify-config';

const emailConfig = getEmailProviderConfig();
// Returns configuration for configured provider
// {
//   provider: 'smtp',
//   host: 'smtp.example.com',
//   port: 587,
//   ...
// }
```

### SMS Provider Configuration

```typescript
import { getSmsProviderConfig } from '@afrisinc/notify-config';

const smsConfig = getSmsProviderConfig();
// Returns configuration for configured SMS provider
```

### Queue Configuration

```typescript
import { getQueueConfig } from '@afrisinc/notify-config';

const queueConfig = getQueueConfig();
// Returns configuration for Bull or RabbitMQ
```

### Type-Safe Access

```typescript
import { getConfig, type Config } from '@afrisinc/notify-config';

const config: Config = getConfig();

// TypeScript ensures all required fields exist
// and have correct types
```

## Configuration Validation

All environment variables are validated on startup using Zod:

```typescript
import { validateConfig } from '@afrisinc/notify-config';

try {
  const config = validateConfig(process.env);
  console.log('Configuration valid');
} catch (error) {
  console.error('Invalid configuration:', error.message);
  process.exit(1);
}
```

## Environment-Specific Overrides

```bash
# Development
NODE_ENV=development npm start

# Staging
NODE_ENV=staging npm start

# Production
NODE_ENV=production npm start
```

Different defaults per environment:

- **Development**: Pretty logging, debug level
- **Staging**: Structured logging, info level
- **Production**: Structured JSON logging, warn level

## Best Practices

1. **Never commit .env files** - Use .env.example
2. **Validate on startup** - Application exits if config invalid
3. **Use type-safe access** - Import Config type
4. **Document required variables** - In .env.example
5. **Provide sensible defaults** - For optional variables
6. **Use secrets manager** - For sensitive values in production

## Examples

### Development Setup

```env
NODE_ENV=development
API_PORT=8010
LOG_LEVEL=debug

DATABASE_URL=postgresql://localhost/notify_dev
REDIS_URL=redis://localhost:6379

JWT_SECRET=dev-secret-key
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025

SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=test
TWILIO_AUTH_TOKEN=test
```

### Production Setup

```env
NODE_ENV=production
LOG_LEVEL=warn

DATABASE_URL=postgresql://<prod-user>:<prod-pass>@prod-db.example.com/notify_prod
REDIS_URL=redis://<user>:<pass>@redis.example.com:6379

JWT_SECRET=<strong-random-secret>
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=<key>

SMS_PROVIDER=africastalking
AFRICASTALKING_API_KEY=<key>

SENTRY_DSN=<sentry-dsn>
```

## Configuration Loading Order

1. Read .env file (if exists)
2. Read environment variables
3. Apply defaults
4. Validate with Zod schema
5. Throw error if validation fails

## Adding New Configuration

1. Add to .env.example with default value
2. Add to Zod schema in `src/env.ts`
3. Export getter function in `src/config.ts`
4. Document in this README
5. Run `npm run type-check`

## Testing

```bash
npm test
npm test:watch
```

Mock configuration in tests:

```typescript
import { getConfig } from '@afrisinc/notify-config';

jest.mock('@afrisinc/notify-config', () => ({
  getConfig: jest.fn(() => ({
    API_PORT: 8010,
    DATABASE_URL: 'test://...',
    // ...
  })),
}));
```

## See Also

- [Zod Documentation](https://zod.dev/)
- [12 Factor App - Config](https://12factor.net/config)
- [Root README](../../README.md)
