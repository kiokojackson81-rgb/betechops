const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
(async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    const search = '%Betech-20251221-55624%';
    const rows = await prisma.$queryRaw`SELECT id, data FROM "Receipt" WHERE data::text ILIKE ${search} LIMIT 1`;
    if (!rows || rows.length === 0) {
      console.log('receipt not found');
      return;
    }
    const id = rows[0].id;
    console.log('found id', id);
    const url = `https://ops.betech.co.ke/api/receipts/${id}/pdf`;
    console.log('fetching', url);
    const res = await fetch(url);
    console.log('status', res.status, 'content-type', res.headers.get('content-type'));
    if (!res.ok) {
      console.log('failed to fetch pdf:', await res.text());
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const out = 'tmp/receipt_55624.pdf';
    require('fs').writeFileSync(out, buf);
    console.log('wrote', out, 'size', buf.length);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
