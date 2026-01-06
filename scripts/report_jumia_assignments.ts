#!/usr/bin/env ts-node
import { PrismaClient } from "@prisma/client";
import fs from "fs";
const prisma = new PrismaClient();

async function main() {
  const rows: any[] = [];
  const accounts: Array<any> = await prisma.$queryRawUnsafe(
    `SELECT id, "displayName", "jumiaShopSid", "isActive" FROM "MarketplaceAccount" WHERE platform = 'JUMIA' ORDER BY "displayName";`
  );

  for (const a of accounts) {
    const assigns: Array<any> = await prisma.$queryRawUnsafe(
      `SELECT maa.id, maa."attendantId", maa.role, maa."startsAt", maa."endsAt", u.name, u.email FROM "MarketplaceAccountAssignment" maa LEFT JOIN "User" u ON u.id = maa."attendantId" WHERE maa."accountId" = $1 ORDER BY maa."startsAt" DESC;`,
      a.id,
    );
    rows.push({ accountId: a.id, displayName: a.displayName, jumiaShopSid: a.jumiaShopSid, isActive: a.isActive, assignments: assigns });
  }

  const out = { generatedAt: new Date().toISOString(), accounts: rows };
  fs.writeFileSync('.tmp/jumia_assignments_report.json', JSON.stringify(out, null, 2));
  console.log('Wrote .tmp/jumia_assignments_report.json');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
