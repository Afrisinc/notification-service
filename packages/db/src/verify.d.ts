import { PrismaClient } from "@prisma/client";
/**
 * Verify database connections
 * Tests both single connection and read/write separation if configured
 */
export declare function verifyDbConnection(): Promise<boolean>;
/**
 * Close database connections safely
 */
export declare function closeDbConnection(prisma: PrismaClient): Promise<void>;
//# sourceMappingURL=verify.d.ts.map