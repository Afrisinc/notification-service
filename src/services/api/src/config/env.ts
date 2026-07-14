/**
 * Environment variable configuration
 * Provides typed access to all environment variables
 * Uses sensible defaults for optional variables
 */

import { cleanEnv, str, port, url } from 'envalid';

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

  USDEXCHANGE_RATE: str({ default: '1450' }),

  // Tenant & Company Info
  COMPANY_NAME: str({ default: 'Afrisinc' }),
  SUPPORT_EMAIL: str({ default: 'support@afrisinc.com' }),
  FROM_EMAIL: str({ default: 'noreply@afrisinc.com' }),

  // System App ID (for organization invites and system notifications)
  SYSTEM_ACCOUNT_ID: str({ default: 'afrisinc-notify-account' }),
  SYSTEM_APP_ID: str({ default: 'system-org-app' }),
  RESET_PASSWORD_TEMPLATE_ID: str({ default: 'system-reset-password' }),
  VERIFY_EMAIL_TEMPLATE_ID: str({ default: 'system-verify-email' }),
  WELCOME_EMAIL_TEMPLATE_ID: str({ default: 'system-welcome-email' }),
  INVITE_MEMBER_TEMPLATE_ID: str({ default: 'system-invite-member' }),

  // Admin Alerts & System Notifications
  ADMIN_EMAILS: str({ default: '' }),
  SYSTEM_ALERT_TEMPLATE_ID: str({ default: '' }),
  USAGE_APPROACHING_LIMIT_TEMPLATE_ID: str({ default: '' }),
  USAGE_LIMIT_EXCEEDED_TEMPLATE_ID: str({ default: '' }),
  ALERT_WEBHOOK_URL: str({ default: '' }),

  // Trial & Billing Notifications
  TRIAL_REMINDER_TEMPLATE_ID: str({ default: 'system-trial-reminder' }),
  TRIAL_EXPIRED_TEMPLATE_ID: str({ default: 'system-trial-expired' }),
  BILLING_CONFIRMATION_TEMPLATE_ID: str({ default: 'system-billing-confirmation' }),
  PAYMENT_FAILED_TEMPLATE_ID: str({ default: 'system-payment-failed' }),
  SUBSCRIPTION_CANCELLED_TEMPLATE_ID: str({ default: 'system-subscription-cancelled' }),
  PLAN_CHANGED_TEMPLATE_ID: str({ default: 'system-plan-changed' }),
  TRIAL_REMINDER_DAYS_BEFORE: str({ default: '3' }),

  // SMTP Configuration (optional)
  SMTP_HOST: str({ default: 'localhost' }),
  SMTP_PORT: port({ default: 587 }),
  SMTP_USER: str({ default: '' }),
  SMTP_PASSWORD: str({ default: '' }),
  SMTP_FROM: str({ default: 'noreply@afrisinc.com' }),

  // RabbitMQ Configuration (optional)
  RABBITMQ_URL: str({ default: 'amqp://guest:guest@localhost:5672' }),

  // Redis Configuration (optional)
  REDIS_URL: str({ default: 'redis://localhost:6379' }),

  // Logging
  LOG_LEVEL: str({ choices: ['debug', 'info', 'warn', 'error'], default: 'info' }),

  // Assets Service (Marketplace file uploads)
  ASSETS_API_URL: str({ default: 'http://localhost:8080' }),
  ASSETS_API_KEY: str({ default: 'dev-api-key' }),

  // DLQ Alert Threshold
  DLQ_ALERT_THRESHOLD: str({ default: '100' }),

  // Payment Service
  PAYMENT_SERVICE_URL: url({ default: 'http://localhost:3400' }),
  PAYMENT_API_KEY: str({ default: '' }),
  AFRISINC_PAY_WEBHOOK_SECRET: str({ default: '' }),
});
