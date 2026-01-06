"use server";

import { Platform, Prisma, WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadJumiaCredentials, type LoadedJumiaCredentials } from "@/lib/credentials/jumia";
import { mondayToSundayLocalWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { requestWithRetry } from "@/lib/fetchWithRetry";

const DEFAULT_API_BASE = process.env.JUMIA_VENDOR_API_BASE ?? "https://vendor-api.jumia.com";
const DEFAULT_LOOKBACK_DAYS = 70;

type JumiaStatement = {
  statementNumber: string;
  payout?: { amount?: number };
  createdAt?: string;
  shopSid?: string;
  period?: { startDate?: string; endDate?: string };
  paid?: boolean;
};

type JumiaOrder = {
  id: string;
  number: string | number;
  createdAt: string;
  shopIds?: string[];
  status: string;
};

type JumiaOrderItem = {
  id: string;
  status: string;
  itemPriceLocal?: number;
  paidPriceLocal?: number;
  country?: { currencyCode?: string };
  product?: { name?: string; sellerSku?: string; imageUrl?: string };
};

type MarketplaceAccountWithAssignments = Prisma.MarketplaceAccountGetPayload<{
  include: { assignments: true };
}>;

type SyncOnlineMarketplaceOptions = {
  lookbackDays?: number;
  periodStart?: Date;
  periodEnd?: Date;
};

export async function syncOnlineMarketplaceData(opts?: SyncOnlineMarketplaceOptions) {
  let createdBefore = opts?.periodEnd ?? new Date();
  let createdAfter =
    opts?.periodStart ??
    (() => {
      const days = opts?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
      const base = new Date(createdBefore);
      base.setDate(base.getDate() - days);
      return base;
    })();
  if (createdAfter > createdBefore) {
    const temp = createdAfter;
    createdAfter = createdBefore;
    createdBefore = temp;
  }

  const activeAssignmentsWhere = {
    OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
  };

  const jumiaAccounts: MarketplaceAccountWithAssignments[] = await prisma.marketplaceAccount.findMany({
    where: { platform: Platform.JUMIA, isActive: true },
    include: {
      assignments: {
        where: activeAssignmentsWhere,
        orderBy: { startsAt: "desc" },
      },
    },
  });

  const jumiaShops = await prisma.shop.findMany({
    where: { platform: Platform.JUMIA },
    select: { id: true, name: true, jumiaShopSid: true },
  });
  const shopsByJumiaSid = new Map<string, (typeof jumiaShops)[number]>();
  jumiaShops.forEach((shop) => {
    if (shop.jumiaShopSid) shopsByJumiaSid.set(shop.jumiaShopSid, shop);
  });

  const accountsBySid = new Map<string, typeof jumiaAccounts[number]>();
  jumiaAccounts.forEach((account) => {
    if (account.jumiaShopSid) accountsBySid.set(account.jumiaShopSid, account);
  });

  // Try to load GLOBAL/env credentials for fetching payout statements
  let statements: JumiaStatement[] = [];
  try {
    const globalCreds = await (async () => {
      try {
        return await loadJumiaCredentials();
      } catch (e) {
        return null;
      }
    })();
    if (globalCreds) {
      const apiBaseGlobal = globalCreds.baseUrl?.trim() || DEFAULT_API_BASE;
      const authSchemeGlobal = globalCreds.authScheme?.trim() || process.env.JUMIA_AUTH_SCHEME?.trim() || "Bearer";
      const accessTokenGlobal = await refreshJumiaToken(globalCreds, apiBaseGlobal);
      const authHeaderGlobal = `${authSchemeGlobal} ${accessTokenGlobal}`;
      statements = await fetchStatements(apiBaseGlobal, authHeaderGlobal, createdAfter);
    } else {
      statements = [];
    }
  } catch (err) {
    console.warn("[onlineSync] Failed to fetch payout statements", err);
    statements = [];
  }
  for (const statement of statements) {
    const stmtShopSid = statement.shopSid ?? null;
    const mappedAccount = stmtShopSid ? accountsBySid.get(stmtShopSid) : null;
    if (!mappedAccount) {
      console.warn(`[onlineSync] No marketplace account mapped for statement shopSid ${stmtShopSid} statement ${statement.statementNumber}`);
      continue;
    }

    const targetAccountId = mappedAccount.id;
    // Enforce strict identity: statement.shopSid must match the mapped account's jumiaShopSid
    if (statement.shopSid && mappedAccount.jumiaShopSid && statement.shopSid !== mappedAccount.jumiaShopSid) {
      console.error(`[onlineSync] SHOP_SID_MISMATCH statement ${statement.statementNumber} shopSid ${statement.shopSid} does not match account jumiaShopSid ${mappedAccount.jumiaShopSid} - skipping attribution`);
      continue;
    }
    // Treat missing `paid` as true because we queried with paid=true filter
    const inferredPaid = statement.paid === undefined || statement.paid === null ? true : Boolean(statement.paid);
    const { weekStart, weekEnd } = deriveWeekWindow(statement);
    const grossSales = Number(statement.payout?.amount ?? 0);

    // Ensure we can map account -> Shop before creating payout rows. If the Shop
    // does not exist, skip inserting a MarketplacePayoutWeek for this statement.
    const shopRecord = mappedAccount.jumiaShopSid ? shopsByJumiaSid.get(mappedAccount.jumiaShopSid) : undefined;
    if (!shopRecord) {
      console.warn(
        `[onlineSync] No Shop record for marketplace account ${mappedAccount.displayName ?? mappedAccount.id} jumiaShopSid=${mappedAccount.jumiaShopSid}; skipping statement ${statement.statementNumber}`,
      );
      continue;
    }

    try {
      // Use composite key: accountId + weekStart + weekEnd to avoid duplicate rows
      // Find any existing rows for this account where the stored week overlaps
      // the canonical window. This collapses earlier rows that used slightly
      // different timestamps (e.g. UTC vs Nairobi offsets).
      const existingRows = await prisma.marketplacePayoutWeek.findMany({
        where: { AND: [{ accountId: targetAccountId }, { weekStart: { lte: weekEnd } }, { weekEnd: { gte: weekStart } }] },
        orderBy: { createdAt: 'asc' },
      });

      if (existingRows.length === 0) {
        // No row for this account/week — create canonical row
        await prisma.marketplacePayoutWeek.create({
          data: {
            accountId: targetAccountId,
            statementNumber: statement.statementNumber,
            weekStart,
            weekEnd,
            grossSales,
            payoutAmount: grossSales,
            currency: "LOCAL",
            isPaid: inferredPaid,
            rawPayload: statement as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        // Collapse duplicates (if any) by selecting a keeper row and summing values
        const keeper = existingRows.find((r) => Number(r.payoutAmount ?? r.grossSales ?? 0) > 0) ?? existingRows[0];
        const otherRows = existingRows.filter((r) => r.id !== keeper.id);

        // Sum existing amounts and include this statement if its statementNumber is new
        let aggregated = existingRows.reduce((s, r) => s + Number(r.payoutAmount ?? r.grossSales ?? 0), 0);
        const alreadyHasStatement = existingRows.some((r) => r.statementNumber === statement.statementNumber);
        if (!alreadyHasStatement) aggregated += grossSales;

        try {
          await prisma.marketplacePayoutWeek.update({
            where: { id: keeper.id },
            data: {
              accountId: targetAccountId,
              statementNumber: statement.statementNumber,
              grossSales: aggregated,
              payoutAmount: aggregated,
              isPaid: inferredPaid,
              rawPayload: statement as unknown as Prisma.InputJsonValue,
              weekEnd,
            },
          });
        } catch (err) {
          console.warn('[onlineSync] Failed to update existing MarketplacePayoutWeek', err);
        }

        if (otherRows.length > 0) {
          try {
            await prisma.marketplacePayoutWeek.deleteMany({ where: { id: { in: otherRows.map((r) => r.id) } } });
          } catch (err) {
            console.warn('[onlineSync] Failed to remove duplicate MarketplacePayoutWeek rows', err);
          }
        }
      }
    } catch (err) {
      console.warn('[onlineSync] Failed to upsert MarketplacePayoutWeek', err);
      continue;
    }

    // Create or update an automatic WeeklySale entry for this payout week.
    try {
      await upsertWeeklySaleEntry(shopRecord.id, mappedAccount.platform, weekStart, weekEnd, grossSales);
    } catch (err) {
      console.warn('[onlineSync] Failed to upsert WeeklySale for payout week', err);
    }
  }

  // Fetch orders per-account using that account's credentials (support per-account ApiCredential)
  // Limit concurrency when syncing accounts to avoid hitting vendor rate limits.
  async function runWithConcurrency<T>(items: T[], limit: number, worker: (it: T) => Promise<void>) {
    let idx = 0;
    async function runner() {
      while (true) {
        const i = idx++;
        if (i >= items.length) return;
        const it = items[i];
        try {
          await worker(it);
        } catch (err) {
          console.error('[onlineSync] account worker error', err);
        }
      }
    }
    const parallel = Math.min(limit, items.length);
    const runners: Promise<void>[] = [];
    for (let i = 0; i < parallel; i++) runners.push(runner());
    await Promise.all(runners);
  }

  await runWithConcurrency(jumiaAccounts, 2, async (account) => {
    let credentialsForAccount: any = null;
    try {
      credentialsForAccount = await loadJumiaCredentials(`MARKETPLACE_ACCOUNT:${account.id}`);
    } catch (err) {
      // Fall back to GLOBAL/env if no per-account credential exists
      try {
        credentialsForAccount = await loadJumiaCredentials();
      } catch (err2) {
        console.warn(`[onlineSync] No Jumia credentials for account ${account.displayName ?? account.id}; skipping`);
        return;
      }
    }

    const apiBaseAcct = credentialsForAccount.baseUrl?.trim() || DEFAULT_API_BASE;
    const authSchemeAcct = credentialsForAccount.authScheme?.trim() || process.env.JUMIA_AUTH_SCHEME?.trim() || "Bearer";
    const accessTokenAcct = await refreshJumiaToken(credentialsForAccount, apiBaseAcct);
    const authHeaderAcct = `${authSchemeAcct} ${accessTokenAcct}`;

    const orders = await fetchOrders(apiBaseAcct, authHeaderAcct, createdAfter, createdBefore);
    for (const order of orders) {
      const shopSid = order.shopIds?.[0];
      // Ensure we only process orders for this account (token may return multiple shops)
      if (account.jumiaShopSid && shopSid && shopSid !== account.jumiaShopSid) continue;

      const items = await fetchOrderItems(apiBaseAcct, authHeaderAcct, order.id);
    for (const item of items) {
      const sellingPriceLocal = Number(item.paidPriceLocal ?? item.itemPriceLocal ?? 0);
      const statusStr = typeof item.status === 'string' ? item.status : String(item.status ?? '');
      const isReturnedFlag = statusStr.startsWith('RETURN') || statusStr === 'FAILED';
      // load existing order (if any) so we can emit reversal events when needed
      const existing = await prisma.marketplaceOrder.findUnique({ where: { id: item.id } });

        // extract fee/shipping from raw payload when available
        const rawItem: any = item as any;
        const feeVal = Number((rawItem?.seller_fee?.amount ?? rawItem?.seller_fee_amount ?? 0) || 0);
        const shippingVal = Number((rawItem?.shipping_fee?.amount ?? rawItem?.shipping_fee_amount ?? 0) || 0);

      const upsertResult = await prisma.marketplaceOrder.upsert({
        where: {
          id: item.id,
        },
        create: {
          id: item.id,
          accountId: account.id,
          platform: Platform.JUMIA,
          orderId: String(order.number ?? order.id),
          orderItemId: item.id,
          status: item.status,
          orderedAt: new Date(order.createdAt),
          productName: item.product?.name ?? "Unknown product",
          productUrl: item.product?.sellerSku
            ? `https://www.jumia.co.ke/${item.product.sellerSku}`
            : undefined,
          sellingPrice: sellingPriceLocal,
          currency: item.country?.currencyCode ?? "KES",
          isReturned: isReturnedFlag,
          sellerFee: feeVal,
          shippingFee: shippingVal,
          rawPayload: item as unknown as Prisma.InputJsonValue,
        },
        update: {
          status: item.status,
          sellingPrice: sellingPriceLocal,
          currency: item.country?.currencyCode ?? "KES",
          isReturned: isReturnedFlag,
          // store fee/shipping and raw payload; clear profit on return
          sellerFee: feeVal,
          shippingFee: shippingVal,
          profit: isReturnedFlag ? 0 : undefined,
          rawPayload: item as unknown as Prisma.InputJsonValue,
        },
      });

      // If this item was previously recognised with profit and is now returned,
      // create a reversal ProfitEvent to mirror the change.
      try {
        if (isReturnedFlag && existing && existing.profit && Number(existing.profit) > 0) {
          await prisma.profitEvent.create({
            data: {
              marketplaceOrderId: existing.id,
              type: "REVERSE",
              amount: -Number(existing.profit),
            },
          });
        }
        // If this item is delivered and already has a buyingPrice set but no profit,
        // compute profit using stored fee/shipping and record a RECOGNISE event.
        const statusUpper = String(upsertResult.status ?? "").toUpperCase();
        const buyingPriceVal = upsertResult.buyingPrice ? Number(upsertResult.buyingPrice) : null;
        const existingProfitVal = upsertResult.profit ? Number(upsertResult.profit) : 0;
        if (!isReturnedFlag && (statusUpper.includes("DELIVER") || statusUpper === "DELIVERED") && buyingPriceVal !== null && (existingProfitVal === 0 || existingProfitVal === null)) {
          const computedProfit = Number(upsertResult.sellingPrice ?? 0) - (Number(upsertResult.sellerFee ?? feeVal) || feeVal) - (Number(upsertResult.shippingFee ?? shippingVal) || shippingVal) - buyingPriceVal;
          try {
            await prisma.marketplaceOrder.update({ where: { id: upsertResult.id }, data: { profit: computedProfit } });
            await prisma.profitEvent.create({ data: { marketplaceOrderId: upsertResult.id, type: "RECOGNISE", amount: computedProfit } });
          } catch (err) {
            console.warn("Failed to record computed profit for delivered marketplace order", err);
          }
        }
      } catch (err) {
        console.warn("Failed to create ProfitEvent reversal for returned order", err);
      }
      }
    }
  });
}

export async function upsertWeeklySaleEntry(
  shopId: string,
  platform: Platform,
  weekStart: Date,
  weekEnd: Date,
  amount: number,
) {
  // Upsert WeeklySale using the compound unique key: shopId_platform_weekStart_weekEnd
  try {
    await prisma.weeklySale.upsert({
      where: {
        shopId_platform_weekStart_weekEnd: {
          shopId,
          platform,
          weekStart,
          weekEnd,
        },
      },
      create: {
        shopId,
        platform,
        weekStart,
        weekEnd,
        amount: amount ?? 0,
        userId: null,
        status: WeeklySaleStatus.PENDING,
        source: WeeklySaleSource.AUTOMATIC,
        createdBy: null,
      },
      update: {
        // Update amount only; leave userId/status/source untouched so admins keep control.
        amount: amount ?? 0,
      },
    });
  } catch (err) {
    // Bubble up the error to caller for logging
    throw err;
  }
}

async function refreshJumiaToken(credentials: LoadedJumiaCredentials, apiBase: string): Promise<string> {
  const res = await fetch(new URL("/token", apiBase).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: (() => {
      const params = new URLSearchParams({
        client_id: credentials.clientId,
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
      });
      if (credentials.clientSecret) {
        params.set("client_secret", credentials.clientSecret);
      }
      return params;
    })(),
  });
  if (!res.ok) {
    throw new Error(`Failed to refresh Jumia token (${res.status})`);
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string };
  if (data.refresh_token && data.refresh_token !== credentials.refreshToken) {
    if (credentials.source === "env") {
      process.env.JUMIA_REFRESH_TOKEN = data.refresh_token;
    } else if (credentials.source === "db" && credentials.credentialId) {
      await prisma.apiCredential.update({
        where: { id: credentials.credentialId },
        data: { refreshToken: data.refresh_token },
      });
    }
  }
  return data.access_token;
}

async function fetchStatements(apiBase: string, authHeader: string, createdAfter: Date): Promise<JumiaStatement[]> {
  const url = new URL("/payout-statement", apiBase);
  url.searchParams.set("createdAfter", createdAfter.toISOString().split("T")[0]);
  url.searchParams.set("currency", "LOCAL");
  url.searchParams.set("paid", "true");
  url.searchParams.set("size", "1000");

  const res = await requestWithRetry(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) {
    throw new Error(`Failed to fetch payout statements (${res.status})`);
  }
  const data = (await res.json()) as { statements?: JumiaStatement[] };
  return data.statements ?? [];
}

async function fetchOrders(
  apiBase: string,
  authHeader: string,
  createdAfter: Date,
  createdBefore: Date,
): Promise<JumiaOrder[]> {
  const orders: JumiaOrder[] = [];
  let nextToken: string | null = null;

  do {
    const url = new URL("/orders", apiBase);
    url.searchParams.set("createdAfter", createdAfter.toISOString().split("T")[0]);
    url.searchParams.set("createdBefore", createdBefore.toISOString().split("T")[0]);
    url.searchParams.set("size", "200");
    if (nextToken) url.searchParams.set("token", nextToken);

    const res = await requestWithRetry(url.toString(), { headers: { Authorization: authHeader } });
    if (!res.ok) throw new Error(`Failed to fetch orders (${res.status})`);

    const data = (await res.json()) as { orders?: JumiaOrder[]; nextToken?: string | null; isLastPage?: boolean };
    if (data.orders?.length) orders.push(...data.orders);
    nextToken = data.nextToken ?? null;
    if (data.isLastPage) break;
  } while (nextToken);

  return orders;
}

async function fetchOrderItems(apiBase: string, authHeader: string, orderId: string): Promise<JumiaOrderItem[]> {
  const url = new URL("/orders/items", apiBase);
  url.searchParams.set("orderId", orderId);
  const res = await requestWithRetry(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Failed to fetch order items (${res.status})`);
  const data = (await res.json()) as { items?: JumiaOrderItem[] };
  return data.items ?? [];
}

function deriveWeekWindow(statement: JumiaStatement) {
  // Prefer using Jumia-provided period start when present. Normalize the
  // incoming date to a local Date at midnight and then compute the canonical
  // Monday->Sunday local window to avoid off-by-offset duplicates.
  const parsed = parseDateOnlyUtc(statement.period?.startDate);
  let baseDate: Date;
  if (parsed) {
    // convert UTC date-only to a local Date with same year/month/day
    baseDate = new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0);
  } else if (statement.createdAt) {
    baseDate = new Date(statement.createdAt);
  } else {
    baseDate = new Date();
  }
  return mondayToSundayLocalWindow(baseDate);
}

function getJumiaWeeklyPeriodFor(statement: JumiaStatement) {
  // Nairobi timezone is UTC+3 (no DST). We'll compute Nairobi local midnight
  // for a given date and convert to UTC for storage.
  const NAIR0BI_OFFSET_HOURS = 3;

  const dateStr = statement.period?.startDate ?? (statement.createdAt ? String(statement.createdAt).split("T")[0] : null);
  let y: number | undefined, m: number | undefined, d: number | undefined;
  if (dateStr) {
    const dateOnly = String(dateStr).split("T")[0];
    const parts = dateOnly.split("-").map((p) => Number(p));
    if (parts.length >= 3 && !Number.isNaN(parts[0])) {
      y = parts[0];
      m = parts[1];
      d = parts[2];
    }
  }
  if (y === undefined) {
    // Fallback: derive Nairobi date from `createdAt` or now
    const fallback = statement.createdAt ? new Date(statement.createdAt) : new Date();
    // Shift to Nairobi local time
    const nairobiMs = fallback.getTime() + NAIR0BI_OFFSET_HOURS * 3600 * 1000;
    const nairobi = new Date(nairobiMs);
    y = nairobi.getUTCFullYear();
    m = nairobi.getUTCMonth() + 1;
    d = nairobi.getUTCDate();
  }

  // Nairobi midnight in UTC = UTC timestamp for local midnight minus offset
  const nairobiMidnightUtcMs = Date.UTC(y!, m! - 1, d!, 0, 0, 0) - NAIR0BI_OFFSET_HOURS * 3600 * 1000;
  const nairobiMidnightUtc = new Date(nairobiMidnightUtcMs);

  // Determine day-of-week in Nairobi local terms
  const nairobiLocalMidnight = new Date(nairobiMidnightUtcMs + NAIR0BI_OFFSET_HOURS * 3600 * 1000);
  const day = nairobiLocalMidnight.getUTCDay(); // 0 == Sunday, 1 == Monday, ...
  const deltaToMonday = (day + 6) % 7; // days to subtract to reach Monday

  const mondayUtcMs = nairobiMidnightUtcMs - deltaToMonday * 24 * 3600 * 1000;
  const weekStart = new Date(mondayUtcMs);
  const weekEnd = new Date(mondayUtcMs + 7 * 24 * 3600 * 1000 - 1);

  return { weekStart, weekEnd };
}

// Automatic WeeklySale creation has been disabled so admins can manage overrides manually.
