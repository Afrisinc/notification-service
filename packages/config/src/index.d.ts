import { z } from "zod";
declare const EnvSchema: z.ZodObject<{
    PORT: z.ZodDefault<z.ZodNumber>;
    HOST: z.ZodDefault<z.ZodString>;
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "staging", "production"]>>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
    DATABASE_URL: z.ZodString;
    JWT_SECRET: z.ZodDefault<z.ZodString>;
    REDIS_URL: z.ZodDefault<z.ZodString>;
    QUEUE_NAME: z.ZodDefault<z.ZodString>;
    RABBITMQ_URL: z.ZodDefault<z.ZodString>;
    RABBITMQ_HOST: z.ZodOptional<z.ZodString>;
    RABBITMQ_PORT: z.ZodOptional<z.ZodNumber>;
    RABBITMQ_USER: z.ZodOptional<z.ZodString>;
    RABBITMQ_PASSWORD: z.ZodOptional<z.ZodString>;
    RABBITMQ_VHOST: z.ZodOptional<z.ZodString>;
    CORS_ORIGINS: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    EMAIL_PROVIDER: z.ZodDefault<z.ZodEnum<["smtp", "sendgrid"]>>;
    SMTP_HOST: z.ZodOptional<z.ZodString>;
    SMTP_PORT: z.ZodOptional<z.ZodNumber>;
    SMTP_USER: z.ZodOptional<z.ZodString>;
    SMTP_PASSWORD: z.ZodOptional<z.ZodString>;
    SMTP_FROM: z.ZodOptional<z.ZodString>;
    SENDGRID_API_KEY: z.ZodOptional<z.ZodString>;
    DATABASE_LOG_QUERIES: z.ZodDefault<z.ZodOptional<z.ZodEnum<["true", "false"]>>>;
}, "strip", z.ZodTypeAny, {
    PORT: number;
    HOST: string;
    NODE_ENV: "development" | "staging" | "production";
    LOG_LEVEL: "debug" | "info" | "warn" | "error";
    DATABASE_URL: string;
    JWT_SECRET: string;
    REDIS_URL: string;
    QUEUE_NAME: string;
    RABBITMQ_URL: string;
    CORS_ORIGINS: string;
    EMAIL_PROVIDER: "smtp" | "sendgrid";
    DATABASE_LOG_QUERIES: "true" | "false";
    RABBITMQ_HOST?: string | undefined;
    RABBITMQ_PORT?: number | undefined;
    RABBITMQ_USER?: string | undefined;
    RABBITMQ_PASSWORD?: string | undefined;
    RABBITMQ_VHOST?: string | undefined;
    SMTP_HOST?: string | undefined;
    SMTP_PORT?: number | undefined;
    SMTP_USER?: string | undefined;
    SMTP_PASSWORD?: string | undefined;
    SMTP_FROM?: string | undefined;
    SENDGRID_API_KEY?: string | undefined;
}, {
    DATABASE_URL: string;
    PORT?: number | undefined;
    HOST?: string | undefined;
    NODE_ENV?: "development" | "staging" | "production" | undefined;
    LOG_LEVEL?: "debug" | "info" | "warn" | "error" | undefined;
    JWT_SECRET?: string | undefined;
    REDIS_URL?: string | undefined;
    QUEUE_NAME?: string | undefined;
    RABBITMQ_URL?: string | undefined;
    RABBITMQ_HOST?: string | undefined;
    RABBITMQ_PORT?: number | undefined;
    RABBITMQ_USER?: string | undefined;
    RABBITMQ_PASSWORD?: string | undefined;
    RABBITMQ_VHOST?: string | undefined;
    CORS_ORIGINS?: string | undefined;
    EMAIL_PROVIDER?: "smtp" | "sendgrid" | undefined;
    SMTP_HOST?: string | undefined;
    SMTP_PORT?: number | undefined;
    SMTP_USER?: string | undefined;
    SMTP_PASSWORD?: string | undefined;
    SMTP_FROM?: string | undefined;
    SENDGRID_API_KEY?: string | undefined;
    DATABASE_LOG_QUERIES?: "true" | "false" | undefined;
}>;
export type Environment = z.infer<typeof EnvSchema>;
/**
 * Get validated environment configuration
 * All environment variables are validated using Zod schema
 */
export declare function getConfig(): Environment;
export declare function resetConfig(): void;
export {};
//# sourceMappingURL=index.d.ts.map