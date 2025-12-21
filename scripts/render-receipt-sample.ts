import fs from 'fs';
import path from 'path';
import renderReceiptTemplate from '../src/app/templates/receiptTemplate.tsx';

(async function main(){
  const snapshot: any = {
    generatedAt: new Date().toISOString(),
    order: { orderNumber: 'Betech-20251214-38608', customerName: 'Test Customer', customerPhone: '0705663175' },
    items: [{ title: '1', quantity: 1, unitPrice: 0 }],
    totals: { subtotal: 0, total: 0 },
    notes: 'Sample notes for testing.',
    attendantName: 'Jeniffer',
    paymentMethod: 'MPESA',
    deliveryAddress: 'Plot 123, Test Rd, Nairobi'
  };

  const branding = {
    letterheadUrl: process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL,
    logoUrl: process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL,
    brandColor: '#7A2020',
  };
  const html = renderReceiptTemplate({ ...snapshot, branding }, {} as any);
  const outdir = path.resolve(process.cwd(), 'tmp');
  if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });
  const out = path.join(outdir, 'receipt-preview.html');
  fs.writeFileSync(out, html, 'utf8');
  console.log('WROTE', out);
})();
