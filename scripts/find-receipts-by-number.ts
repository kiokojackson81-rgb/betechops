#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['warn', 'error'] });

function toNumber(v: any) {
  if (v === undefined || v === null) return NaN;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: find-receipts-by-number.ts <comma-separated-ids-or-numbers>');
    process.exit(1);
  }
  const ids = args[0].split(',').map(s => s.trim()).filter(Boolean);
  console.info('Looking up', ids.length, 'identifiers');

  for (const ident of ids) {
    try {
      // Print Receipt table columns once (helpful for debugging)
      const cols: Array<{ column_name: string }> = await prisma.$queryRaw`
        SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Receipt' ORDER BY ordinal_position
      `;
      console.info('Receipt table columns:', cols.map(c => c.column_name).join(', '));

      // Try several tables where receipt-like records might live
      const tablesToTry = ['Receipt', 'MarketingReceipt', 'SupportReceipt', 'Order', 'JumiaOrder'];
      let found = false;
      for (const tbl of tablesToTry) {
        // Fetch actual columns for this table and use them to build safe queries
        let colRows: Array<{ column_name: string }> = [];
        try {
          colRows = await prisma.$queryRaw`
            SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${tbl} ORDER BY ordinal_position
          `;
        } catch {
          // ignore
        }
        const colNames = (colRows || []).map(c => c.column_name);
        const attempts: string[] = [];
        attempts.push(`SELECT * FROM public."${tbl}" WHERE id = '${ident}' LIMIT 1`);
        for (const cn of colNames) {
          const lc = cn.toLowerCase();
          if (lc.includes('receipt') || lc.includes('number')) {
            attempts.push(`SELECT * FROM public."${tbl}" WHERE "${cn}" = '${ident}' LIMIT 1`);
          }
        }
        // Also try a generic text-search on string columns (safe small sample)
        for (const q of attempts) {
          try {
            const rows: any[] = await prisma.$queryRawUnsafe(q);
            if (rows && rows.length > 0) {
              const r = rows[0];
              const totals = r.totals ?? null;
              const data = r.data ?? null;
              const buyingTotal = r.buyingTotal ?? r.buying_total ?? (data && data.buyingTotal ? data.buyingTotal : null);
              const explicitProfit = r.profit ?? (data && data.profit ? data.profit : null) ?? null;
              let selling = NaN;
              if (totals && typeof totals === 'object' && totals.total !== undefined) selling = toNumber(totals.total);
              console.info('Found in table', tbl, 'via query:', q);
              console.info('  id:', r.id);
              console.info('  receipt identifier(s):', r.receipt_number ?? r.receiptNumber ?? 'n/a');
              console.info('  selling (totals.total):', Number.isFinite(selling) ? selling : 'n/a');
              console.info('  buyingTotal (col or data.buyingTotal):', buyingTotal ?? 'n/a');
              console.info('  explicit profit (col or data.profit):', explicitProfit ?? 'n/a');
              console.info('  data keys (sample):', data && typeof data === 'object' ? Object.keys(data).slice(0,20) : 'n/a');
              // If we found an Order, try to locate the Receipt that references it
              if (tbl === 'Order') {
                try {
                  const ordId = r.id;
                  const recs: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM public."Receipt" WHERE "orderId" = '${ordId}' LIMIT 1`);
                  if (recs && recs.length > 0) {
                    const rc = recs[0];
                    const rTotals = rc.totals ?? null;
                    const rData = rc.data ?? null;
                    const rBuyingTotal = rc.buyingTotal ?? rc.buying_total ?? (rData && rData.buyingTotal ? rData.buyingTotal : null);
                    const rExplicitProfit = rc.profit ?? (rData && rData.profit ? rData.profit : null) ?? null;
                    const rSelling = rTotals && typeof rTotals === 'object' && rTotals.total !== undefined ? toNumber(rTotals.total) : NaN;
                    console.info('  -> linked Receipt found: id=', rc.id);
                    console.info('     receipt_number:', rc.receipt_number ?? rc.receiptNumber ?? 'n/a');
                    console.info('     selling (totals.total):', Number.isFinite(rSelling) ? rSelling : 'n/a');
                    console.info('     buyingTotal:', rBuyingTotal ?? 'n/a');
                    console.info('     explicit profit:', rExplicitProfit ?? 'n/a');
                    // If no buyingTotal/explicitProfit, try computing buying from OrderItem+OrderCost
                    if ((rBuyingTotal === null || rBuyingTotal === undefined) && (rExplicitProfit === null || rExplicitProfit === undefined)) {
                      try {
                        const ordIdRef = r.orderId ?? rc.orderId ?? '';
                        const itemsForOrder: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM public."OrderItem" WHERE "orderId" = '${ordIdRef}'`);
                        if (itemsForOrder && itemsForOrder.length > 0) {
                          let computedBuying = 0;
                          for (const it of itemsForOrder) {
                            const itemId = it.id;
                            const qty = Number.isFinite(Number(it.quantity ?? 1)) ? Number(it.quantity ?? 1) : 1;
                            const costs: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM public."OrderCost" WHERE "orderItemId" = '${itemId}'`);
                            const unitCostSum = (costs || []).reduce((s, c) => s + (Number.isFinite(Number(c.unitCost ?? c.unitcost ?? 0)) ? Number(c.unitCost ?? c.unitcost ?? 0) : 0), 0);
                            computedBuying += unitCostSum * qty;
                          }
                          const computedProfit = Number.isFinite(rSelling) ? rSelling - computedBuying : NaN;
                          console.info('     computed buying from OrderItem+OrderCost:', computedBuying);
                          console.info('     computed profit:', computedProfit);
                        } else {
                          console.info('     no OrderItem rows found to compute buying');
                        }
                      } catch (e) {
                        // ignore compute errors
                      }
                    }
                  } else {
                    console.info('  -> no linked Receipt found for this Order');
                  }
                } catch (rx) {
                  // ignore
                }
              }
              found = true;
              break;
            }
          } catch (innerErr) {
            // ignore and continue
          }
        }
        if (found) break;
      }
      if (!found) console.warn(ident, '=> NOT FOUND in tried tables');
    } catch (err) {
      console.error('Error looking up', ident, err instanceof Error ? err.message : String(err));
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
