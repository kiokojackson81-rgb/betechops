import "dotenv/config";
import { prisma } from "../src/lib/prisma.ts";

const statements = [
  `ALTER TABLE "DailyReport" ADD COLUMN IF NOT EXISTS "submittedBy" TEXT`,
  `ALTER TABLE "DailyReport" ADD COLUMN IF NOT EXISTS "newProducts" INTEGER DEFAULT 0`,
  `ALTER TABLE "DailyReport" ADD COLUMN IF NOT EXISTS "productsEdited" INTEGER DEFAULT 0`,
  `ALTER TABLE "DailyReport" ADD COLUMN IF NOT EXISTS "copiesUploaded" INTEGER DEFAULT 0`,
  `ALTER TABLE "DailyReport" ADD COLUMN IF NOT EXISTS "walkInServed" INTEGER DEFAULT 0`,
  `ALTER TABLE "DailyReport" ADD COLUMN IF NOT EXISTS "purchasesMade" INTEGER DEFAULT 0`,
  `ALTER TABLE "DailyReport" ADD COLUMN IF NOT EXISTS "liveSessionsCount" INTEGER DEFAULT 0`,
  `ALTER TABLE "DailyReport" ADD COLUMN IF NOT EXISTS "commissionEarned" DECIMAL(12,2)`,
  `ALTER TABLE "DailyReport" ADD COLUMN IF NOT EXISTS "confirmedCompetitiveness" BOOLEAN DEFAULT false`,
  `ALTER TABLE "DailyReport" ADD COLUMN IF NOT EXISTS "marketEngagement" JSONB`,
  `ALTER TABLE "DailyReport" ADD COLUMN IF NOT EXISTS "concerns" TEXT`,
];

async function main() {
  for (const sql of statements) {
    console.log(`[columns] Executing: ${sql}`);
    await prisma.$executeRawUnsafe(sql);
  }
  await prisma.$disconnect();
  console.log("[columns] Done.");
}

main().catch((err) => {
  console.error("[columns] Failed", err);
  prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
