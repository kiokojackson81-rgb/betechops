const { PrismaClient } = require("@prisma/client");
const { addDays, format } = require("date-fns");
const { zonedTimeToUtc } = require("date-fns-tz");
const { JumiaClient } = require("../src/lib/jumia/client");

const prisma = new PrismaClient();

const API_BASE = process.env.JUMIA_API_BASE || "https://vendor-api.jumia.com";
let TOKEN_URL = "https://vendor-api.jumia.com/token";
try {
  TOKEN_URL = `${new URL(API_BASE).origin}/token`;
} catch {
  /* noop */
}
const PAGE_SIZE = Number(process.env.JUMIA_AUDIT_PAGE_SIZE || 100);
const WINDOW_DAYS = Number(process.env.JUMIA_AUDIT_WINDOW_DAYS || 14);
const DEFAULT_TIMEZONE = process.env.JUMIA_TIMEZONE || "Africa/Nairobi";

function extractOrderId(raw) {
  if (!raw || typeof raw !== "object") return null;
  const candidates = [
    raw.id,
    raw.orderId,
    raw.order_id,
    raw.orderNumber,
    raw.order_number,
    raw.number,
  ];
  for (const cand of candidates) {
    if (cand === null || cand === undefined) continue;
    const str = String(cand).trim();
    if (str) return str;
  }
  return null;
}

function extractStatus(raw) {
  if (!raw || typeof raw !== "object") return null;
  const candidates = [raw.status, raw.orderStatus, raw.order_status, raw.currentStatus];
  for (const cand of candidates) {
    if (cand === null || cand === undefined) continue;
    const str = String(cand).trim();
    if (str) return str;
  }
  return null;
}

function extractUpdatedAt(raw) {
  if (!raw || typeof raw !== "object") return null;
  const candidates = [raw.updatedAt, raw.updated_at, raw.modifiedAt];
  for (const cand of candidates) {
    if (!cand) continue;
    const str = String(cand).trim();
    if (str && str !== "null" && str !== "undefined") return str;
  }
  return null;
}

function extractRawShop(raw) {
  if (!raw || typeof raw !== "object") return null;
  const candidates = [raw.shopId, raw.shop_id, raw.shop, raw.sellerId, raw.sellerCode];
  for (const cand of candidates) {
    if (cand === null || cand === undefined) continue;
    const str = String(cand).trim();
    if (str) return str;
  }
  return null;
}

async function listRemoteShops(client) {
  try {
    const main = await client.getShops();
    if (main && Array.isArray(main.shops) && main.shops.length) return main.shops;
  } catch {
    /* ignore */
  }
  try {
    const fallback = await client.call("/shops-of-master-shop");
    if (fallback && Array.isArray(fallback.shops) && fallback.shops.length) {
      return fallback.shops;
    }
  } catch {
    /* ignore */
  }
  return [];
}

