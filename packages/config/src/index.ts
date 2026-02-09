import { z } from "zod";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";

/**
 * Load environment variables from .env file in project root
 * Traverse up from the current module until we find .env
 */
function loadEnvironmentVariables() {
  let currentDir = __dirname;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const envPath = path.join(currentDir, ".env");
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
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),

  // Database Configuration
  DATABASE_URL: z.string({
    description: "PostgreSQL connection string (required for Prisma)",
  }),

  // JWT Configuration
  JWT_SECRET: z.string().default("dev-secret-change-in-production"),

  // Redis Configuration
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Queue Configuration
  QUEUE_NAME: z.string().default("notifications"),

  // CORS Configuration
  CORS_ORIGINS: z.string().optional().default("http://localhost:8010"),

  // Email Configuration
  EMAIL_PROVIDER: z.enum(["smtp", "sendgrid"]).default("smtp"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),

  // Database Logging
  DATABASE_LOG_QUERIES: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
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
          const path = err.path.join(".");
          return `  ${path}: ${err.message}`;
        })
        .join("\n");

      throw new Error(
        `Environment validation failed:\n${errors}`,
      );
    }

    config = result.data;
  }
  return config;
}

export function resetConfig(): void {
  config = null;
}
