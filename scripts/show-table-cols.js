const { PrismaClient } = require('@prisma/client');
(async function(){
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const tables = ['MarketingReceipt','MarketingSale','DailySale','SupportSale','WeeklySale','DailyReport'];
  try {
    for (const t of tables) {
      try {
        const cols = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='${t}'`);
        console.log('\n', t, 'columns:', cols.map(c=>c.column_name));
      } catch (e) {
        console.warn('Table', t, 'error:', e && e.message ? e.message : e);
      }
    }
  } catch (e) {
    console.error(e);
  } finally { await prisma.$disconnect(); }
})();
