import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  // Email
  EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid']).default('smtp'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),

  // Redis
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),
});

export type Environment = z.infer<typeof EnvSchema>;

let config: Environment | null = null;

export function getConfig(): Environment {
  if (!config) {
    config = EnvSchema.parse(process.env);
  }
  return config;
}

export function resetConfig(): void {
  config = null;
}
