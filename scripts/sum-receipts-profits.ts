#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

function toNumber(v: any) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: sum-receipts-profits.ts <comma-separated-receipt-ids>');
    process.exit(1);
  }
  const ids = args[0].split(',').map((s) => s.trim()).filter(Boolean);
  console.log('Looking up', ids.length, 'receipts');
  try {
    const receipts = await prisma.receipt.findMany({
      where: { id: { in: ids } },
      include: { order: { include: { items: { include: { orderCosts: true } } } }, },
      orderBy: { id: 'asc' },
    });
    if (!receipts || receipts.length === 0) {
      console.error('No receipts found for given ids');
      process.exit(1);
    }

    let totalProfit = 0;
    console.log('\nPer-receipt profits:');
    for (const r of receipts) {
      const selling = toNumber((r as any).totals?.total ?? r.order?.totalAmount ?? 0);
      const explicitProfitRaw = (r as any).profit ?? (r as any).data?.profit;
      const explicitProfit = typeof explicitProfitRaw === 'number' && Number.isFinite(explicitProfitRaw)
        ? explicitProfitRaw
        : (typeof explicitProfitRaw === 'string' && explicitProfitRaw.trim() !== '' && !Number.isNaN(Number(explicitProfitRaw)) ? Number(explicitProfitRaw) : undefined);

      let buying = 0;
      const aggregateBuying = toNumber((r as any).buyingTotal ?? (r as any).data?.buyingTotal);
      if (aggregateBuying > 0) {
        buying = aggregateBuying;
      } else {
        const items = (r.order?.items ?? []) as any[];
        let itemSum = 0;
        for (const it of items) {
          const qty = Number.isFinite(Number(it?.quantity ?? 1)) ? Number(it?.quantity ?? 1) : 1;
          const costs = Array.isArray(it.orderCosts) ? it.orderCosts : [];
          const unitCostSum = costs.reduce((s: number, c: any) => s + toNumber(c.unitCost), 0);
          itemSum += unitCostSum * qty;
        }
        buying = itemSum;
      }

      let profit = 0;
      if (explicitProfit !== undefined) {
        profit = explicitProfit;
      } else {
        profit = selling - buying;
      }
      totalProfit += profit;
      console.log(r.id, 'selling:', selling, 'buying:', buying, 'profit:', profit);
    }

    console.log('\nTotal profit for', receipts.length, 'receipts =', totalProfit);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error('Error querying receipts:', err?.message ?? err);
    await prisma.$disconnect();
    process.exit(2);
  }
}

main();
