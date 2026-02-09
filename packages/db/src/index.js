"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDbConnection = exports.verifyDbConnection = exports.dbConfig = exports.db = void 0;
const client_1 = require("@prisma/client");
const globalForPrisma = globalThis;
/**
 * Instantiate Prisma Client with proper configuration
 * - Singleton pattern prevents connection pool exhaustion
 * - Connection pooling configured via DATABASE_URL (connection_limit, statement_cache_size, connect_timeout)
 * - Logging configured based on NODE_ENV
 */
exports.db = globalForPrisma.prisma ||
    new client_1.PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
/**
 * Store singleton instance for hot module reloading in development
 */
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = exports.db;
}
/**
 * Graceful shutdown on process exit
 */
process.on("exit", async () => {
    await exports.db.$disconnect();
});
process.on("SIGINT", async () => {
    await exports.db.$disconnect();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await exports.db.$disconnect();
    process.exit(0);
});
var config_1 = require("./config");
Object.defineProperty(exports, "dbConfig", { enumerable: true, get: function () { return config_1.dbConfig; } });
var verify_1 = require("./verify");
Object.defineProperty(exports, "verifyDbConnection", { enumerable: true, get: function () { return verify_1.verifyDbConnection; } });
Object.defineProperty(exports, "closeDbConnection", { enumerable: true, get: function () { return verify_1.closeDbConnection; } });
//# sourceMappingURL=index.js.map