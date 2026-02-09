import { db } from "./src/index";

async function testConnection() {
  try {
    console.log("Testing database connection...");
    const result = await db.$queryRaw`SELECT 1 as connected`;
    console.log("✅ Database connection successful!");
    console.log("Query result:", result);
    await db.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Database connection failed!");
    console.error("Error:", error);
    process.exit(1);
  }
}

testConnection();
