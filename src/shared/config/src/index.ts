import { z } from 'zod';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Load environment variables from .env file in project root
 * Traverse up from the current module until we find .env
 */
function loadEnvironmentVariables() {
  let currentDir = __dirname;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      loadEnv({ path: envPath });
      return;
    }
    currentDir = path.dirname(currentDir);
    attempts++;
  }

  // If not found, try loading from current working directory
  loadEnv();
}

// Load environment variables before validation
loadEnvironmentVariables();

const EnvSchema = z.object({
  // Server Configuration
  PORT: z.coerce.number().default(8010),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Database Configuration
  DATABASE_URL: z.string({
    description: 'PostgreSQL connection string (required for Prisma)',
  }),

  // JWT Configuration
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),

  // Redis Configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Queue Configuration
  QUEUE_NAME: z.string().default('notifications'),

  // RabbitMQ Configuration
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_HOST: z.string().optional(),
  RABBITMQ_PORT: z.coerce.number().optional(),
  RABBITMQ_USER: z.string().optional(),
  RABBITMQ_PASSWORD: z.string().optional(),
  RABBITMQ_VHOST: z.string().optional(),

  // CORS Configuration
  CORS_ORIGINS: z.string().optional().default('http://localhost:8010'),

  // Email Configuration
  EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid']).default('smtp'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  FROM_EMAIL: z.string().default('noreply@afrisinc.com'),
  SENDGRID_API_KEY: z.string().optional(),

  // Database Logging
  DATABASE_LOG_QUERIES: z.enum(['true', 'false']).optional().default('false'),

  // Assets Service Configuration (for file uploads)
  ASSETS_API_URL: z.string().default('http://localhost:8080'),
  ASSETS_API_KEY: z.string().default('dev-api-key'),

  // SMS Provider Configuration
  // Africa's Talking
  AFRICAS_TALKING_API_KEY: z.string().optional(),
  AFRICAS_TALKING_USERNAME: z.string().optional(),
  AFRICAS_TALKING_SENDER_ID: z.string().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_MAX_PRICE: z.string().optional(),
  TWILIO_VALIDITY_PERIOD: z.string().optional(),

  // Vonage/Nexmo
  VONAGE_API_KEY: z.string().optional(),
  VONAGE_API_SECRET: z.string().optional(),
  VONAGE_SENDER_ID: z.string().optional(),

  // Database Encryption
  DATABASE_ENCRYPTION_KEY: z.string().optional(),

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Mail Server SSH Configuration (for DKIM key generation)
  MAIL_SERVER_HOST: z.string().optional(),
  MAIL_SERVER_PORT: z.coerce.number().optional().default(22),
  MAIL_SERVER_USER: z.string().optional().default('root'),
  MAIL_SERVER_SSH_KEY: z.string().optional(),
  MAIL_SERVER_SSH_PASSWORD: z.string().optional(),
});

export type Environment = z.infer<typeof EnvSchema>;

let config: Environment | null = null;

/**
 * Get validated environment configuration
 * All environment variables are validated using Zod schema
 */
export function getConfig(): Environment {
  if (!config) {
    const result = EnvSchema.safeParse(process.env);

    if (!result.success) {
      const errors = result.error.errors
        .map((err) => {
          const path = err.path.join('.');
          return `  ${path}: ${err.message}`;
        })
        .join('\n');

      throw new Error(`Environment validation failed:\n${errors}`);
    }

    config = result.data;
  }
  return config;
}

export function resetConfig(): void {
  config = null;
}
