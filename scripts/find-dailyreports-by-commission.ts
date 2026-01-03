import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';

async function main() {
  const amount = Number(process.argv[2] ?? 325);
  const rows = await prisma.dailyReport.findMany({ where: { commissionEarned: amount }, select: { id: true, userId: true, date: true } });
  console.log('Found', rows.length, 'rows with commissionEarned=', amount);
  for (const r of rows) console.log(r.id, r.userId, r.date?.toISOString());
  await prisma.$disconnect();
}

main().catch(e=>{ console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
