import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';

async function main() {
  const userId = process.argv[2] || 'cmimxqfnr0005v5mc05nwhg9o';
  const rows = await prisma.commissionLedger.findMany({ where: { userId }, orderBy: { periodStart: 'desc' } });
  console.log('Found', rows.length, 'commission ledger rows for', userId);
  for (const r of rows) {
    console.log(r.id, r.periodStart?.toISOString(), '->', r.periodEnd?.toISOString(), 'gross', r.grossCommission, 'net', r.netCommission, 'commissionTotal', r.commissionTotal);
  }
  await prisma.$disconnect();
}

main().catch(e=>{ console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
