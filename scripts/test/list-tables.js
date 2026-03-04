const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async ()=>{
  try{
    const rows = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`;
    console.log('tables:', rows.map(r=>r.table_name || r.TABLE_NAME));
  }catch(e){
    console.error('error listing tables', e);
  }finally{ await prisma.$disconnect(); }
})();
