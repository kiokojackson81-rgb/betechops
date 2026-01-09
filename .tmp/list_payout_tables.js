const { prisma } = require('../.worker-dist/src/lib/prisma');
(async ()=>{
  try{
    const res = await prisma.$queryRawUnsafe("select schemaname, tablename from pg_tables where tablename ilike '%payout%';");
    console.log(res);
  }catch(e){ console.error(e); } finally { await prisma.$disconnect(); }
})();
