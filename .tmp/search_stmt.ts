import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const q = process.argv[2] || '251229';
  console.log('Searching statementNumber containing', q);
  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { statementNumber: { contains: q } }, orderBy: { weekStart: 'desc' } });
  console.log('Found', rows.length, 'rows');
  for (const r of rows) {
    console.log('---');
    console.log('id:', r.id);
    console.log('accountId:', r.accountId);
    console.log('statementNumber:', r.statementNumber);
    console.log('payoutAmount:', r.payoutAmount);
    console.log('grossSales:', r.grossSales);
    console.log('weekStart:', r.weekStart);
    console.log('rawPayload.shopSid:', (r.rawPayload as any)?.shopSid ?? null);
  }
}

main().catch(e=>{ console.error(e); process.exit(1)});
