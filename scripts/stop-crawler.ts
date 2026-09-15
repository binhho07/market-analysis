#!/usr/bin/env ts-node

/**
 * Stop script for the competitor crawler system
 */

import { cronManager } from "../lib/crawler/cron-manager";

async function main() {
  console.log("🛑 Stopping Spa Atlas Competitor Crawler System");
  console.log("=" .repeat(50));

  try {
    // Stop all cron jobs
    console.log("⏹️ Stopping automated cron jobs...");
    cronManager.stopAll();
    
    console.log("✅ Crawler system stopped successfully");
    console.log();
    console.log("📋 All scheduled crawls have been stopped:");
    console.log("   • Daily crawl");
    console.log("   • Weekly deep crawl");
    console.log("   • Hourly monitoring");
    console.log();
    console.log("🔄 To restart the system, run: npm run crawler:start");

  } catch (error) {
    console.error("❌ Failed to stop crawler system:", error);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});



