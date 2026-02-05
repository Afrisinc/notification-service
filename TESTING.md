# Testing Guide - Email Notification Service

## Overview

This document describes how to run tests for the notification service email worker.

## Test Structure

```
notification-service/
├── __tests__/
│   └── integration/
│       └── worker-email.test.ts       # Integration tests
├── apps/worker-email/src/
│   ├── processor.test.ts              # Unit tests for processor
│   └── providers/
│       ├── smtp.test.ts               # Unit tests for SMTP provider
│       └── sendgrid.test.ts           # Unit tests for SendGrid provider
├── packages/common/src/
│   └── enums/
│       ├── channel.test.ts            # Unit tests for Channel enum
│       └── status.test.ts             # Unit tests for Status enum
└── packages/config/src/
    └── index.test.ts                  # Unit tests for configuration
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm test -- --testPathPattern="(processor|provider|enum|index).test.ts"
```

### Integration Tests Only
```bash
npm test -- --testPathPattern="__tests__"
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Categories

### 1. Unit Tests - Email Worker

**File:** `apps/worker-email/src/processor.test.ts`

Tests the core email processing logic:
- ✅ Processing emails and updating notification status
- ✅ Handling errors and updating failure status
- ✅ Provider selection (SMTP vs SendGrid)
- ✅ Database updates

**Run:**
```bash
npm test -- processor.test.ts
```

### 2. Unit Tests - SMTP Provider

**File:** `apps/worker-email/src/providers/smtp.test.ts`

Tests SMTP email sending:
- ✅ Successful email delivery
- ✅ Error handling
- ✅ Configuration validation
- ✅ Default values for optional config
- ✅ Secure connection settings

**Run:**
```bash
npm test -- smtp.test.ts
```

### 3. Unit Tests - SendGrid Provider

**File:** `apps/worker-email/src/providers/sendgrid.test.ts`

Tests SendGrid API integration:
- ✅ Successful email delivery via SendGrid
- ✅ API error handling
- ✅ API key configuration
- ✅ Default sender address

**Run:**
```bash
npm test -- sendgrid.test.ts
```

### 4. Integration Tests - Email Worker

**File:** `__tests__/integration/worker-email.test.ts`

Tests complete workflows:
- ✅ Full email notification workflow
- ✅ Batch email processing
- ✅ Mixed success/failure scenarios
- ✅ Multiple provider support

**Run:**
```bash
npm test -- worker-email.test.ts
```

### 5. Unit Tests - Enums

**Files:**
- `packages/common/src/enums/channel.test.ts`
- `packages/common/src/enums/status.test.ts`

Tests enum definitions:
- ✅ Correct enum values
- ✅ All required values present
- ✅ Status transition rules

**Run:**
```bash
npm test -- enum
```

### 6. Unit Tests - Configuration

**File:** `packages/config/src/index.test.ts`

Tests environment validation:
- ✅ Configuration loading
- ✅ Default values
- ✅ Email provider validation
- ✅ Redis configuration
- ✅ Configuration caching

**Run:**
```bash
npm test -- config
```

## Test Execution Examples

### Run Specific Test File
```bash
npm test -- apps/worker-email/src/processor.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should send email successfully"
```

### Run with Verbose Output
```bash
npm test -- --verbose
```

### Run Single Test Suite
```bash
npm test -- processor.test.ts --testNamePattern="should process email and update"
```

## Mock Setup

All tests use Jest mocks for external dependencies:

```typescript
jest.mock('@afrisinc-notify/db');
jest.mock('@afrisinc-notify/config');
jest.mock('nodemailer');
jest.mock('@sendgrid/mail');
```

This allows tests to run without requiring actual database or email service connections.

## Test Environment

Tests run with the following environment:
- `NODE_ENV=test`
- `DATABASE_URL=postgresql://test:test@localhost:5432/notification_test`
- `REDIS_URL=redis://localhost:6379/1`
- `JWT_SECRET=test-secret-key`
- `EMAIL_PROVIDER=smtp`

Configured in `jest.setup.ts`

## Coverage Requirements

Current coverage targets:
- Statements: >80%
- Branches: >75%
- Functions: >80%
- Lines: >80%

View coverage report:
```bash
npm run test:coverage
# Open coverage/lcov-report/index.html in browser
```

## CI/CD Integration

Tests are automatically run in CI/CD pipeline (GitHub Actions):

**File:** `.github/workflows/test.yml`

Tests run on:
- Pull requests
- Push to main branch
- Schedule: Daily

## Debugging Tests

### Visual Debugging
```bash
npm test -- --inspect-brk --runInBand
# Then open Chrome DevTools at chrome://inspect
```

### Detailed Logs
```bash
npm test -- --verbose --detectOpenHandles
```

### Specific Test with Debugging
```bash
npm test -- processor.test.ts --detectOpenHandles --forceExit
```

## Common Issues & Solutions

### "Cannot find module" Error
```bash
npm run db:generate
npm run build
npm test
```

### Database Connection Error
```bash
docker-compose up -d postgres
npm test
```

### Redis Connection Error
```bash
docker-compose up -d redis
npm test
```

### Tests Timeout
```bash
# Increase timeout
npm test -- --testTimeout=10000
```

## Best Practices

1. **Keep tests focused** - One assertion per test when possible
2. **Use meaningful names** - Test names should describe what is tested
3. **Mock external dependencies** - Don't make real API calls in tests
4. **Clear setup/teardown** - Use beforeEach/afterEach appropriately
5. **Test edge cases** - Don't just test the happy path

## Adding New Tests

When adding new functionality:

1. Create test file alongside source code
2. Use descriptive test names
3. Mock external dependencies
4. Test both success and failure scenarios
5. Update coverage targets if needed

Example test structure:
```typescript
describe('MyFeature', () => {
  let instance: MyFeature;
  let logger: pino.Logger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = pino({ level: 'silent' });
    instance = new MyFeature(logger);
  });

  describe('methodName', () => {
    it('should do something when condition is met', async () => {
      // Arrange
      const input = { /* test data */ };

      // Act
      const result = await instance.methodName(input);

      // Assert
      expect(result).toBeDefined();
    });
  });
});
```

## Performance Testing

Monitor test execution time:
```bash
npm test -- --verbose --bail
```

Slow tests should complete in <100ms. Use `--testTimeout` for longer operations.

## Continuous Integration

Tests must pass before:
- Merging to main branch
- Deploying to production
- Creating release

All pull requests require passing tests.
