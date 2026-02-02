#!/usr/bin/env ts-node
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient({ log: ['info', 'warn', 'error'] });

function toNumber(v: any) {
  return Number(v ?? 0) || 0;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: backfill-receipt-profits.ts <fromIso> <toIso> [--apply]');
    process.exit(1);
  }
  const from = new Date(args[0]);
  const to = new Date(args[1]);
  const apply = args.includes('--apply');

  console.info(`Range: ${from.toISOString()} -> ${to.toISOString()} (apply=${apply})`);

  const receipts = await prisma.receipt.findMany({
    where: { generatedAt: { gte: from, lte: to } },
    include: { order: { include: { items: { include: { orderCosts: true } } } } },
    orderBy: { id: 'asc' },
  });

  let candidateCount = 0;
  const updated: Array<{ id: string; profit: number }> = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const r of receipts) {
    const id = r.id;
    const explicitProfit = typeof (r as any).profit === 'number' && Number.isFinite((r as any).profit)
      ? Number((r as any).profit)
      : (typeof r.data === 'object' && r.data && typeof (r.data as any).profit === 'number' ? Number((r.data as any).profit) : undefined);

    if (explicitProfit !== undefined) {
      skipped.push({ id, reason: 'already-has-profit' });
      continue;
    }

    // determine selling total
    const sell = toNumber((r as any).totals?.total ?? r.order?.totalAmount ?? 0);

    // prefer explicit aggregate buyingTotal if present on record/data
    const aggregateBuying = toNumber((r as any).buyingTotal ?? (r.data as any)?.buyingTotal ?? 0);
    if (aggregateBuying > 0) {
      const profit = sell - aggregateBuying;
      candidateCount += 1;
      if (apply) {
        await persistProfit(r.id, profit, r.data);
        updated.push({ id, profit });
      }
      continue;
    }

    // else try to compute from item-level costs (order.items.orderCosts.unitCost)
    const items = (r.order?.items ?? []) as any[];
    let costFromItems = 0;
    let anyItemCost = false;
    for (const it of items) {
      if (Array.isArray(it.orderCosts) && it.orderCosts.length > 0) {
        const unitCostSum = it.orderCosts.reduce((s: number, c: any) => s + toNumber(c.unitCost), 0);
        costFromItems += unitCostSum * (Number(it.quantity ?? 1) || 1);
        anyItemCost = true;
      }
    }

    if (anyItemCost) {
      const profit = sell - costFromItems;
      candidateCount += 1;
      if (apply) {
        await persistProfit(r.id, profit, r.data);
        updated.push({ id, profit });
      }
      continue;
    }

    skipped.push({ id, reason: 'no-cost-data' });
  }

  console.info('Done.');
  console.info({ receiptsScanned: receipts.length, candidates: candidateCount, updated: updated.length, skipped: skipped.length });
  if (updated.length > 0) console.table(updated.slice(0, 20));
  if (skipped.length > 0) console.table(skipped.slice(0, 20));

  await prisma.$disconnect();
}

async function persistProfit(receiptId: string, profit: number, existingData: any) {
  const nextData = typeof existingData === 'object' && existingData ? { ...(existingData as Record<string, unknown>) } : {};
  nextData.profit = profit;

  // Try combined update (set profit column if exists, and update data)
  try {
    await prisma.receipt.update({ where: { id: receiptId }, data: { data: nextData as Prisma.InputJsonValue, profit: profit as any } as any });
    return;
  } catch (e) {
    // If setting profit column failed (maybe column doesn't exist), fallback to updating only `data`.
  }

  try {
    await prisma.receipt.update({ where: { id: receiptId }, data: { data: nextData as Prisma.InputJsonValue } });
  } catch (err) {
    console.error('Failed to persist profit for', receiptId, err);
  }
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
