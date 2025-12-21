const { PrismaClient } = require('@prisma/client');
(async function(){
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const b = await prisma.branding.findUnique({ where: { name: 'default' } });
  console.log(b);
  await prisma.$disconnect();
})();
