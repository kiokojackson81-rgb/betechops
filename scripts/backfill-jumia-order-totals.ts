/*
 * Backfill JumiaOrder.totalAmountLocalCurrency & totalAmountLocalValue for rows
 * where these fields are still null (added after initial ingestion).
 *
 * Strategy:
 * 1. Pull batches of JumiaOrder ids with missing totals.
 * 2. For each order call vendor /orders/items endpoint to fetch its items.
 * 3. Derive a currency (first non-empty currency-like string) and sum a numeric value
 *    from candidate fields on each item (totalAmountLocalValue | totalAmountLocal | amountLocal | itemTotal | priceLocal*qty fallback).
 * 4. Persist using raw UPDATE (to avoid Prisma type lag) or update() with casts.
 * 5. Repeat until no remaining rows or MAX_CYCLES reached.
 *
 * Environment overrides:
 *   BACKFILL_BATCH         - number of orders per cycle (default 200)
 *   BACKFILL_CONCURRENCY   - parallelism (default 4)
 *   BACKFILL_MAX_CYCLES    - safety cap on loop iterations (default 200)
 *   BACKFILL_DRY_RUN       - if '1', only log intended updates.
 *   BACKFILL_SHOP_ID       - limit to a single shop id (optional).
 *
 * Usage:
 *   npm run backfill:jumia:order-totals
 *
 */
import pLimit from 'p-limit';
import { prisma } from '../src/lib/prisma';
import { jumiaFetch, loadShopAuthById } from '../src/lib/jumia';

const BATCH = Number(process.env.BACKFILL_BATCH || 200);
const CONCURRENCY = Number(process.env.BACKFILL_CONCURRENCY || 4);
const MAX_CYCLES = Number(process.env.BACKFILL_MAX_CYCLES || 200);
const DRY_RUN = process.env.BACKFILL_DRY_RUN === '1';
const LIMIT_SHOP = process.env.BACKFILL_SHOP_ID || null;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function coerceNumber(v: unknown): number | null {
  if (isFiniteNumber(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractItemValue(item: Record<string, unknown>): number | null {
  const candidates = [
    item.totalAmountLocalValue,
    item.totalAmountLocal,
    item.amountLocal,
    item.itemTotal,
    // fallback: priceLocal * quantity
    (() => {
      const price = (item as any).priceLocal ?? (item as any).price ?? null;
      const qty = (item as any).quantity ?? (item as any).qty ?? 1;
      const priceNum = coerceNumber(price);
      const qtyNum = coerceNumber(qty) ?? 1;
      return priceNum != null ? priceNum * qtyNum : null;
    })(),
  ];
  for (const c of candidates) {
    const num = coerceNumber(c);
    if (num != null) return num;
  }
  return null;
}

function extractItemCurrency(item: Record<string, unknown>): string | null {
  const candidates = [
    item.totalAmountLocalCurrency,
    item.currencyLocal,
    item.currency,
    item.localCurrency,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return String(c).trim();
  }
  return null;
}

async function fetchItems(shopId: string, orderId: string): Promise<Record<string, unknown>[]> {
  let shopAuth: any = null;
  try {
    shopAuth = await loadShopAuthById(shopId);
  } catch {
    // continue unauthenticated; vendor may reject
  }
  try {
    const resp: any = await jumiaFetch(`/orders/items?orderId=${encodeURIComponent(orderId)}`,(shopAuth ? { shopAuth } : {}) as any);
    if (resp && typeof resp === 'object') {
      if (Array.isArray(resp.items)) return resp.items as Record<string, unknown>[];
      if (Array.isArray(resp.data)) return resp.data as Record<string, unknown>[];
    }
  } catch (err) {
    console.warn(`[backfill] fetch items failed order=${orderId} shop=${shopId}`, err);
  }
  return [];
}

async function processOrder(order: { id: string; shopId: string }) {
  const items = await fetchItems(order.shopId, order.id);
  if (!items.length) return { orderId: order.id, updated: false, reason: 'no-items' };
  let currency: string | null = null;
  let sum = 0;
  for (const item of items) {
    if (!currency) currency = extractItemCurrency(item);
    const val = extractItemValue(item);
    if (val != null) sum += val;
  }
  if (sum <= 0) return { orderId: order.id, updated: false, reason: 'zero-sum' };
  const finalCurrency = currency || 'KES';
  if (DRY_RUN) {
    console.log(`[backfill] DRY_RUN would update id=${order.id} currency=${finalCurrency} value=${sum}`);
    return { orderId: order.id, updated: false, reason: 'dry-run' };
  }
  try {
    // Use raw update to avoid relying on generated types alignment.
    await prisma.$executeRaw`UPDATE "JumiaOrder" SET "totalAmountLocalCurrency" = ${finalCurrency}, "totalAmountLocalValue" = ${sum} WHERE "id" = ${order.id}`;
    return { orderId: order.id, updated: true };
  } catch (err) {
    console.error(`[backfill] update failed id=${order.id}`, err);
    return { orderId: order.id, updated: false, reason: 'update-error' };
  }
}

async function main() {
  console.log(`[backfill] starting Jumia order totals backfill batchSize=${BATCH} concurrency=${CONCURRENCY} limitShop=${LIMIT_SHOP || 'ALL'} dryRun=${DRY_RUN}`);
  let cycles = 0;
  let totalSeen = 0;
  let totalUpdated = 0;
  const limiter = pLimit(CONCURRENCY);
  while (cycles < MAX_CYCLES) {
    cycles += 1;
    const where: any = { totalAmountLocalValue: null };
    if (LIMIT_SHOP) where.shopId = LIMIT_SHOP;
    const missing = await prisma.jumiaOrder.findMany({
      where,
      select: { id: true, shopId: true },
      take: BATCH,
      orderBy: { updatedAt: 'asc' },
    });
    if (!missing.length) {
      console.log(`[backfill] no more missing rows after ${cycles - 1} cycles.`);
      break;
    }
    console.log(`[backfill] cycle=${cycles} processing ${missing.length} rows...`);
    const results = await Promise.all(
      missing.map((o) => limiter(() => processOrder(o)))
    );
    for (const r of results) {
      totalSeen += 1;
      if (r.updated) totalUpdated += 1;
    }
    const updatedThis = results.filter(r => r.updated).length;
    console.log(`[backfill] cycle=${cycles} done updated=${updatedThis} cumulativeUpdated=${totalUpdated}`);
    if (missing.length < BATCH) {
      console.log('[backfill] final partial batch, stopping early.');
      break;
    }
  }
  console.log(`[backfill] complete cycles=${cycles} seen=${totalSeen} updated=${totalUpdated}`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('[backfill] fatal error', err);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
