/**
 * Database Connection Verification Script
 * Tests if the database is properly connected and accessible
 *
 * Usage: npx tsx test-db-connection.ts
 */

import { verifyDbConnection } from "./src/verify";

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  🔍 Database Connection Verification");
  console.log("═══════════════════════════════════════════════════\n");

  const isConnected = await verifyDbConnection();

  console.log("\n═══════════════════════════════════════════════════");
  if (isConnected) {
    console.log("  ✅ Database connection verified successfully!");
    console.log("═══════════════════════════════════════════════════");
    process.exit(0);
  } else {
    console.log("  ❌ Database connection verification failed!");
    console.log("═══════════════════════════════════════════════════");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
