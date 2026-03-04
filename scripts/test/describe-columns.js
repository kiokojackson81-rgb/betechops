const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function describe(table){
  try{
    const rows = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name = ${table}`;
    console.log(`\nTable: ${table}`);
    if(!rows || !rows.length) console.log('  (no columns)');
    else rows.forEach(r=> console.log('  ', r.column_name, r.data_type));
  }catch(e){
    console.error(`error describing ${table}`, e.message || e);
  }
}

(async ()=>{
  try{
    const tables = ['Product', 'Order', 'Receipt', 'OrderItem', 'OrderCost', 'ProfitSnapshot'];
    for(const t of tables){
      await describe(t.toLowerCase());
      await describe(t);
    }
  }finally{ await prisma.$disconnect(); }
})();
