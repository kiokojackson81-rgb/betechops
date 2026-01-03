const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(email){
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error('user not found', email); process.exit(1); }

  const now = new Date();
  const period = await prisma.commissionPeriod.findFirst({ where: { startDate: { lte: now }, endDate: { gte: now } } });
  if (!period) { console.error('no active commission period found'); process.exit(1); }

  const receiptsAgg = await prisma.supportReceipt.aggregate({
    where: { dailyEntry: { submittedById: user.id, date: { gte: period.startDate, lte: period.endDate } } },
    _count: { id: true },
    _sum: { sellingTotal: true, buyingTotal: true },
  });

  const selling = Number(receiptsAgg._sum.sellingTotal ?? 0);
  const buying = Number(receiptsAgg._sum.buyingTotal ?? 0);
  const profit = selling - buying;

  console.log(JSON.stringify({ user: { id: user.id, email }, period: { id: period.id, name: period.name }, receipts: { count: Number(receiptsAgg._count.id ?? 0), sellingTotal: selling, buyingTotal: buying, profit } }, null, 2));
}

const EMAIL = process.argv[2] || 'brendah@betech.co.ke';
main(EMAIL).then(()=>prisma.$disconnect()).catch((e)=>{ console.error(e); prisma.$disconnect(); process.exit(1); });
