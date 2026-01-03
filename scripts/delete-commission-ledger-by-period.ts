import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';

async function main() {
  const userId = process.argv[2];
  const startStr = process.argv[3];
  const endStr = process.argv[4];
  if (!userId || !startStr || !endStr) {
    console.error('Usage: ts-node scripts/delete-commission-ledger-by-period.ts <USER_ID> <START_ISO_DATE> <END_ISO_DATE>');
    process.exit(1);
  }

  const start = new Date(startStr);
  const end = new Date(endStr);

  const result = await prisma.commissionLedger.deleteMany({ where: { userId, periodStart: start, periodEnd: end } });
  console.log('Deleted commission ledger rows:', result.count);
  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
