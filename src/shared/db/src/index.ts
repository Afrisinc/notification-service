import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Instantiate Prisma Client with proper configuration
 * - Singleton pattern prevents connection pool exhaustion
 * - Connection pooling configured via DATABASE_URL (connection_limit, statement_cache_size, connect_timeout)
 * - Logging configured based on NODE_ENV
 */
export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

/**
 * Store singleton instance for hot module reloading in development
 */
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/**
 * Graceful shutdown on process exit
 */
process.on("exit", async () => {
  await db.$disconnect();
});

process.on("SIGINT", async () => {
  await db.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await db.$disconnect();
  process.exit(0);
});

export type { Prisma, PrismaClient } from "@prisma/client";
export { dbConfig } from "./config";
export { verifyDbConnection, closeDbConnection } from "./verify";
