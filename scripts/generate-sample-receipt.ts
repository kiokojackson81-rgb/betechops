import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
// We'll build the HTML directly here to avoid TS import/loader issues.

async function main() {
  const snapshot = {
    generatedAt: Date.now(),
    customerName: 'Jacksonm Kioko',
    order: { orderNumber: 'Betech-20251219-85058' },
    items: [
      { title: 'Full kit', quantity: 1, unitPrice: 15000 },
    ],
    totals: { subtotal: 15000, total: 15000 },
    paymentMethod: 'MPESA',
    attendantName: 'Jacksonm Kioko',
    deliveryAddress: '',
    notes: '',
  } as any;

  const isHttp = (v: any) => typeof v === 'string' && /^https?:\/\//.test(v);
  const envLetterheadUrl = isHttp(process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || '')
    ? process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL
    : '';
  const envLogoUrl = isHttp(process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '')
    ? process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL
    : '';
  const brandColor = '#7A2020';
  const headerImg = isHttp((snapshot as any).branding?.letterheadUrl)
    ? (snapshot as any).branding.letterheadUrl
    : isHttp(envLetterheadUrl)
    ? envLetterheadUrl
    : (snapshot as any).branding?.logoUrl || envLogoUrl || '/logo.png';

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Receipt ${snapshot.order.orderNumber}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
      .page { max-width: 760px; margin: 0 auto; padding: 18px; border:1px solid #cbd5e1; border-radius:8px }
      header { text-align:center; margin-bottom:12px }
      header h1 { margin:0; font-size:28px; letter-spacing:1px }
      header p { margin:2px 0; color:#374151 }
      .meta { display:flex; justify-content:space-between; margin:12px 0 }
      table { width:100%; border-collapse: collapse; margin-top:8px }
      th { text-align:left; padding:8px; border-bottom:2px solid #e5e7eb }
      td { padding:8px }
      .right { text-align:right }
      .totals { width:100%; margin-top:12px }
      .totals td { border:none; padding:6px }
      .notes { margin-top:14px; padding:10px; background:#f8fafc; border-radius:6px }
      .signature { margin-top:20px; text-align:center }
    </style>
  </head>
  <body>
    <div class="page">
      <header style="position:relative;display:flex;align-items:center;justify-content:center;">
        ${headerImg ? `<img src="${headerImg}" alt="branding" style="width:100%;border-radius:8px;margin-bottom:12px;object-fit:cover;" />` : ''}
      </header>

      <div class="meta">
        <div>
          <div><strong>Date:</strong> ${new Date(snapshot.generatedAt).toLocaleString()}</div>
          <div><strong>M/S:</strong> ${snapshot.customerName}</div>
        </div>
        <div class="right">
          <div><strong>Receipt No.</strong> ${snapshot.order.orderNumber}</div>
          <div style="margin-top:6px"><strong>Address :</strong> ${snapshot.deliveryAddress || '-'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>Qty</th><th>Particulars</th><th class="right">@ (Ksh)</th><th class="right">Kshs.</th></tr>
        </thead>
        <tbody>
          ${snapshot.items.map((it: any) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${it.quantity}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd">${it.title}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${it.unitPrice}</td>
              <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${it.quantity * it.unitPrice}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <table class="totals">
        <tr><td></td><td class="right">Subtotal:</td><td class="right">${snapshot.totals.subtotal}</td></tr>
        <tr><td></td><td class="right"><strong>Total:</strong></td><td class="right"><strong>${snapshot.totals.total}</strong></td></tr>
      </table>

      <div style="margin-top:10px">
        <div><strong>Payment method:</strong> ${snapshot.paymentMethod}</div>
      </div>

      <div class="signature">
        <p>Thank you for shopping with Betech Solar Solutions. You were served by ${snapshot.attendantName}.</p>
        <p>Goods once sold cannot be refunded.</p>
        <div style="margin-top:18px">______________________________</div>
      </div>

      <div style="margin-top:18px;border-top:1px dashed #e5e7eb;padding-top:12px;font-size:13px;color:#111827">
        <div style="font-weight:700;margin-bottom:6px">📲 Connect With Us & Share Your Feedback</div>
        <div style="margin-bottom:8px">Follow, search, and review us on social media:</div>
        <div style="line-height:1.6">
          <div>🔵 Facebook:  Betech Solar Solutions Kenya</div>
          <div>📸 Instagram: Betech Solar Solutions Kenya</div>
          <div>🎵 TikTok:    Betech Solar Solutions Kenya</div>
        </div>
        <div style="margin-top:10px;color:#374151">Your feedback helps us serve you better</div>
      </div>

    </div>
  </body>
  </html>`;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outDir = path.resolve(__dirname, '..', 'tmp');
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch {}
  const htmlPath = path.join(outDir, 'receipt-sample.html');
  const pdfPath = path.join(outDir, 'receipt-sample.pdf');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Wrote HTML to', htmlPath);

  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log('Wrote PDF to', pdfPath);
    await browser.close();
  } catch (err) {
    console.error('PDF generation failed, check Puppeteer/Chromium availability:', err);
    console.log('HTML saved; open it in a browser to preview.');
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error('Unexpected error', e);
  process.exit(1);
});
