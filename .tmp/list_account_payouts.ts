import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const acctId = process.argv[2] || 'ff8e0bd3-8b24-40d6-af27-64d55a87c041';
  console.log('Listing payout weeks for account', acctId);
  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { accountId: acctId }, orderBy: { weekStart: 'desc' } });
  console.log('Found', rows.length, 'rows');
  for (const r of rows) {
    console.log('---');
    console.log('id:', r.id);
    console.log('statementNumber:', r.statementNumber);
    console.log('payoutAmount:', r.payoutAmount);
    console.log('grossSales:', r.grossSales);
    console.log('weekStart:', r.weekStart);
    console.log('weekEnd:', r.weekEnd);
    console.log('rawPayload.shopSid:', (r.rawPayload as any)?.shopSid ?? null);
  }
}

main().catch(e=>{console.error(e); process.exit(1)});
