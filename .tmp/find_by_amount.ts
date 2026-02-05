import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const low = Number(process.argv[2] || '424000');
  const high = Number(process.argv[3] || '424200');
  console.log('Searching for payout/gross in range', low, '-', high);
  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { OR: [ { payoutAmount: { gte: low, lte: high } }, { grossSales: { gte: low, lte: high } } ] } });
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
