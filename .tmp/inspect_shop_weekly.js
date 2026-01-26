require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async ()=>{
  const shopId = 'cmk8bj6oo0000v5a467qzc7q2';
  const rows = await prisma.weeklySale.findMany({ where: { shopId } });
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
})().catch(e=>{ console.error(e); process.exit(1); });
