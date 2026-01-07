"use server";

import { Platform, Prisma, WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadJumiaCredentials, type LoadedJumiaCredentials } from "@/lib/credentials/jumia";
import { mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { deriveStatementStatus } from "@/lib/statementStatus";
import { requestWithRetry } from "@/lib/fetchWithRetry";

const DEFAULT_API_BASE = process.env.JUMIA_VENDOR_API_BASE ?? "https://vendor-api.jumia.com";
const DEFAULT_LOOKBACK_DAYS = 70;

/** Structured logs: never leave dangling console.warn( calls */
function logInfo(msg: string, meta?: Record<string, any>) {
  if (meta) console.info(msg, JSON.stringify(meta));
  else console.info(msg);
}
function logWarn(msg: string, meta?: Record<string, any>) {
  if (meta) console.warn(msg, JSON.stringify(meta));
  else console.warn(msg);
}
function logError(msg: string, meta?: Record<string, any>) {
  if (meta) console.error(msg, JSON.stringify(meta));
  else console.error(msg);
}

/** Standard stats returned by per-account statement ingestion. */
type StatementIngestStats = {
  accountId: string;
  displayName?: string | null;
  shopSid?: string | null;
  fetched: number;
  matched: number;
  upserted: number;
  placeholdersUpserted: number;
  weeksExpected: number;
  error?: string;
};

/**
 * Paste this EXACTLY inside your per-account statement ingest helper.
 * It replaces console.warn(...) with structured logging and returns valid stats.
 */
export async function guardAccountHasShopSid(account: { id: string; displayName?: string | null; jumiaShopSid?: string | null }): Promise<StatementIngestStats | null> {
  if (!account.jumiaShopSid) {
    logWarn("[onlineSync] account missing jumiaShopSid; cannot ingest payout statements", {
      accountId: account.id,
      displayName: account.displayName,
    });
    return {
      accountId: account.id,
      displayName: account.displayName ?? null,
      shopSid: null,
      fetched: 0,
      matched: 0,
      upserted: 0,
      placeholdersUpserted: 0,
      weeksExpected: 0,
      error: "MISSING_SHOP_SID",
    };
  }
  return null;
}

/**
 * Coverage aggregator to run after runWithConcurrency finishes.
 * Call with stats collected from each account worker.
 */
export async function logStatementCoverage(
  ingestStats: StatementIngestStats[],
  totalActiveAccounts: number,
): Promise<void> {
  const fetchedTotal = ingestStats.reduce((sum, s) => sum + (s.fetched ?? 0), 0);
  const matchedTotal = ingestStats.reduce((sum, s) => sum + (s.matched ?? 0), 0);
  const upsertedTotal = ingestStats.reduce((sum, s) => sum + (s.upserted ?? 0), 0);

  const placeholdersTotal = ingestStats.reduce((sum, s) => sum + (s.placeholdersUpserted ?? 0), 0);
  const weeksExpected = ingestStats[0]?.weeksExpected ?? 0;

  // “missing” is ONLY config/hard errors (NOT matched=0)
  const configMissingShopSid = ingestStats.filter((s) => s.error === "MISSING_SHOP_SID").length;
  const configMissingShopRecord = ingestStats.filter((s) => s.error === "MISSING_SHOP_RECORD").length;

  const hardErrors = ingestStats.filter(
    (s) => s.error && s.error !== "MISSING_SHOP_SID" && s.error !== "MISSING_SHOP_RECORD",
  ).length;

  const missingStatsRows = Math.max(totalActiveAccounts - ingestStats.length, 0);

  logInfo("[onlineSync] payout statements coverage", {
    totalActiveAccounts,
    statsRows: ingestStats.length,
    missingStatsRows,
    weeksExpected,
    placeholdersTotal,
    configMissingShopSid,
    configMissingShopRecord,
    hardErrors,
    fetchedTotal,
    matchedTotal,
    upsertedTotal,
  });

  const problemList = ingestStats
    .filter((s) => !!s.error)
    .map((s) => ({
      accountId: s.accountId,
      displayName: s.displayName,
      shopSid: s.shopSid,
      error: s.error,
      fetched: s.fetched,
      matched: s.matched,
      upserted: s.upserted,
    }));

  if (problemList.length) {
    logWarn("[onlineSync] payout statements coverage issues", { problemList });
  }

  if (missingStatsRows > 0) {
    logWarn("[onlineSync] payout statements missing stats rows for some active accounts", {
      totalActiveAccounts,
      statsRows: ingestStats.length,
      missingStatsRows,
    });
  }
}

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
  // ---- helpers local to this module ----
  const dec = (n: any) => new Prisma.Decimal(Number(n ?? 0));

  const dateOnlyISO = (d: Date) => d.toISOString().slice(0, 10);

  function buildWeekWindows(createdAfter: Date, createdBefore: Date) {
    const windows: Array<{ weekStart: Date; weekEnd: Date }> = [];
    let cursor = new Date(createdAfter);

    for (let guard = 0; guard < 400; guard++) {
      const { weekStart, weekEnd } = mondayToSundayNairobiWindow(cursor);
      const last = windows[windows.length - 1];
      if (!last || last.weekStart.getTime() !== weekStart.getTime()) {
        windows.push({ weekStart, weekEnd });
      }
      const next = new Date(weekEnd);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor = next;
      if (cursor > createdBefore) break;
    }
    return windows.filter((w) => w.weekEnd >= createdAfter && w.weekStart <= createdBefore);
  }

  function placeholderStatementNumber(accountId: string, weekStart: Date) {
    // deterministic + stable across runs
    return `AUTO:${accountId}:${dateOnlyISO(weekStart)}`;
  }

  async function upsertPayoutWeekPlaceholder(accountId: string, weekStart: Date, weekEnd: Date) {
    const statementNumber = placeholderStatementNumber(accountId, weekStart);
    await prisma.marketplacePayoutWeek.upsert({
      where: { accountId_statementNumber: { accountId, statementNumber } },
      create: {
        accountId,
        statementNumber,
        weekStart,
        weekEnd,
        grossSales: dec(0),
        payoutAmount: dec(0),
        currency: "KES",
        isPaid: false,
        rawPayload: { placeholder: true, source: "weekly_coverage", accountId, statementNumber } as any,
      },
      update: {
        weekStart,
        weekEnd,
        grossSales: dec(0),
        payoutAmount: dec(0),
        currency: "KES",
        isPaid: false,
        rawPayload: { placeholder: true, source: "weekly_coverage", accountId, statementNumber } as any,
      },
    });
  }

  // ---- time window ----
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
    const tmp = createdAfter;
    createdAfter = createdBefore;
    createdBefore = tmp;
  }

  const weekWindows = buildWeekWindows(createdAfter, createdBefore);

  logInfo("[onlineSync] starting", {
    createdAfter: createdAfter.toISOString(),
    createdBefore: createdBefore.toISOString(),
    weeks: weekWindows.length,
  });

  const activeAssignmentsWhere = { OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] };

  const jumiaAccounts: MarketplaceAccountWithAssignments[] = await prisma.marketplaceAccount.findMany({
    where: { platform: Platform.JUMIA, isActive: true },
    include: { assignments: { where: activeAssignmentsWhere, orderBy: { startsAt: "desc" } } },
  });

  const jumiaShops = await prisma.shop.findMany({
    where: { platform: Platform.JUMIA },
    select: { id: true, name: true, jumiaShopSid: true },
  });

  const shopsByJumiaSid = new Map<string, (typeof jumiaShops)[number]>();
  for (const s of jumiaShops) {
    if (s.jumiaShopSid) shopsByJumiaSid.set(s.jumiaShopSid, s);
  }

  // collect per-account ingest stats
  const ingestStats: StatementIngestStats[] = [];

  // NOTE: no “early return” just because shopSid is missing.
  // We still enforce placeholders so missing weeks NEVER happen.
  const accountShopSidIssue = (account: { id: string; displayName?: string | null; jumiaShopSid?: string | null }) => {
    if (!account.jumiaShopSid) {
      logWarn("[onlineSync] account missing jumiaShopSid; cannot match statements or map WeeklySale", {
        accountId: account.id,
        displayName: account.displayName,
      });
      return "MISSING_SHOP_SID";
    }
    return null;
  };

  async function fetchAndUpsertStatementsForAccount(
    account: MarketplaceAccountWithAssignments,
    credentials: LoadedJumiaCredentials,
  ): Promise<StatementIngestStats> {
    const sidIssue = accountShopSidIssue(account);

    const apiBaseStmt = credentials.baseUrl?.trim() || DEFAULT_API_BASE;
    const authSchemeStmt = credentials.authScheme?.trim() || process.env.JUMIA_AUTH_SCHEME?.trim() || "Bearer";

    let accessTokenStmt = "";
    try {
      accessTokenStmt = await refreshJumiaToken(credentials, apiBaseStmt);
    } catch (err) {
      logWarn("[onlineSync] token refresh failed for statements", {
        accountId: account.id,
        displayName: account.displayName,
        error: String(err),
      });
      return {
        accountId: account.id,
        displayName: account.displayName ?? null,
        shopSid: account.jumiaShopSid ?? null,
        fetched: 0,
        matched: 0,
        upserted: 0,
        placeholdersUpserted: 0,
        weeksExpected: weekWindows.length,
        error: sidIssue ?? "TOKEN_REFRESH_FAILED",
      };
    }

    const authHeaderStmt = `${authSchemeStmt} ${accessTokenStmt}`;

    let allStatements: JumiaStatement[] = [];
    try {
      allStatements = await fetchStatementsAll(apiBaseStmt, authHeaderStmt, createdAfter);
    } catch (err) {
      logWarn("[onlineSync] failed to fetch payout statements (will rely on placeholders)", {
        accountId: account.id,
        displayName: account.displayName,
        error: String(err),
      });
      allStatements = [];
    }

    const matchedStatements = allStatements.filter(
      (s) => s?.shopSid && account.jumiaShopSid && s.shopSid === account.jumiaShopSid,
    );

    const shopRecord = account.jumiaShopSid ? shopsByJumiaSid.get(account.jumiaShopSid) : null;
    if (account.jumiaShopSid && !shopRecord) {
      logWarn("[onlineSync] No Shop record for jumiaShopSid; WeeklySale will be skipped", {
        accountId: account.id,
        displayName: account.displayName,
        jumiaShopSid: account.jumiaShopSid,
      });
    }

    let upserted = 0;

    for (const statement of matchedStatements) {
      const statementNumber = (statement.statementNumber ?? "").trim();
      if (!statementNumber) {
        logWarn("[onlineSync] skipping statement without statementNumber", {
          accountId: account.id,
          displayName: account.displayName,
        });
        continue;
      }

      const { weekStart, weekEnd } = deriveWeekWindow(statement);
      const amountValue = Number(statement.payout?.amount ?? 0);
      const { isPaid } = deriveStatementStatus(statement.statementNumber, statement.paid);

      try {
        await prisma.marketplacePayoutWeek.upsert({
          where: { accountId_statementNumber: { accountId: account.id, statementNumber } },
          create: {
            accountId: account.id,
            statementNumber,
            weekStart,
            weekEnd,
            grossSales: dec(amountValue),
            payoutAmount: dec(amountValue),
            currency: "LOCAL",
            isPaid,
            rawPayload: statement as any,
          },
          update: {
            weekStart,
            weekEnd,
            grossSales: dec(amountValue),
            payoutAmount: dec(amountValue),
            isPaid,
            rawPayload: statement as any,
          },
        });
        upserted += 1;
      } catch (err) {
        logWarn("[onlineSync] failed to upsert MarketplacePayoutWeek (real)", {
          accountId: account.id,
          statementNumber,
          error: String(err),
        });
        continue;
      }

      // Only if shop mapping exists
      if (shopRecord) {
        try {
          await upsertWeeklySaleEntry(shopRecord.id, account.platform, weekStart, weekEnd, amountValue);
        } catch (err) {
          logWarn("[onlineSync] failed to upsert WeeklySale for payout week (real)", {
            accountId: account.id,
            statementNumber,
            error: String(err),
          });
        }
      }
    }

    // Enforce placeholders for ALL weeks in window (always)
    let placeholdersUpserted = 0;
    for (const w of weekWindows) {
      try {
        await upsertPayoutWeekPlaceholder(account.id, w.weekStart, w.weekEnd);
        placeholdersUpserted += 1;
      } catch (err) {
        logWarn("[onlineSync] failed to upsert payout week placeholder", {
          accountId: account.id,
          weekStart: w.weekStart.toISOString(),
          error: String(err),
        });
      }

      // WeeklySale placeholders only when shopRecord exists
      if (shopRecord) {
        try {
          await upsertWeeklySaleEntry(shopRecord.id, Platform.JUMIA, w.weekStart, w.weekEnd, 0);
        } catch (err) {
          logWarn("[onlineSync] failed to upsert WeeklySale placeholder", {
            accountId: account.id,
            shopId: shopRecord.id,
            weekStart: w.weekStart.toISOString(),
            error: String(err),
          });
        }
      }
    }

    // Define “missing” only as config/hard errors, not “matched=0”
    const error =
      sidIssue ?? (account.jumiaShopSid && !shopRecord ? "MISSING_SHOP_RECORD" : undefined);

    const stats: StatementIngestStats = {
      accountId: account.id,
      displayName: account.displayName ?? null,
      shopSid: account.jumiaShopSid ?? null,
      fetched: allStatements.length,
      matched: matchedStatements.length,
      upserted,
      placeholdersUpserted,
      weeksExpected: weekWindows.length,
      error,
    };

    logInfo("[onlineSync] payout statements summary", stats);
    return stats;
  }

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
          logError("[onlineSync] account worker error", { error: String(err) });
        }
      }
    }
    const parallel = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: parallel }, () => runner()));
  }

  await runWithConcurrency(jumiaAccounts, 2, async (account) => {
    // credentials: per-account first, fallback global
    let credentialsForAccount: LoadedJumiaCredentials | null = null;
    try {
      credentialsForAccount = await loadJumiaCredentials(`MARKETPLACE_ACCOUNT:${account.id}`);
    } catch (err) {
      try {
        credentialsForAccount = await loadJumiaCredentials();
      } catch (err2) {
        logWarn("[onlineSync] no Jumia credentials; skipping account", {
          accountId: account.id,
          displayName: account.displayName ?? account.id,
        });
        ingestStats.push({
          accountId: account.id,
          displayName: account.displayName ?? null,
          shopSid: account.jumiaShopSid ?? null,
          fetched: 0,
          matched: 0,
          upserted: 0,
          placeholdersUpserted: 0,
          weeksExpected: weekWindows.length,
          error: "NO_CREDENTIALS",
        });
        return;
      }
    }

    // statements + placeholders
    try {
      const stats = await fetchAndUpsertStatementsForAccount(account, credentialsForAccount);
      ingestStats.push(stats);
    } catch (err) {
      logError("[onlineSync] statements ingest failed", { accountId: account.id, error: String(err) });
      ingestStats.push({
        accountId: account.id,
        displayName: account.displayName ?? null,
        shopSid: account.jumiaShopSid ?? null,
        fetched: 0,
        matched: 0,
        upserted: 0,
        placeholdersUpserted: 0,
        weeksExpected: weekWindows.length,
        error: "STATEMENTS_INGEST_FAILED",
      });
    }

    // orders/items + profit logic
    const apiBaseAcct = credentialsForAccount.baseUrl?.trim() || DEFAULT_API_BASE;
    const authSchemeAcct = credentialsForAccount.authScheme?.trim() || process.env.JUMIA_AUTH_SCHEME?.trim() || "Bearer";

    let accessTokenAcct = "";
    try {
      accessTokenAcct = await refreshJumiaToken(credentialsForAccount, apiBaseAcct);
    } catch (err) {
      logWarn("[onlineSync] token refresh failed for orders", {
        accountId: account.id,
        displayName: account.displayName,
        error: String(err),
      });
      return;
    }
    const authHeaderAcct = `${authSchemeAcct} ${accessTokenAcct}`;

    let orders: JumiaOrder[] = [];
    try {
      orders = await fetchOrders(apiBaseAcct, authHeaderAcct, createdAfter, createdBefore);
    } catch (err) {
      logWarn("[onlineSync] failed to fetch orders for account", {
        accountId: account.id,
        displayName: account.displayName,
        error: String(err),
      });
      return;
    }

    let itemsFetched = 0;

    for (const order of orders) {
      const shopSid = order.shopIds?.[0];
      if (account.jumiaShopSid && shopSid && shopSid !== account.jumiaShopSid) continue;

      let items: JumiaOrderItem[] = [];
      try {
        items = await fetchOrderItems(apiBaseAcct, authHeaderAcct, order.id);
      } catch (err) {
        logWarn("[onlineSync] failed to fetch order items", {
          accountId: account.id,
          orderId: order.id,
          error: String(err),
        });
        continue;
      }

      itemsFetched += items.length;

      for (const item of items) {
        const sellingPriceLocal = Number(item.paidPriceLocal ?? item.itemPriceLocal ?? 0);
        const statusStr = typeof item.status === "string" ? item.status : String(item.status ?? "");
        const statusUpper = statusStr.toUpperCase();
        const isReturnedFlag = statusUpper.startsWith("RETURN") || statusUpper === "FAILED";

        // fees/shipping from raw payload
        const rawItem: any = item as any;
        const feeVal = Number((rawItem?.seller_fee?.amount ?? rawItem?.seller_fee_amount ?? 0) || 0);
        const shippingVal = Number((rawItem?.shipping_fee?.amount ?? rawItem?.shipping_fee_amount ?? 0) || 0);

        // existing record needed for reversal amount
        const existing = await prisma.marketplaceOrder.findUnique({ where: { id: item.id } });

        const upserted = await prisma.marketplaceOrder.upsert({
          where: { id: item.id },
          create: {
            id: item.id,
            accountId: account.id,
            platform: Platform.JUMIA,
            orderId: String(order.number ?? order.id),
            orderItemId: item.id,
            status: item.status,
            orderedAt: new Date(order.createdAt),
            productName: item.product?.name ?? "Unknown product",
            productUrl: item.product?.sellerSku ? `https://www.jumia.co.ke/${item.product.sellerSku}` : undefined,
            sellingPrice: sellingPriceLocal,
            currency: item.country?.currencyCode ?? "KES",
            isReturned: isReturnedFlag,
            sellerFee: feeVal,
            shippingFee: shippingVal,
            rawPayload: item as any,
          },
          update: {
            status: item.status,
            sellingPrice: sellingPriceLocal,
            currency: item.country?.currencyCode ?? "KES",
            isReturned: isReturnedFlag,
            sellerFee: feeVal,
            shippingFee: shippingVal,
            // clear profit on return; otherwise keep profit as-is
            profit: isReturnedFlag ? 0 : undefined,
            rawPayload: item as any,
          },
        });

        // PROFIT EVENTS — rely on @@unique([marketplaceOrderId, type]) and ignore P2002
        try {
          if (isReturnedFlag) {
            const prevProfit = existing?.profit ? Number(existing.profit) : 0;
            if (prevProfit > 0) {
              try {
                await prisma.profitEvent.create({
                  data: {
                    marketplaceOrderId: upserted.id,
                    type: "REVERSE",
                    amount: dec(0).minus(dec(prevProfit)),
                  },
                });
              } catch (e: any) {
                if (e?.code !== "P2002") {
                  logWarn("[onlineSync] failed to create REVERSE ProfitEvent", {
                    marketplaceOrderId: upserted.id,
                    error: String(e),
                  });
                }
              }
            }
            continue;
          }

          const delivered = statusUpper.includes("DELIVER") || statusUpper === "DELIVERED";
          const buyingPriceVal = upserted.buyingPrice ? Number(upserted.buyingPrice) : null;
          const profitVal = upserted.profit == null ? null : Number(upserted.profit);

          if (delivered && buyingPriceVal !== null && (profitVal === null || profitVal === 0)) {
            const sellerFeeToUse =
              upserted.sellerFee != null ? Number(upserted.sellerFee) : feeVal;
            const shipFeeToUse =
              upserted.shippingFee != null ? Number(upserted.shippingFee) : shippingVal;

            const computedProfit =
              Number(upserted.sellingPrice ?? 0) -
              Number(sellerFeeToUse ?? 0) -
              Number(shipFeeToUse ?? 0) -
              buyingPriceVal;

            await prisma.marketplaceOrder.update({
              where: { id: upserted.id },
              data: { profit: computedProfit },
            });

            try {
              await prisma.profitEvent.create({
                data: {
                  marketplaceOrderId: upserted.id,
                  type: "RECOGNISE",
                  amount: dec(computedProfit),
                },
              });
            } catch (e: any) {
              if (e?.code !== "P2002") {
                logWarn("[onlineSync] failed to create RECOGNISE ProfitEvent", {
                  marketplaceOrderId: upserted.id,
                  error: String(e),
                });
              }
            }
          }
        } catch (err) {
          logWarn("[onlineSync] ProfitEvent handling failed", { marketplaceOrderId: item.id, error: String(err) });
        }
      }
    }

    logInfo("[onlineSync] account sync summary", {
      accountId: account.id,
      displayName: account.displayName,
      ordersFetched: orders.length,
      itemsFetched,
    });
  });

  await logStatementCoverage(ingestStats, jumiaAccounts.length);
  logInfo("[onlineSync] finished", { accounts: jumiaAccounts.length });
}

export async function upsertWeeklySaleEntry(
  shopId: string,
  platform: Platform,
  weekStart: Date,
  weekEnd: Date,
  amount: number,
) {
  const key = { shopId, platform, weekStart, weekEnd };
  const existing = await prisma.weeklySale.findUnique({
    where: { shopId_platform_weekStart_weekEnd: key },
  });

  const amountDec = new Prisma.Decimal(Number(amount ?? 0));

  if (!existing) {
    await prisma.weeklySale.create({
      data: {
        ...key,
        amount: amountDec,
        userId: null,
        status: WeeklySaleStatus.PENDING,
        source: WeeklySaleSource.AUTOMATIC,
        createdBy: null,
        approvedBy: null,
      },
    });
    return;
  }

  const isManualOverride =
    existing.source === WeeklySaleSource.MANUAL ||
    existing.createdBy !== null ||
    existing.userId !== null ||
    existing.approvedBy !== null;

  if (isManualOverride) return;

  await prisma.weeklySale.update({
    where: { shopId_platform_weekStart_weekEnd: key },
    data: { amount: amountDec },
  });
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
