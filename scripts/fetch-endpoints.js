const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const fs = require('fs');

const ORDER_NUMBERS = [
  'Betech-20251221-05155',
  'Betech-20251221-92606',
  'Betech-20251221-55624',
];

async function fetchUrlToBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

(async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    for (const orderNumber of ORDER_NUMBERS) {
      console.log('\n---');
      console.log('Order:', orderNumber);
      const rows = await prisma.$queryRaw`
        SELECT id FROM "Receipt" WHERE data::text ILIKE ${`%${orderNumber}%`} LIMIT 1
      `;
      if (!rows || rows.length === 0) {
        console.log('receipt not found for', orderNumber);
        continue;
      }
      const id = rows[0].id;
      console.log('found receipt id', id);

      // debug HTML
      const debugUrl = `https://ops.betech.co.ke/api/debug/receipt-branding?id=${id}`;
      try {
        const htmlBuf = await fetchUrlToBuffer(debugUrl);
        const html = htmlBuf.toString('utf8');
        const hasLetterhead = /https?:\/\/.*vercel-storage\.com.*letterhead/i.test(html);
        const hasFooter = /Thank you for choosing Betech Solar Solutions|Connect With Us/i.test(html);
        console.log('debug html: ok, hasLetterhead=', hasLetterhead, 'hasFooter=', hasFooter);
        fs.writeFileSync(`tmp/debug_${id}.html`, html);
      } catch (e) {
        console.error('debug fetch failed', e.message);
      }

      // server PDF
      const pdfUrl = `https://ops.betech.co.ke/api/receipts/${id}/pdf`;
      try {
        const pdfBuf = await fetchUrlToBuffer(pdfUrl);
        fs.writeFileSync(`tmp/pdf_${id}.pdf`, pdfBuf);
        const text = pdfBuf.toString('latin1');
        const hasLetterhead = text.includes('vercel-storage.com');
        const hasFooter = text.includes('Thank you for choosing Betech Solar Solutions') || text.includes('Connect With Us');
        console.log('server pdf: wrote tmp/pdf_' + id + '.pdf size=' + pdfBuf.length + ', hasLetterhead=' + hasLetterhead + ', hasFooter=' + hasFooter);
      } catch (e) {
        console.error('pdf fetch failed', e.message);
      }

      // ReceiptFile blob urls
      const files = await prisma.receiptFile.findMany({ where: { receiptId: id }, orderBy: { id: 'desc' } });
      if (!files || files.length === 0) {
        console.log('no ReceiptFile rows for', id);
      } else {
        for (const f of files) {
          console.log('ReceiptFile:', f.kind, f.url);
          if (f.url && f.url.startsWith('http')) {
            try {
              const b = await fetchUrlToBuffer(f.url);
              const containsLetterhead = b.toString('latin1').includes('vercel-storage.com');
              const containsFooter = b.toString('latin1').includes('Thank you for choosing Betech Solar Solutions') || b.toString('latin1').includes('Connect With Us');
              console.log('  blob fetch ok size=' + b.length + ', hasLetterhead=' + containsLetterhead + ', hasFooter=' + containsFooter);
              fs.writeFileSync(`tmp/blob_${id}_${f.kind}.pdf`, b);
            } catch (e) {
              console.error('  blob fetch failed', e.message);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
