"use server";

import { Platform, Prisma, WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadJumiaCredentials, type LoadedJumiaCredentials } from "@/lib/credentials/jumia";
import { mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { deriveStatementStatus } from "@/lib/statementStatus";
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
      statements = await fetchStatementsAll(apiBaseGlobal, authHeaderGlobal, createdAfter);
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
    if (statement.shopSid && mappedAccount.jumiaShopSid && statement.shopSid !== mappedAccount.jumiaShopSid) {
      console.error(
        `[onlineSync] SHOP_SID_MISMATCH statement ${statement.statementNumber} shopSid ${statement.shopSid} does not match account jumiaShopSid ${mappedAccount.jumiaShopSid} - skipping attribution`,
      );
      continue;
    }

    const statementNumber = (statement.statementNumber ?? "").trim();
    if (!statementNumber) {
      console.warn(
        `[onlineSync] Skipping statement without statementNumber for account ${mappedAccount.displayName ?? targetAccountId} shopSid ${stmtShopSid}`,
      );
      continue;
    }

    const { weekStart, weekEnd } = deriveWeekWindow(statement);
    const amountValue = Number(statement.payout?.amount ?? 0);
    const { isPaid } = deriveStatementStatus(statement.statementNumber, statement.paid);

    const shopRecord = mappedAccount.jumiaShopSid ? shopsByJumiaSid.get(mappedAccount.jumiaShopSid) : undefined;
    if (!shopRecord) {
      console.warn(
        `[onlineSync] No Shop record for marketplace account ${mappedAccount.displayName ?? mappedAccount.id} jumiaShopSid=${mappedAccount.jumiaShopSid}; skipping statement ${statement.statementNumber}`,
      );
      continue;
    }

    try {
      await prisma.marketplacePayoutWeek.upsert({
        where: {
          accountId_statementNumber: {
            accountId: targetAccountId,
            statementNumber,
          },
        },
        create: {
          accountId: targetAccountId,
          statementNumber,
          weekStart,
          weekEnd,
          grossSales: amountValue,
          payoutAmount: amountValue,
          currency: "LOCAL",
          isPaid,
          rawPayload: statement as unknown as Prisma.InputJsonValue,
        },
        update: {
          weekStart,
          weekEnd,
          grossSales: amountValue,
          payoutAmount: amountValue,
          isPaid,
          rawPayload: statement as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      console.warn('[onlineSync] Failed to upsert MarketplacePayoutWeek', err);
      continue;
    }

    try {
      await upsertWeeklySaleEntry(shopRecord.id, mappedAccount.platform, weekStart, weekEnd, amountValue);
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

function statementTimestamp(statement: JumiaStatement): number {
  const updated = (statement as any).updatedAt ?? statement.createdAt;
  if (updated) {
    const parsed = new Date(updated);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  return 0;
}

async function fetchStatementsForPaidFlag(
  apiBase: string,
  authHeader: string,
  createdAfter: Date,
  paidFlag: boolean,
): Promise<JumiaStatement[]> {
  const url = new URL("/payout-statement", apiBase);
  url.searchParams.set("createdAfter", createdAfter.toISOString().split("T")[0]);
  url.searchParams.set("currency", "LOCAL");
  url.searchParams.set("paid", paidFlag ? "true" : "false");
  url.searchParams.set("size", "1000");

  const res = await requestWithRetry(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) {
    throw new Error(`Failed to fetch payout statements (${res.status})`);
  }
  const data = (await res.json()) as { statements?: JumiaStatement[] };
  return data.statements ?? [];
}

async function fetchStatementsAll(apiBase: string, authHeader: string, createdAfter: Date): Promise<JumiaStatement[]> {
  const [paidStatements, unpaidStatements] = await Promise.all([
    fetchStatementsForPaidFlag(apiBase, authHeader, createdAfter, true),
    fetchStatementsForPaidFlag(apiBase, authHeader, createdAfter, false),
  ]);
  const statementMap = new Map<string, JumiaStatement>();
  for (const statement of [...paidStatements, ...unpaidStatements]) {
    const key = statement.statementNumber?.trim();
    if (!key) continue;
    const existing = statementMap.get(key);
    if (!existing) {
      statementMap.set(key, statement);
      continue;
    }
    const currentTs = statementTimestamp(statement);
    const existingTs = statementTimestamp(existing);
    if (currentTs >= existingTs) {
      statementMap.set(key, statement);
    }
  }
  return Array.from(statementMap.values());
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
  const parsed = parseDateOnlyUtc(statement.period?.startDate);
  const baseDate = parsed ?? (statement.createdAt ? new Date(statement.createdAt) : new Date());
  return mondayToSundayNairobiWindow(baseDate);
}

// Automatic WeeklySale creation has been disabled so admins can manage overrides manually.
