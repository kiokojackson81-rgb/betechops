const { PrismaClient } = require('@prisma/client');
const { zonedTimeToUtc, } = require('date-fns-tz');
const { addDays } = require('date-fns');
const prisma = new PrismaClient();

async function main() {
  const WINDOW_DAYS = Number(process.argv[2] || 30);
  const DEFAULT_TIMEZONE = 'Africa/Nairobi';
  const now = new Date();
  const windowStart = zonedTimeToUtc(addDays(now, -WINDOW_DAYS), DEFAULT_TIMEZONE);

  const shops = await prisma.jumiaShop.findMany({ select: { id: true, name: true } });
  console.log(`Counting pending Jumia orders per shop (windowDays=${WINDOW_DAYS}) from ${windowStart.toISOString()} -> ${now.toISOString()}`);

  for (const sh of shops) {
    const count = await prisma.jumiaOrder.count({
      where: {
        shopId: sh.id,
        status: { in: ['PENDING'] },
        OR: [
          { updatedAtJumia: { gte: windowStart } },
          { createdAtJumia: { gte: windowStart } },
          { AND: [{ updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: { gte: windowStart } }] },
        ],
      },
    });
    if (count > 0) console.log(`- ${sh.name} (${sh.id}): ${count}`);
  }
  const total = await prisma.jumiaOrder.count({ where: { status: { in: ['PENDING'] }, OR: [ { updatedAtJumia: { gte: windowStart } }, { createdAtJumia: { gte: windowStart } }, { AND: [{ updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: { gte: windowStart } }] } ] } });
  console.log(`Total pending orders (DB count using same window): ${total}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => require('@prisma/client').PrismaClient.prototype.$disconnect && process.exit());
