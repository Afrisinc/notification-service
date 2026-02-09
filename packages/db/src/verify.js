"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyDbConnection = verifyDbConnection;
exports.closeDbConnection = closeDbConnection;
const client_1 = require("@prisma/client");
const config_1 = require("./config");
/**
 * Verify database connections
 * Tests both single connection and read/write separation if configured
 */
async function verifyDbConnection() {
    const prisma = new client_1.PrismaClient({
        datasources: {
            db: {
                url: config_1.dbConfig.databaseUrl,
            },
        },
    });
    try {
        console.log(`🔄 Testing database connection on ${config_1.dbConfig.nodeEnv} environment...`);
        // Test basic connection
        await prisma.$connect();
        console.log("✅ Database connection established successfully");
        // Test with a simple query
        const result = await prisma.$queryRaw `SELECT 1 as connected`;
        console.log("✅ Database query executed successfully");
        console.log("Query result:", result);
        return true;
    }
    catch (err) {
        console.error("❌ Database connection failed!");
        console.error("Error:", err instanceof Error ? err.message : err);
        return false;
    }
    finally {
        await prisma.$disconnect();
    }
}
/**
 * Close database connections safely
 */
async function closeDbConnection(prisma) {
    try {
        await prisma.$disconnect();
        console.log("✅ Database connection closed successfully");
    }
    catch (error) {
        console.error("❌ Error closing database connection:", error);
    }
}
//# sourceMappingURL=verify.js.map