async function auditDuplicates() {
  const startedAt = Date.now();
  console.log(
    `[audit] starting duplicate scan windowDays=${WINDOW_DAYS} pageSize=${PAGE_SIZE} base=${API_BASE}`,
  );

  const accounts = await prisma.jumiaAccount.findMany({ include: { shops: true } });
  if (!accounts.length) {
    console.log("[audit] no jumia accounts found");
    return;
  }

  const orderIndex = new Map();
  const perShopCounts = new Map();
  const perShopOrders = new Map();

  const now = new Date();
  const windowStart = zonedTimeToUtc(addDays(now, -WINDOW_DAYS), DEFAULT_TIMEZONE);
  const windowEnd = zonedTimeToUtc(now, DEFAULT_TIMEZONE);
  const range = {
    updatedAfter: format(windowStart, "yyyy-MM-dd HH:mm:ss"),
    updatedBefore: format(windowEnd, "yyyy-MM-dd HH:mm:ss"),
  };

  for (const account of accounts) {
    const client = new JumiaClient(
      API_BASE,
      TOKEN_URL,
      account.clientId,
      account.refreshToken,
      async (rotated) => {
        await prisma.jumiaAccount.update({
          where: { id: account.id },
          data: { refreshToken: rotated },
        });
      },
    );

    let shops = account.shops.map((s) => ({ id: s.id, name: s.name }));
    if (!shops.length) {
      shops = await listRemoteShops(client);
    }

    console.log(
      `[audit] account=${account.id} label=${account.label || ""} shops=${shops.length}`,
    );

    for (const shop of shops) {
      const shopId = shop.id;
      perShopCounts.set(shopId, 0);
      perShopOrders.set(shopId, new Set());
      console.log(`[audit]  shop=${shopId} name="${shop.name}" scanning...`);
      let token;
      const seenTokens = new Set();
      let pages = 0;

      do {
        let resp;
        try {
          resp = await client.getOrders({
            shopId,
            updatedAfter: range.updatedAfter,
            updatedBefore: range.updatedBefore,
            size: PAGE_SIZE,
            sort: "ASC",
            token,
          });
        } catch (err) {
          console.error(
            `[audit]   error fetching orders shop=${shopId} page=${pages}`,
            err?.message || err,
          );
          break;
        }

        const orders = Array.isArray(resp?.orders) ? resp.orders : [];

        for (const raw of orders) {
          const orderId = extractOrderId(raw);
          if (!orderId) continue;

          const status = extractStatus(raw);
          const updatedAt = extractUpdatedAt(raw);
          const rawShop = extractRawShop(raw);

          perShopCounts.set(shopId, (perShopCounts.get(shopId) || 0) + 1);
          perShopOrders.get(shopId)?.add(orderId);

          const hit = {
            shopId,
            status,
            updatedAt,
            rawShop,
          };

          if (orderIndex.has(orderId)) {
            const agg = orderIndex.get(orderId);
            agg.shops.add(shopId);
            agg.hits.push(hit);
          } else {
            orderIndex.set(orderId, { shops: new Set([shopId]), hits: [hit] });
          }
        }

        pages += 1;
        const next = resp?.nextToken ?? null;
        const last = resp?.isLastPage === true;
        if (last) break;
        if (!next || typeof next !== "string" || !next.trim()) break;
        if (seenTokens.has(next)) break;
        seenTokens.add(next);
        token = next;
      } while (token && pages < 2000);

      console.log(
        `[audit]  shop=${shopId} orders=${perShopCounts.get(shopId)} unique=${perShopOrders.get(shopId)?.size}`,
      );
    }
  }

  const duplicates = [];
  for (const entry of orderIndex.entries()) {
    if (entry[1].shops.size > 1) duplicates.push(entry);
  }

  console.log(
    `[audit] completed in ${Date.now() - startedAt}ms ordersTracked=${orderIndex.size} duplicates=${duplicates.length}`,
  );

  if (!duplicates.length) {
    console.log("[audit] no cross-shop duplicates detected within window");
    return;
  }

  const perShopDuplicateCounts = new Map();
  const perShopDuplicateOrders = new Map();

  for (const [orderId, agg] of duplicates) {
    for (const hit of agg.hits) {
      perShopDuplicateCounts.set(
        hit.shopId,
        (perShopDuplicateCounts.get(hit.shopId) || 0) + 1,
      );
      if (!perShopDuplicateOrders.has(hit.shopId)) {
        perShopDuplicateOrders.set(hit.shopId, new Set());
      }
      perShopDuplicateOrders.get(hit.shopId).add(orderId);
    }
  }

  console.log("Duplicate summary per shop:");
  for (const [shopId, count] of perShopDuplicateCounts.entries()) {
    const uniqueOrders = perShopDuplicateOrders.get(shopId)?.size ?? 0;
    const totalFetched = perShopCounts.get(shopId) || 0;
    console.log(
      `- shop=${shopId} duplicates=${uniqueOrders} hits=${count} totalFetched=${totalFetched}`,
    );
  }

  console.log("Sample duplicate orders (showing up to 20):");
  for (const [orderId, agg] of duplicates.slice(0, 20)) {
    const hits = agg.hits
      .map((h) => {
        const rawNote =
          h.rawShop && h.rawShop !== h.shopId ? ` rawShop=${h.rawShop}` : "";
        return `${h.shopId}${rawNote} status=${h.status || "?"} updatedAt=${h.updatedAt || "?"}`;
      })
      .join(" | ");
    console.log(`  orderId=${orderId} -> ${hits}`);
  }
}

(async () => {
  try {
    await auditDuplicates();
  } catch (err) {
    console.error("[audit] failed", err);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  }
})();

