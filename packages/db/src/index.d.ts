import { PrismaClient } from "@prisma/client";
/**
 * Instantiate Prisma Client with proper configuration
 * - Singleton pattern prevents connection pool exhaustion
 * - Connection pooling configured via DATABASE_URL (connection_limit, statement_cache_size, connect_timeout)
 * - Logging configured based on NODE_ENV
 */
export declare const db: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export type { Prisma, PrismaClient } from "@prisma/client";
export { dbConfig } from "./config";
export { verifyDbConnection, closeDbConnection } from "./verify";
//# sourceMappingURL=index.d.ts.map