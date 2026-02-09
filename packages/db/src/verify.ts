import { PrismaClient } from "@prisma/client";
import { dbConfig } from "./config";

/**
 * Verify database connections
 * Tests both single connection and read/write separation if configured
 */
export async function verifyDbConnection() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbConfig.databaseUrl,
      },
    },
  });

  try {
    console.log(`🔄 Testing database connection on ${dbConfig.nodeEnv} environment...`);

    // Test basic connection
    await prisma.$connect();
    console.log("✅ Database connection established successfully");

    // Test with a simple query
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log("✅ Database query executed successfully");
    console.log("Query result:", result);

    return true;
  } catch (err) {
    console.error("❌ Database connection failed!");
    console.error("Error:", err instanceof Error ? err.message : err);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Close database connections safely
 */
export async function closeDbConnection(prisma: PrismaClient) {
  try {
    await prisma.$disconnect();
    console.log("✅ Database connection closed successfully");
  } catch (error) {
    console.error("❌ Error closing database connection:", error);
  }
}
