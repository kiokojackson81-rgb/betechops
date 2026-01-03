import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';

async function main() {
  const userId = process.argv[2] || 'cmimxqfnr0005v5mc05nwhg9o';
  const reports = await prisma.dailyReport.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 100,
    select: { id: true, date: true, commissionEarned: true, tasks: true },
  });

  console.log('Found', reports.length, 'reports for', userId);
  for (const r of reports) {
    console.log(r.date?.toISOString(), 'commissionEarned=', r.commissionEarned, 'id=', r.id);
  }

  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().catch(()=>{}); process.exit(1); });
