"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.resetConfig = resetConfig;
const zod_1 = require("zod");
const dotenv_1 = require("dotenv");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
/**
 * Load environment variables from .env file in project root
 * Traverse up from the current module until we find .env
 */
function loadEnvironmentVariables() {
    let currentDir = __dirname;
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
        const envPath = node_path_1.default.join(currentDir, ".env");
        if (node_fs_1.default.existsSync(envPath)) {
            (0, dotenv_1.config)({ path: envPath });
            return;
        }
        currentDir = node_path_1.default.dirname(currentDir);
        attempts++;
    }
    // If not found, try loading from current working directory
    (0, dotenv_1.config)();
}
// Load environment variables before validation
loadEnvironmentVariables();
const EnvSchema = zod_1.z.object({
    // Server Configuration
    PORT: zod_1.z.coerce.number().default(8010),
    HOST: zod_1.z.string().default("0.0.0.0"),
    NODE_ENV: zod_1.z
        .enum(["development", "staging", "production"])
        .default("development"),
    LOG_LEVEL: zod_1.z
        .enum(["debug", "info", "warn", "error"])
        .default("info"),
    // Database Configuration
    DATABASE_URL: zod_1.z.string({
        description: "PostgreSQL connection string (required for Prisma)",
    }),
    // JWT Configuration
    JWT_SECRET: zod_1.z.string().default("dev-secret-change-in-production"),
    // Redis Configuration
    REDIS_URL: zod_1.z.string().default("redis://localhost:6379"),
    // Queue Configuration
    QUEUE_NAME: zod_1.z.string().default("notifications"),
    // RabbitMQ Configuration
    RABBITMQ_URL: zod_1.z.string().default("amqp://guest:guest@localhost:5672"),
    RABBITMQ_HOST: zod_1.z.string().optional(),
    RABBITMQ_PORT: zod_1.z.coerce.number().optional(),
    RABBITMQ_USER: zod_1.z.string().optional(),
    RABBITMQ_PASSWORD: zod_1.z.string().optional(),
    RABBITMQ_VHOST: zod_1.z.string().optional(),
    // CORS Configuration
    CORS_ORIGINS: zod_1.z.string().optional().default("http://localhost:8010"),
    // Email Configuration
    EMAIL_PROVIDER: zod_1.z.enum(["smtp", "sendgrid"]).default("smtp"),
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.coerce.number().optional(),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASSWORD: zod_1.z.string().optional(),
    SMTP_FROM: zod_1.z.string().optional(),
    SENDGRID_API_KEY: zod_1.z.string().optional(),
    // Database Logging
    DATABASE_LOG_QUERIES: zod_1.z
        .enum(["true", "false"])
        .optional()
        .default("false"),
});
let config = null;
/**
 * Get validated environment configuration
 * All environment variables are validated using Zod schema
 */
function getConfig() {
    if (!config) {
        const result = EnvSchema.safeParse(process.env);
        if (!result.success) {
            const errors = result.error.errors
                .map((err) => {
                const path = err.path.join(".");
                return `  ${path}: ${err.message}`;
            })
                .join("\n");
            throw new Error(`Environment validation failed:\n${errors}`);
        }
        config = result.data;
    }
    return config;
}
function resetConfig() {
    config = null;
}
//# sourceMappingURL=index.js.map