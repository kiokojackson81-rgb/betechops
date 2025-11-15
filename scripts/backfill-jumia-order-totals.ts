/*
 * Backfill JumiaOrder.totalAmountLocalCurrency & totalAmountLocalValue for rows missing them.
 * Strategy: fetch /orders/items for each order lacking totals, derive currency + sum, persist.
 * Environment overrides:
 *   BACKFILL_BATCH (default 200), BACKFILL_CONCURRENCY (default 4), BACKFILL_MAX_CYCLES (default 200),
 *   BACKFILL_DRY_RUN=1 (log only), BACKFILL_SHOP_ID=<shopId> (scope to one shop).
 */
// CommonJS-style requires to avoid ts-node ESM resolution issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pLimit = (require('p-limit').default || require('p-limit'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../src/lib/prisma.ts');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getJumiaAccessToken, getAccessTokenFromEnv } = require('../src/lib/oidc.ts');

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

async function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

const RETRY_LIMIT = Number(process.env.BACKFILL_RETRY || 2);
const RETRY_DELAY_MS = Number(process.env.BACKFILL_RETRY_DELAY_MS || 1500);

async function fetchItems(shopId: string, orderId: string, orderNumber?: number | null): Promise<Record<string, unknown>[]> {
  // Attempt per-shop auth via jumiaShop -> jumiaAccount relation
  let shopAuth: { clientId?: string; refreshToken?: string; platform?: string } | undefined;
  try {
    const jShop = await prisma.jumiaShop.findUnique({ where: { id: shopId }, include: { account: true } });
    if (jShop?.account) shopAuth = { clientId: jShop.account.clientId, refreshToken: jShop.account.refreshToken, platform: 'JUMIA' };
  } catch {}
  let accessToken: string;
  try {
    if (shopAuth?.clientId && shopAuth.refreshToken) {
      const tok = await getJumiaAccessToken(shopAuth as any);
      accessToken = typeof tok === 'string' ? tok : tok.access_token;
    } else {
      accessToken = await getAccessTokenFromEnv();
    }
  } catch (e) {
    console.warn(`[backfill] token mint failed order=${orderId} shop=${shopId}`, e);
    return [];
  }
  const base = process.env.base_url || process.env.BASE_URL || process.env.JUMIA_API_BASE || 'https://vendor-api.jumia.com';
  const baseUrl = base.replace(/\/$/, '');
  const attemptUrls: string[] = [];
  if (orderNumber != null) attemptUrls.push(`${baseUrl}/orders/items?orderNumber=${encodeURIComponent(String(orderNumber))}`);
  attemptUrls.push(`${baseUrl}/orders/items?orderId=${encodeURIComponent(orderId)}`);
  let attempt = 0;
  while (attempt <= RETRY_LIMIT) {
    attempt += 1;
    try {
  const url = attemptUrls[Math.min(attempt - 1, attemptUrls.length - 1)];
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
      if (r.status === 429 && attempt <= RETRY_LIMIT) {
        const txt = await r.text().catch(() => '');
        const backoff = RETRY_DELAY_MS * attempt;
        console.warn(`[backfill] 429 rate limit order=${orderId} attempt=${attempt}/${RETRY_LIMIT} backoff=${backoff} body=${txt.slice(0,120)}`);
        await sleep(backoff);
        continue;
      }
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        console.warn(`[backfill] items fetch failed order=${orderId} status=${r.status} body=${txt.slice(0,120)}`);
        return [];
      }
      const j: any = await r.json().catch(() => ({}));
      if (Array.isArray(j?.items)) return j.items as any[];
      if (Array.isArray(j?.data)) return j.data as any[];
      return [];
    } catch (err) {
      if (attempt <= RETRY_LIMIT) {
        const backoff = RETRY_DELAY_MS * attempt;
        console.warn(`[backfill] network error items order=${orderId} attempt=${attempt}/${RETRY_LIMIT} backoff=${backoff}`, err);
        await sleep(backoff);
        continue;
      }
      console.warn(`[backfill] network error items (final) order=${orderId}`, err);
      return [];
    }
  }
  return [];
}

async function processOrder(order: { id: string; shopId: string; number?: number | null }) {
  const items = await fetchItems(order.shopId, order.id, order.number);
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
  console.log(`[backfill] starting totals backfill batchSize=${BATCH} concurrency=${CONCURRENCY} limitShop=${LIMIT_SHOP || 'ALL'} dryRun=${DRY_RUN}`);
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
      select: { id: true, shopId: true, number: true },
      take: BATCH,
      orderBy: { updatedAt: 'asc' },
    });
    if (!missing.length) {
      console.log(`[backfill] no more missing rows after ${cycles - 1} cycles.`);
      break;
    }
    console.log(`[backfill] cycle=${cycles} processing ${missing.length} rows...`);
    const results = await Promise.all(
      missing.map((o: { id: string; shopId: string }) => limiter(() => processOrder(o)))
    );
    for (const r of results) {
      totalSeen += 1;
      if (r.updated) totalUpdated += 1;
    }
  const updatedThis = results.filter((r: any) => r.updated).length;
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
