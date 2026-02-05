import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const startArg = process.argv[2] || '2025-12-29';
  const endArg = process.argv[3] || '2026-01-04';
  const start = new Date(startArg + 'T00:00:00');
  const end = new Date(endArg + 'T23:59:59.999');
  console.log('Querying payout weeks overlapping:', start.toISOString().slice(0,10), '->', end.toISOString().slice(0,10));
  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: { AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] },
    orderBy: { accountId: 'asc' },
  });
  console.log('Found', rows.length, 'rows');
  for (const r of rows) {
    console.log('---');
    console.log('id:', r.id);
    console.log('accountId:', r.accountId);
    console.log('statementNumber:', r.statementNumber);
    console.log('payoutAmount:', r.payoutAmount);
    console.log('grossSales:', r.grossSales);
    console.log('weekStart:', r.weekStart);
    console.log('weekEnd:', r.weekEnd);
    console.log('rawPayload.shopSid:', (r.rawPayload as any)?.shopSid ?? null);
    console.log('rawPayload.name:', (r.rawPayload as any)?.name ?? null);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
