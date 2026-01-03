const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const fs = require('fs');
(async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    const orderNumber = 'Betech-20251221-92606';
    const rows = await prisma.$queryRaw`
      SELECT id FROM "Receipt" WHERE data::text ILIKE ${`%${orderNumber}%`} LIMIT 1
    `;
    if (!rows || rows.length === 0) { console.log('receipt not found'); await prisma.$disconnect(); return; }
    const id = rows[0].id;
    console.log('found id', id);
    const url = `https://ops.betech.co.ke/api/receipts/${id}/pdf`;
    const res = await fetch(url);
    console.log('status', res.status, 'content-type', res.headers.get('content-type'));
    if (!res.ok) { console.log('failed', await res.text()); await prisma.$disconnect(); return; }
    const buf = Buffer.from(await res.arrayBuffer());
    const out = 'tmp/receipt_92606.pdf';
    fs.mkdirSync('tmp', { recursive: true });
    fs.writeFileSync(out, buf);
    console.log('wrote', out, 'size', buf.length);
    const text = buf.toString('latin1');
    console.log('has letterhead url?', text.includes('vercel-storage.com'));
    console.log('has new footer?', text.includes('Thank you for choosing Betech Solar Solutions') || text.includes('Connect With Us'));
  } catch (e) { console.error(e); }
  finally { await prisma.$disconnect(); }
})();
