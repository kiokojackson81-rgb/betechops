const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(email){
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error('user not found', email); process.exit(1); }

  const now = new Date();
  const period = await prisma.commissionPeriod.findFirst({ where: { startDate: { lte: now }, endDate: { gte: now } } });
  if (!period) { console.error('no active commission period found'); process.exit(1); }

  const totalsAgg = await prisma.supportDailyEntry.aggregate({
    where: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } },
    _sum: { totalSales: true, totalProfit: true },
  });

  const receiptsAgg = await prisma.supportReceipt.aggregate({
    where: { dailyEntry: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } } },
    _count: { id: true },
    _sum: { sellingTotal: true },
  });

  const ledger = await prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.startDate, periodEnd: period.endDate } } });

  const result = {
    user: { id: user.id, email },
    period: { id: period.id, name: period.name, startDate: period.startDate, endDate: period.endDate },
    totals: { totalSales: Number(totalsAgg._sum.totalSales ?? 0), totalProfit: Number(totalsAgg._sum.totalProfit ?? 0) },
    receipts: { count: Number(receiptsAgg._count.id ?? 0), sellingTotal: Number(receiptsAgg._sum.sellingTotal ?? 0) },
    commissionLedger: ledger ? { id: ledger.id, grossCommission: String(ledger.grossCommission), netCommission: String(ledger.netCommission), commissionDirect: ledger.commissionDirect ? String(ledger.commissionDirect) : null, detail: ledger.detail } : null,
  };

  console.log(JSON.stringify(result, null, 2));
}

const EMAIL = process.argv[2] || 'brendah@betech.co.ke';
main(EMAIL).then(()=>prisma.$disconnect()).catch((e)=>{ console.error(e); prisma.$disconnect(); process.exit(1); });
