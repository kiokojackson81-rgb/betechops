const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    await p.$connect();
    const res = await p.$queryRawUnsafe("select tablename from pg_tables where schemaname='public' and tablename ilike 'shop%';");
    console.log('tables:', res);
  } catch (e) {
    console.error('err', e.message || e);
  } finally {
    try { await p.$disconnect(); } catch(_){}
  }
})();
