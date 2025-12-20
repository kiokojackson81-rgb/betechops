#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ log: ["warn", "error"] });

function toNumber(v: any) {
  return Number(v ?? 0) || 0;
}

function sumItemQuantities(items: Array<{ quantity?: number } | null>) {
  return items.reduce((s, it) => s + (Number(it?.quantity ?? 1) || 0), 0);
}

async function analyzeRange(fromIso: string, toIso: string) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  console.log(`\n=== RANGE ${from.toISOString()} -> ${to.toISOString()} ===`);

  // marketing receipts (marketingReceipt table used by admin summary)
  const marketing = await prisma.marketingReceipt.findMany({
    where: { dailyEntry: { date: { gte: from, lte: to } } },
    include: { items: true },
    orderBy: { id: "asc" },
  });

  const support = await prisma.supportReceipt.findMany({
    where: { dailyEntry: { date: { gte: from, lte: to } } },
    include: { items: true },
    orderBy: { id: "asc" },
  });

  const pos = await prisma.receipt.findMany({
    where: { generatedAt: { gte: from, lte: to } },
    include: { order: { include: { items: { select: { quantity: true } } } } },
    orderBy: { id: "asc" },
  });

  const marketingAgg = { totalSales: 0, totalProfit: 0, count: marketing.length, itemsCount: 0 };
  const missingCosts: Array<any> = [];

  for (const r of marketing) {
    const sell = toNumber(r.sellingTotal);
    marketingAgg.totalSales += sell;
    const items = r.items ?? [];
    marketingAgg.itemsCount += items.length;
    const aggregateCost = toNumber((r as any).buyingTotal);
    const allItemsPriced = items.length > 0 && items.every((it) => toNumber((it as any).buyingPrice) > 0);
    const hasAggregate = aggregateCost > 0;
    if (hasAggregate || allItemsPriced) {
      const buyingSum = hasAggregate ? aggregateCost : items.reduce((s, it) => s + toNumber((it as any).buyingPrice), 0);
      marketingAgg.totalProfit += sell - buyingSum;
    } else {
      missingCosts.push({ id: r.id, date: (r as any).generatedAt ?? (r as any).createdAt ?? null, sellingTotal: sell, itemsCount: items.length });
    }
  }

  const supportAgg = { totalSales: 0, totalProfit: 0, count: support.length, itemsCount: 0 };
  for (const r of support) {
    const sell = toNumber(r.sellingTotal);
    supportAgg.totalSales += sell;
    const items = r.items ?? [];
    supportAgg.itemsCount += items.length;
    const aggregateCost = toNumber((r as any).buyingTotal);
    const allItemsPriced = items.length > 0 && items.every((it) => toNumber((it as any).buyingPrice) > 0);
    const hasAggregate = aggregateCost > 0;
    if (hasAggregate || allItemsPriced) {
      const buyingSum = hasAggregate ? aggregateCost : items.reduce((s, it) => s + toNumber((it as any).buyingPrice), 0);
      supportAgg.totalProfit += sell - buyingSum;
    } else {
      // treat same as awaiting pricing
    }
  }

  const posAgg = { totalSales: 0, count: pos.length, itemsCount: 0 };
  for (const r of pos) {
    const sell = toNumber((r as any).totals?.total ?? r.order?.totalAmount ?? 0);
    posAgg.totalSales += sell;
    const items = r.order?.items ?? [];
    posAgg.itemsCount += items.reduce((s, it) => s + (Number(it?.quantity ?? 1) || 0), 0);
  }

  console.log({ marketing: marketingAgg, support: supportAgg, pos: posAgg, missingCostsCount: missingCosts.length });
  if (missingCosts.length > 0) {
    console.log("Sample missing-cost marketing receipts (first 10):");
    console.table(missingCosts.slice(0, 10));
  }

  // Also compare with admin summary logic by invoking computeAdminReceiptSummary-like aggregates here
  // We'll replicate the dedupe logic used in `src/lib/adminReceiptsSummary.ts` to see final deduped totals

  type Rec = { source: "marketing" | "support" | "pos"; key: string; paymentMethod: string | null; sellingTotal: number; items: any[]; buyingTotal?: number };

  const mk = marketing.map((r) => ({ source: "marketing", key: `marketing:${r.id}`, paymentMethod: (r as any).paymentMethod ?? null, sellingTotal: toNumber(r.sellingTotal), items: r.items ?? [], buyingTotal: toNumber((r as any).buyingTotal) } as Rec));
  const sp = support.map((r) => ({ source: "support", key: `support:${r.id}`, paymentMethod: (r as any).paymentMethod ?? null, sellingTotal: toNumber(r.sellingTotal), items: r.items ?? [], buyingTotal: toNumber((r as any).buyingTotal) } as Rec));
  const ps = pos.map((r) => ({ source: "pos", key: `pos:${r.id}`, paymentMethod: ((r as any).data?.paymentMethod) ?? null, sellingTotal: toNumber((r as any).totals?.total ?? r.order?.totalAmount ?? 0), items: r.order?.items?.map((it: any) => ({ quantity: it.quantity })) ?? [] } as Rec));

  const combined = [...mk, ...sp, ...ps];
  const priority = { pos: 3, marketing: 2, support: 1 } as Record<string, number>;
  const map = new Map<string, Rec>();
  for (const c of combined) {
    const existing = map.get(c.key);
    if (!existing || priority[c.source] > priority[existing.source]) map.set(c.key, c);
  }
  const deduped = Array.from(map.values());
  const totalSales = deduped.reduce((s, r) => s + r.sellingTotal, 0);

  let totalCost = 0;
  let totalProfit = 0;
  let awaitingPricing = 0;
  for (const r of deduped.filter((d) => d.source !== "pos")) {
    const items = r.items ?? [];
    const agg = toNumber(r.buyingTotal ?? 0);
    const allPriced = items.length > 0 && items.every((it) => toNumber((it as any).buyingPrice) > 0);
    const hasAgg = agg > 0;
    if (hasAgg || allPriced) {
      const buying = hasAgg ? agg : items.reduce((s, it) => s + toNumber((it as any).buyingPrice), 0);
      totalCost += buying;
      totalProfit += r.sellingTotal - buying;
    } else {
      awaitingPricing += 1;
    }
  }

  const itemsCount = deduped.reduce((s, r) => s + sumItemQuantities(r.items ?? []), 0);

  console.log("Admin-style deduped totals:", { totalSales, totalCost, totalProfit, receiptsCount: deduped.length, itemsCount, awaitingPricing });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: investigate-receipts-profit.ts <fromIso> <toIso>");
    process.exit(1);
  }
  try {
    await analyzeRange(args[0], args[1]);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
