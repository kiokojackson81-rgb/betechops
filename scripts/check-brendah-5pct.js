const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMAIL = process.argv[2] || 'brendah@betech.co.ke';

(async () => {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error('User not found:', EMAIL);
    process.exit(1);
  }

  const earnings = await prisma.commissionEarning.findMany({
    where: { staffId: user.id },
    include: { orderItem: { include: { order: true } } },
  });

  const rows = [];
  for (const e of earnings) {
    const order = e.orderItem && e.orderItem.order ? e.orderItem.order : null;
    const total = order && order.totalAmount != null ? Number(order.totalAmount) : null;
    if (total != null && total < 500000) {
      const calc = e.calcDetail || null;
      let profit = null;
      if (calc && typeof calc === 'object') {
        if (calc.profit !== undefined) profit = Number(calc.profit);
        if (calc.totalProfit !== undefined) profit = Number(calc.totalProfit);
      }
      const expected = profit != null ? Math.round(profit * 0.05) : null;
      const match = expected != null ? Number(e.amount) === expected : null;

      rows.push({
        earningId: e.id,
        orderId: order ? order.id : null,
        orderNumber: order ? order.orderNumber : null,
        orderTotal: total,
        earningAmount: Number(e.amount),
        calcDetail: calc,
        profitDerived: profit,
        expected5pct: expected,
        matches5pct: match,
      });
    }
  }

  console.log(JSON.stringify({ user: { id: user.id, email: EMAIL }, totalMatches: rows.length, rows }, null, 2));
  await prisma.$disconnect();
})();
