import * as dotenv from "dotenv";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const prisma = new PrismaClient();

async function verifyPrisma() {
  console.log("🔍 Checking Prisma client...\n");
  
  // Check if searchHistory exists on the Prisma client
  console.log("Available models:", Object.keys(prisma).filter(key => !key.startsWith('$') && !key.startsWith('_')));
  
  console.log("\nChecking searchHistory model...");
  if ('searchHistory' in prisma) {
    console.log("✅ searchHistory model EXISTS on Prisma client");
    
    try {
      const count = await (prisma as any).searchHistory.count();
      console.log(`✅ Can query searchHistory table, found ${count} records`);
    } catch (error: any) {
      console.error("❌ Error querying searchHistory:", error.message);
    }
  } else {
    console.log("❌ searchHistory model DOES NOT EXIST on Prisma client!");
    console.log("   This means Prisma client needs to be regenerated.");
  }
  
  await prisma.$disconnect();
}

verifyPrisma().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

