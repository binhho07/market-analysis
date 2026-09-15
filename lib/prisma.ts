import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Handle connection errors gracefully (Neon free tier sleeps)
prisma.$connect().catch((err) => {
  console.warn("⚠️ Database connection warning:", err.message);
  console.log("💤 Database may be sleeping (Neon free tier). It will wake up on first query.");
});



