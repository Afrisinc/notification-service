/**
 * Environment variable configuration
 * Provides typed access to all environment variables
 * Uses sensible defaults for optional variables
 */

import { cleanEnv, str, port, url, bool } from 'envalid';

// Validate and export environment variables with defaults
export const env = cleanEnv(process.env, {
  // Application
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
  PORT: port({ default: 3000 }),

  // Database
  DATABASE_URL: str({ default: 'postgresql://user:password@localhost:5432/notification_db' }),

  // JWT & Security
  JWT_SECRET: str({ default: 'your-secret-key-change-in-production' }),
  JWT_EXPIRE: str({ default: '7d' }),

  // URLs & Callbacks
  WEBAPP_URL: url({ default: 'http://localhost:3001' }),
  APP_URL: url({ default: 'http://localhost:3000' }),

  // Tenant & Company Info
  ACCOUNT_ID: str({ default: 'afrisinc-notify-account' }),
  COMPANY_NAME: str({ default: 'Afrisinc' }),
  SUPPORT_EMAIL: str({ default: 'support@afrisinc.com' }),
  FROM_EMAIL: str({ default: 'noreply@afrisinc.com' }),

  // System App ID (for organization invites and system notifications)
  SYSTEM_APP_ID: str({ default: 'system-org-app' }),

  // SMTP Configuration (optional)
  SMTP_HOST: str({ default: 'localhost' }),
  SMTP_PORT: port({ default: 587 }),
  SMTP_USER: str({ default: '' }),
  SMTP_PASS: str({ default: '' }),
  SMTP_FROM: str({ default: 'noreply@afrisinc.com' }),

  // RabbitMQ Configuration (optional)
  RABBITMQ_URL: str({ default: 'amqp://guest:guest@localhost:5672' }),

  // Redis Configuration (optional)
  REDIS_URL: str({ default: 'redis://localhost:6379' }),

  // Logging
  LOG_LEVEL: str({ choices: ['debug', 'info', 'warn', 'error'], default: 'info' }),
});
