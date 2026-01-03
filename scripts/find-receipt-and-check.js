const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const search = '%Betech-20251221-32841%';
  const rows = await prisma.$queryRaw`SELECT id, data FROM "Receipt" WHERE data::text ILIKE ${search} LIMIT 1`;
  if (!rows || rows.length === 0) {
    console.log('no-receipt-found');
    await prisma.$disconnect();
    return;
  }
  const id = rows[0].id;
  console.log('found-receipt-id', id);
  // fetch print preview HTML
  const url = `https://ops.betech.co.ke/receipts/print/${id}`;
  console.log('fetching', url);
  try {
    const res = await fetch(url);
    const text = await res.text();
    const snippet = text.slice(0, 4000);
    console.log('html-snippet:\n', snippet.match(/(.|\n){1,4000}/)[0]);
    const hasLetterhead = /https?:\/\/.*vercel-storage.*letterhead/i.test(text);
    const hasFooter = /Thank you for shopping with Betech Solar Solutions/i.test(text);
    console.log('hasLetterhead', hasLetterhead, 'hasFooter', hasFooter);
  } catch (e) {
    console.error('fetch-error', e.message);
  }
  await prisma.$disconnect();
}

main().catch(e=>{console.error(e); process.exit(1)});
