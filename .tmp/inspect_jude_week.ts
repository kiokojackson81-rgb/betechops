import fs from 'fs';

function parseDateOrExit(s: string | undefined, name: string): Date {
  if (!s) { console.error(`Missing ${name}`); process.exit(2); }
  const d = new Date(s); if (isNaN(d.getTime())) { console.error(`Invalid ${name}: ${s}`); process.exit(2); }
  return d;
}

async function main() {
  const accountId = process.argv[2] ?? '3ad790b3-e827-49e2-b1a1-4fb978c9b577';
  const start = parseDateOrExit(process.argv[3] ?? '2025-12-29', 'start');
  const end = parseDateOrExit(process.argv[4] ?? '2026-01-04', 'end');

  const { prisma } = await import('../src/lib/prisma.ts');

  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { accountId, AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] }, orderBy: [{ weekStart: 'asc' }, { createdAt: 'asc' }] });

  const account = await prisma.marketplaceAccount.findUnique({ where: { id: accountId } });
  const shop = account?.jumiaShopSid ? await prisma.shop.findFirst({ where: { jumiaShopSid: account.jumiaShopSid } }) : null;
  const weeklySales = shop ? await prisma.weeklySale.findMany({ where: { shopId: shop.id, weekStart: start } }) : [];

  const out = { generatedAt: new Date().toISOString(), accountId, displayName: account?.displayName ?? null, shopId: shop?.id ?? null, rows, weeklySales };
  fs.writeFileSync('.tmp/jude_collection_week_2025-12-29.json', JSON.stringify(out, null, 2));

  console.log(`Wrote .tmp/jude_collection_week_2025-12-29.json — payout rows: ${rows.length}, weeklySales: ${weeklySales.length}`);
  for (const r of rows) console.log(`- id=${r.id} stmt=${r.statementNumber} payout=${Number(r.payoutAmount ?? r.grossSales ?? 0).toFixed(2)} createdAt=${r.createdAt} shopSid=${r.rawPayload?.shopSid ?? null}`);
  for (const w of weeklySales) console.log(`- weeklySale id=${w.id} amount=${Number(w.amount ?? 0).toFixed(2)} status=${w.status}`);

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => { console.error('inspect failed', e); process.exit(1); });
