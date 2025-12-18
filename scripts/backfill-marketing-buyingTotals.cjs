#!/usr/bin/env node
// Backfill script for marketingReceipt.buyingTotal using authoritative support/pos receipts
// Usage (dry-run): node scripts/backfill-marketing-buyingTotals.cjs --from=2025-12-17 --to=2025-12-17
// To apply (after reviewing output CSV): node scripts/backfill-marketing-buyingTotals.cjs --from=2025-12-17 --to=2025-12-17 --apply

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient({ log: ['warn','error'] });

function toNumber(v){ return Number(v ?? 0) || 0; }
function canonicalReceiptNumber(receiptNumber){
  if(!receiptNumber) return '';
  const trimmed = String(receiptNumber || '').trim();
  if(!trimmed) return '';
  if(trimmed.toUpperCase().startsWith('BETECH')) return `Betech${trimmed.slice(6)}`;
  return trimmed;
}

function parseArgs(){
  const args = {};
  process.argv.slice(2).forEach(a=>{
    if(a.startsWith('--from=')) args.from = a.split('=')[1];
    if(a.startsWith('--to=')) args.to = a.split('=')[1];
    if(a === '--apply') args.apply = true;
  });
  return args;
}

async function run(){
  const args = parseArgs();
  if(!args.from || !args.to){
    console.error('Usage: --from=YYYY-MM-DD --to=YYYY-MM-DD [--apply]');
    process.exit(1);
  }
  const from = new Date(`${args.from}T00:00:00.000Z`);
  const to = new Date(`${args.to}T23:59:59.999Z`);

  console.log('Dry-run mode:', !args.apply);
  console.log('Range:', from.toISOString(), '->', to.toISOString());

  // Find marketing receipts with missing buyingTotal
  const marketing = await prisma.marketingReceipt.findMany({
    where: { dailyEntry: { date: { gte: from, lte: to } }, OR: [{ buyingTotal: null }, { buyingTotal: 0 }] },
    include: { items: true },
  });

  console.log('Found', marketing.length, 'marketing receipts with missing buyingTotal in range');

  const proposals = [];

  for(const m of marketing){
    const rn = canonicalReceiptNumber(m.receiptNumber ?? '');
    let found = null;
    if(rn){
      // try supportReceipt
      const s = await prisma.supportReceipt.findFirst({ where: { receiptNumber: rn }, include: { items: true } });
      if(s){
        found = { type: 'support', id: s.id, buyingTotal: toNumber(s.buyingTotal), items: s.items };
      }
      if(!found){
        // try pos order by orderNumber
        const order = await prisma.order.findUnique({ where: { orderNumber: rn }, include: { receipt: true, items: true } }).catch(()=>null);
        if(order && order.receipt){
          // pos receipts often don't have buying totals, skip unless items have buyingPrice
          const buyingSum = (order.items || []).reduce((s,it)=>s + toNumber(it.buyingPrice),0);
          if(buyingSum > 0) found = { type: 'pos', id: order.receipt.id, buyingTotal: buyingSum, items: order.items };
        }
      }
    }

    // fallback: try matching by sellingTotal and timestamp proximity on support or pos
    if(!found){
      const candidatesSupport = await prisma.supportReceipt.findMany({ where: { sellingTotal: m.sellingTotal }, include: { items: true }, orderBy: { createdAt: 'asc' } });
      if(candidatesSupport && candidatesSupport.length === 1){
        found = { type: 'support', id: candidatesSupport[0].id, buyingTotal: toNumber(candidatesSupport[0].buyingTotal), items: candidatesSupport[0].items };
      }
      if(!found){
        const candidatesPos = await prisma.receipt.findMany({ where: { OR: [{ totals: { path: ['total'], equals: String(m.sellingTotal) } }, { order: { totalAmount: m.sellingTotal } }] }, include: { order: { include: { items: true } } } }).catch(()=>[]);
        if(candidatesPos && candidatesPos.length === 1){
          const r = candidatesPos[0];
          const buyingSum = (r.order?.items || []).reduce((s,it)=>s + toNumber(it.buyingPrice),0);
          if(buyingSum > 0) found = { type: 'pos', id: r.id, buyingTotal: buyingSum, items: r.order?.items };
        }
      }
    }

    proposals.push({ marketingId: m.id, receiptNumber: m.receiptNumber, sellingTotal: toNumber(m.sellingTotal), proposed: found ? toNumber(found.buyingTotal) : null, foundType: found ? found.type : null, foundId: found ? found.id : null });
  }

  const outDir = path.join(__dirname, '..', 'tmp');
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, `backfill-proposals-${args.from}-${args.to}.csv`);
  const header = ['marketingId','receiptNumber','sellingTotal','proposedBuyingTotal','foundType','foundId'];
  const lines = [header.join(',')];
  for(const p of proposals){
    lines.push([p.marketingId, p.receiptNumber||'', p.sellingTotal, p.proposed===null? '': p.proposed, p.foundType||'', p.foundId||''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
  }
  fs.writeFileSync(csvPath, lines.join('\n'));
  console.log('Wrote proposals CSV:', csvPath);

  if(args.apply){
    // apply updates in a transaction with backups
    const backupPath = path.join(outDir, `backfill-backup-${args.from}-${args.to}.csv`);
    const backups = [];
    for(const p of proposals){
      if(p.proposed !== null){
        const orig = await prisma.marketingReceipt.findUnique({ where: { id: p.marketingId } });
        backups.push(orig);
      }
    }
    const bh = ['id','receiptNumber','sellingTotal','buyingTotal','data'];
    const blow = [bh.join(',')];
    for(const b of backups){ blow.push([b.id, b.receiptNumber||'', toNumber(b.sellingTotal), toNumber(b.buyingTotal), JSON.stringify(b.data||{})].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')); }
    fs.writeFileSync(backupPath, blow.join('\n'));
    console.log('Wrote backup CSV:', backupPath);

    // now apply
    for(const p of proposals){
      if(p.proposed !== null){
        await prisma.marketingReceipt.update({ where: { id: p.marketingId }, data: { buyingTotal: p.proposed } });
        console.log('Updated', p.marketingId, '->', p.proposed);
      }
    }
    console.log('Applied updates.');
  } else {
    console.log('Dry-run complete. Review the CSV and re-run with --apply to perform updates.');
  }

  await prisma.$disconnect();
}

run().catch(e=>{ console.error('Error:', e); prisma.$disconnect().finally(()=>process.exit(1)); });
