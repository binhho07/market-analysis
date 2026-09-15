import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const prisma = new PrismaClient();

async function checkHistory() {
  console.log("🔍 Checking SearchHistory table...\n");

  // Get all records
  const allHistory = await prisma.searchHistory.findMany({
    include: {
      snapshots: true,
    },
    orderBy: {
      searchDate: "desc",
    },
  });

  console.log(`📊 Total records in database: ${allHistory.length}\n`);

  if (allHistory.length > 0) {
    console.log("📋 Most recent searches:\n");
    allHistory.slice(0, 3).forEach((record, index) => {
      console.log(`${index + 1}. ${record.searchAddress}`);
      console.log(`   Date: ${record.searchDate}`);
      console.log(`   Location: ${record.latitude}, ${record.longitude}`);
      console.log(`   Competitors: ${record.competitorCount}`);
      console.log(`   Snapshots: ${record.snapshots.length}`);
      console.log("");
    });
  } else {
    console.log("❌ No records found in database!");
  }

  await prisma.$disconnect();
}

checkHistory().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

