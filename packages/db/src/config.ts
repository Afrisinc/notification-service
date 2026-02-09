import { getConfig } from "@afrisinc-notify/config";

/**
 * Database configuration
 * Loads configuration from centralized config package
 */
const config = getConfig();

export const dbConfig = {
  databaseUrl: config.DATABASE_URL,
  nodeEnv: config.NODE_ENV,
  logQueries: config.DATABASE_LOG_QUERIES === "true",
};

export type DbConfig = typeof dbConfig;
