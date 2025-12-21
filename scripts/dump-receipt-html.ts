import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma.ts';
import renderReceiptTemplate from '../src/app/templates/receiptTemplate.tsx';
import { getBranding } from '../src/lib/branding.ts';

async function main() {
  const id = process.argv[2] || 'Betech-20251221-37008';
  const receipt = await prisma.receipt.findUnique({ where: { id }, include: { order: { include: { items: true, attendant: true } }, issuedBy: true } });
  if (!receipt) {
    console.error('Receipt not found', id);
    process.exit(2);
  }
  const snapshot: any =
    typeof receipt.data === 'object' && receipt.data
      ? { ...(receipt.data as Record<string, unknown>) }
      : { order: receipt.order, totals: receipt.totals };
  snapshot.generatedAt = new Date().toISOString();
  const branding = await getBranding();
  snapshot.branding = branding;
  const brandedSnapshot = { ...snapshot, branding };
  if (!snapshot.attendantName) snapshot.attendantName = receipt.order?.attendant?.name ?? receipt.issuedBy?.name;

  const html = renderReceiptTemplate(brandedSnapshot, { hideStamp: false } as any);
  const outdir = path.resolve(process.cwd(), 'tmp');
  if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });
  const out = path.join(outdir, `${id}.html`);
  fs.writeFileSync(out, html, 'utf8');
  console.log('WROTE', out);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
