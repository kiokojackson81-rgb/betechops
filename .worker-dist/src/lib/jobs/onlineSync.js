"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardAccountHasShopSid = guardAccountHasShopSid;
exports.logStatementCoverage = logStatementCoverage;
exports.syncOnlineMarketplaceData = syncOnlineMarketplaceData;
exports.upsertWeeklySaleEntry = upsertWeeklySaleEntry;
exports.ensureWeeklySalePlaceholder = ensureWeeklySalePlaceholder;
const client_1 = require("@prisma/client");
const logging_1 = require("@/lib/logging");
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/credentials/jumia");
const weekWindow_1 = require("@/lib/weekWindow");
const statementStatus_1 = require("@/lib/statementStatus");
const fetchWithRetry_1 = require("@/lib/fetchWithRetry");
const DEFAULT_API_BASE = process.env.JUMIA_VENDOR_API_BASE ?? "https://vendor-api.jumia.com";
const DEFAULT_LOOKBACK_DAYS = Number(process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS ?? 70);
const TIME_BUDGET_MS = 260000;
const dateOnlyISO = (d) => d.toISOString().slice(0, 10);
/**
 * Paste this EXACTLY inside your per-account statement ingest helper.
 * It replaces console.warn(...) with structured logging and returns valid stats.
 */
async function guardAccountHasShopSid(account) {
    if (!account.jumiaShopSid) {
        (0, logging_1.logWarn)("[onlineSync] account missing jumiaShopSid; cannot ingest payout statements", {
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
async function logStatementCoverage(ingestStats, totalActiveAccounts) {
    const fetchedTotal = ingestStats.reduce((sum, s) => sum + (s.fetched ?? 0), 0);
    const matchedTotal = ingestStats.reduce((sum, s) => sum + (s.matched ?? 0), 0);
    const upsertedTotal = ingestStats.reduce((sum, s) => sum + (s.upserted ?? 0), 0);
    const placeholdersTotal = ingestStats.reduce((sum, s) => sum + (s.placeholdersUpserted ?? 0), 0);
    const weeksExpected = ingestStats[0]?.weeksExpected ?? 0;
    // “missing” is ONLY config/hard errors (NOT matched=0)
    const configMissingShopSid = ingestStats.filter((s) => s.error === "MISSING_SHOP_SID").length;
    const configMissingShopRecord = ingestStats.filter((s) => s.error === "MISSING_SHOP_RECORD").length;
    const hardErrors = ingestStats.filter((s) => s.error && s.error !== "MISSING_SHOP_SID" && s.error !== "MISSING_SHOP_RECORD").length;
    const missingStatsRows = Math.max(totalActiveAccounts - ingestStats.length, 0);
    (0, logging_1.logInfo)("[onlineSync] payout statements coverage", {
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
        (0, logging_1.logWarn)("[onlineSync] payout statements coverage issues", { problemList });
    }
    if (missingStatsRows > 0) {
        (0, logging_1.logWarn)("[onlineSync] payout statements missing stats rows for some active accounts", {
            totalActiveAccounts,
            statsRows: ingestStats.length,
            missingStatsRows,
        });
    }
}
async function syncOnlineMarketplaceData(opts) {
    try {
        // ---- helpers local to this module ----
        const dec = (n) => new client_1.Prisma.Decimal(Number(n ?? 0));
        function buildWeekWindows(createdAfter, createdBefore) {
            const windows = [];
            let cursor = new Date(createdAfter);
            for (let guard = 0; guard < 400; guard++) {
                const normalized = (0, weekWindow_1.mondayToSundayNairobiWindow)(cursor);
                const last = windows[windows.length - 1];
                if (!last || last.weekStart.getTime() !== normalized.weekStart.getTime()) {
                    windows.push(normalized);
                }
                const next = new Date(normalized.weekEnd);
                next.setUTCDate(next.getUTCDate() + 1);
                cursor = next;
                if (cursor > createdBefore)
                    break;
            }
            return windows.filter((w) => w.weekEnd >= createdAfter && w.weekStart <= createdBefore);
        }
        function placeholderStatementNumber(accountId, weekStart) {
            // deterministic + stable across runs
            return `AUTO:${accountId}:${dateOnlyISO(weekStart)}`;
        }
        async function upsertPayoutWeekPlaceholder(accountId, weekStart, weekEnd) {
            const { weekStart: normalizedStart, weekEnd: normalizedEnd } = (0, weekWindow_1.mondayToSundayNairobiWindow)(weekStart);
            const statementNumber = placeholderStatementNumber(accountId, normalizedStart);
            await prisma_1.prisma.marketplacePayoutWeek.upsert({
                where: { accountId_statementNumber: { accountId, statementNumber } },
                create: {
                    accountId,
                    statementNumber,
                    weekStart: normalizedStart,
                    weekEnd: normalizedEnd,
                    grossSales: dec(0),
                    payoutAmount: dec(0),
                    currency: "KES",
                    isPaid: false,
                    rawPayload: { placeholder: true, source: "weekly_coverage", accountId, statementNumber },
                },
                update: {
                    weekStart: normalizedStart,
                    weekEnd: normalizedEnd,
                    grossSales: dec(0),
                    payoutAmount: dec(0),
                    currency: "KES",
                    isPaid: false,
                    rawPayload: { placeholder: true, source: "weekly_coverage", accountId, statementNumber },
                },
            });
        }
        async function ensureAccountPlaceholders(accountId, shopRecord) {
            let count = 0;
            (0, logging_1.logInfo)("[onlineSync] ensuring placeholders", {
                accountId,
                weeks: weekWindows.length,
                hasShop: !!shopRecord,
            });
            for (const w of weekWindows) {
                const normalizedWeekStart = w.weekStart;
                const normalizedWeekEnd = w.weekEnd;
                try {
                    await upsertPayoutWeekPlaceholder(accountId, normalizedWeekStart, normalizedWeekEnd);
                    count += 1;
                }
                catch (err) {
                    (0, logging_1.logWarn)("[onlineSync] failed to upsert payout week placeholder", {
                        accountId,
                        weekStart: normalizedWeekStart.toISOString(),
                        error: String(err),
                    });
                }
                if (shopRecord) {
                    try {
                        await ensureWeeklySalePlaceholder(shopRecord.id, client_1.Platform.JUMIA, normalizedWeekStart, normalizedWeekEnd);
                    }
                    catch (err) {
                        (0, logging_1.logWarn)("[onlineSync] failed to upsert WeeklySale placeholder", {
                            accountId,
                            shopId: shopRecord.id,
                            weekStart: normalizedWeekStart.toISOString(),
                            error: String(err),
                        });
                    }
                }
            }
            (0, logging_1.logInfo)("[onlineSync] placeholders ensured", { accountId, upserted: count });
            return count;
        }
        async function ensureShopForAccount(account) {
            if (!account.jumiaShopSid)
                return null;
            const existing = shopsByJumiaSid.get(account.jumiaShopSid);
            if (existing)
                return existing;
            try {
                const upserted = await prisma_1.prisma.shop.upsert({
                    where: {
                        platform_jumiaShopSid: {
                            platform: client_1.Platform.JUMIA,
                            jumiaShopSid: account.jumiaShopSid,
                        },
                    },
                    create: {
                        name: account.displayName ?? `Jumia Shop ${account.jumiaShopSid}`,
                        platform: client_1.Platform.JUMIA,
                        jumiaShopSid: account.jumiaShopSid,
                        isActive: true,
                    },
                    update: {
                        name: account.displayName ?? `Jumia Shop ${account.jumiaShopSid}`,
                    },
                });
                shopsByJumiaSid.set(account.jumiaShopSid, upserted);
                (0, logging_1.logInfo)('[onlineSync] created missing Shop for jumiaShopSid', {
                    accountId: account.id,
                    displayName: account.displayName,
                    jumiaShopSid: account.jumiaShopSid,
                    shopId: upserted.id,
                });
                return upserted;
            }
            catch (err) {
                (0, logging_1.logWarn)('[onlineSync] failed to create Shop for jumiaShopSid', {
                    accountId: account.id,
                    jumiaShopSid: account.jumiaShopSid,
                    error: String(err),
                });
                return null;
            }
        }
        // ---- time window ----
        const lookbackDays = opts?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
        let createdBefore = opts?.periodEnd ?? new Date();
        let createdAfter = opts?.periodStart ??
            (() => {
                const base = new Date(createdBefore);
                base.setDate(base.getDate() - lookbackDays);
                return base;
            })();
        if (createdAfter > createdBefore) {
            const tmp = createdAfter;
            createdAfter = createdBefore;
            createdBefore = tmp;
        }
        const weekWindows = buildWeekWindows(createdAfter, createdBefore);
        (0, logging_1.logInfo)("[onlineSync] starting", {
            createdAfter: createdAfter.toISOString(),
            createdBefore: createdBefore.toISOString(),
            weeks: weekWindows.length,
        });
        const startedAt = Date.now();
        let partial = false;
        const checkTimeBudget = () => {
            if (Date.now() - startedAt > TIME_BUDGET_MS) {
                if (!partial) {
                    (0, logging_1.logWarn)("[onlineSync] time budget exceeded; stopping early", {
                        maxMs: TIME_BUDGET_MS,
                    });
                }
                partial = true;
                return true;
            }
            return false;
        };
        const activeAssignmentsWhere = { OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] };
        const jumiaAccounts = await prisma_1.prisma.marketplaceAccount.findMany({
            where: { platform: client_1.Platform.JUMIA, isActive: true },
            include: { assignments: { where: activeAssignmentsWhere, orderBy: { startsAt: "desc" } } },
        });
        const jumiaShops = await prisma_1.prisma.shop.findMany({
            where: { platform: client_1.Platform.JUMIA },
            select: { id: true, name: true, jumiaShopSid: true },
        });
        const shopsByJumiaSid = new Map();
        for (const s of jumiaShops) {
            if (s.jumiaShopSid)
                shopsByJumiaSid.set(s.jumiaShopSid, s);
        }
        // collect per-account ingest stats
        const ingestStats = [];
        // NOTE: no “early return” just because shopSid is missing.
        // We still enforce placeholders so missing weeks NEVER happen.
        const accountShopSidIssue = (account) => {
            if (!account.jumiaShopSid) {
                (0, logging_1.logWarn)("[onlineSync] account missing jumiaShopSid; cannot match statements or map WeeklySale", {
                    accountId: account.id,
                    displayName: account.displayName,
                });
                return "MISSING_SHOP_SID";
            }
            return null;
        };
        async function fetchAndUpsertStatementsForAccount(account, credentials) {
            const sidIssue = accountShopSidIssue(account);
            const apiBaseStmt = credentials.baseUrl?.trim() || DEFAULT_API_BASE;
            const authSchemeStmt = credentials.authScheme?.trim() || process.env.JUMIA_AUTH_SCHEME?.trim() || "Bearer";
            let accessTokenStmt = "";
            try {
                accessTokenStmt = await refreshJumiaToken(credentials, apiBaseStmt);
            }
            catch (err) {
                (0, logging_1.logWarn)("[onlineSync] token refresh failed for statements", {
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
            let allStatements = [];
            try {
                allStatements = await fetchStatementsAll(apiBaseStmt, authHeaderStmt, createdAfter);
            }
            catch (err) {
                (0, logging_1.logWarn)("[onlineSync] failed to fetch payout statements (will rely on placeholders)", {
                    accountId: account.id,
                    displayName: account.displayName,
                    error: String(err),
                });
                allStatements = [];
            }
            const matchedStatements = allStatements;
            const distinctShopSid = Array.from(new Set(allStatements.map((s) => s.shopSid).filter((v) => Boolean(v))));
            (0, logging_1.logInfo)("[onlineSync] statements fetched breakdown", {
                accountId: account.id,
                fetched: allStatements.length,
                distinctShopSid,
            });
            const shopRecord = account.jumiaShopSid ? shopsByJumiaSid.get(account.jumiaShopSid) : null;
            if (account.jumiaShopSid && !shopRecord) {
                (0, logging_1.logWarn)("[onlineSync] No Shop record for jumiaShopSid; WeeklySale will be skipped", {
                    accountId: account.id,
                    displayName: account.displayName,
                    jumiaShopSid: account.jumiaShopSid,
                });
            }
            let upserted = 0;
            for (const statement of matchedStatements) {
                const statementNumber = (statement.statementNumber ?? "").trim();
                if (!statementNumber) {
                    (0, logging_1.logWarn)("[onlineSync] skipping statement without statementNumber", {
                        accountId: account.id,
                        displayName: account.displayName,
                    });
                    continue;
                }
                const { weekStart, weekEnd } = deriveWeekWindow(statement);
                const { weekStart: normalizedWeekStart, weekEnd: normalizedWeekEnd } = (0, weekWindow_1.mondayToSundayNairobiWindow)(weekStart);
                const amountValue = Number(statement.payout?.amount ?? 0);
                const { isPaid } = (0, statementStatus_1.deriveStatementStatus)(statement.statementNumber, statement.paid);
                try {
                    await prisma_1.prisma.marketplacePayoutWeek.deleteMany({
                        where: {
                            accountId: account.id,
                            weekStart: normalizedWeekStart,
                            rawPayload: { path: ["placeholder"], equals: true },
                        },
                    });
                    await prisma_1.prisma.marketplacePayoutWeek.upsert({
                        where: { accountId_statementNumber: { accountId: account.id, statementNumber } },
                        create: {
                            accountId: account.id,
                            statementNumber,
                            weekStart: normalizedWeekStart,
                            weekEnd: normalizedWeekEnd,
                            grossSales: dec(amountValue),
                            payoutAmount: dec(amountValue),
                            currency: "KES",
                            isPaid,
                            rawPayload: statement,
                        },
                        update: {
                            weekStart: normalizedWeekStart,
                            weekEnd: normalizedWeekEnd,
                            grossSales: dec(amountValue),
                            payoutAmount: dec(amountValue),
                            isPaid,
                            rawPayload: statement,
                            currency: "KES",
                        },
                    });
                    upserted += 1;
                }
                catch (err) {
                    (0, logging_1.logWarn)("[onlineSync] failed to upsert MarketplacePayoutWeek (real)", {
                        accountId: account.id,
                        statementNumber,
                        error: String(err),
                    });
                    continue;
                }
                const statementShopRecord = statement.shopSid ? shopsByJumiaSid.get(statement.shopSid) : null;
                const targetShopRecord = statementShopRecord ?? shopRecord;
                if (targetShopRecord) {
                    try {
                        await upsertWeeklySaleEntry(targetShopRecord.id, account.platform, normalizedWeekStart, normalizedWeekEnd, amountValue);
                    }
                    catch (err) {
                        (0, logging_1.logWarn)("[onlineSync] failed to upsert WeeklySale for payout week (real)", {
                            accountId: account.id,
                            statementNumber,
                            error: String(err),
                        });
                    }
                }
            }
            const error = sidIssue ?? (account.jumiaShopSid && !shopRecord ? "MISSING_SHOP_RECORD" : undefined);
            const stats = {
                accountId: account.id,
                displayName: account.displayName ?? null,
                shopSid: account.jumiaShopSid ?? null,
                fetched: allStatements.length,
                matched: matchedStatements.length,
                upserted,
                placeholdersUpserted: 0,
                weeksExpected: weekWindows.length,
                error,
            };
            (0, logging_1.logInfo)("[onlineSync] payout statements summary", stats);
            return stats;
        }
        async function runWithConcurrency(items, limit, worker) {
            let idx = 0;
            async function runner() {
                while (true) {
                    if (checkTimeBudget())
                        return;
                    const i = idx++;
                    if (i >= items.length)
                        return;
                    const it = items[i];
                    try {
                        await worker(it);
                    }
                    catch (err) {
                        (0, logging_1.logError)("[onlineSync] account worker error", { error: String(err) });
                    }
                }
            }
            const parallel = Math.min(limit, items.length);
            await Promise.all(Array.from({ length: parallel }, () => runner()));
        }
        await runWithConcurrency(jumiaAccounts, 2, async (account) => {
            if (checkTimeBudget())
                return;
            const accountShopRecord = account.jumiaShopSid
                ? shopsByJumiaSid.get(account.jumiaShopSid) ?? (await ensureShopForAccount(account))
                : null;
            const placeholdersUpserted = await ensureAccountPlaceholders(account.id, accountShopRecord);
            // credentials: per-account first, fallback global
            let credentialsForAccount = null;
            try {
                credentialsForAccount = await (0, jumia_1.loadJumiaCredentials)(`MARKETPLACE_ACCOUNT:${account.id}`);
            }
            catch (err) {
                try {
                    credentialsForAccount = await (0, jumia_1.loadJumiaCredentials)();
                }
                catch (err2) {
                    (0, logging_1.logWarn)("[onlineSync] no Jumia credentials; skipping account", {
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
                        placeholdersUpserted,
                        weeksExpected: weekWindows.length,
                        error: "NO_CREDENTIALS",
                    });
                    return;
                }
            }
            // statements + placeholders
            if (checkTimeBudget()) {
                ingestStats.push({
                    accountId: account.id,
                    displayName: account.displayName ?? null,
                    shopSid: account.jumiaShopSid ?? null,
                    fetched: 0,
                    matched: 0,
                    upserted: 0,
                    placeholdersUpserted,
                    weeksExpected: weekWindows.length,
                    error: "TIME_BUDGET_EXCEEDED",
                });
                return;
            }
            try {
                const stats = await fetchAndUpsertStatementsForAccount(account, credentialsForAccount);
                stats.placeholdersUpserted = placeholdersUpserted;
                ingestStats.push(stats);
            }
            catch (err) {
                (0, logging_1.logError)("[onlineSync] statements ingest failed", { accountId: account.id, error: String(err) });
                ingestStats.push({
                    accountId: account.id,
                    displayName: account.displayName ?? null,
                    shopSid: account.jumiaShopSid ?? null,
                    fetched: 0,
                    matched: 0,
                    upserted: 0,
                    placeholdersUpserted,
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
            }
            catch (err) {
                (0, logging_1.logWarn)("[onlineSync] token refresh failed for orders", {
                    accountId: account.id,
                    displayName: account.displayName,
                    error: String(err),
                });
                return;
            }
            const authHeaderAcct = `${authSchemeAcct} ${accessTokenAcct}`;
            let orders = [];
            try {
                orders = await fetchOrders(apiBaseAcct, authHeaderAcct, createdAfter, createdBefore);
                (0, logging_1.logInfo)("[onlineSync] sample order", {
                    accountId: account.id,
                    sample: orders[0]
                        ? {
                            id: orders[0].id,
                            number: orders[0].number,
                            createdAt: orders[0].createdAt,
                            shopIds: orders[0].shopIds,
                        }
                        : null,
                });
            }
            catch (err) {
                (0, logging_1.logWarn)("[onlineSync] failed to fetch orders for account", {
                    accountId: account.id,
                    displayName: account.displayName,
                    error: String(err),
                });
                return;
            }
            let itemsFetched = 0;
            for (const order of orders) {
                if (checkTimeBudget()) {
                    return;
                }
                const shopSid = order.shopIds?.[0];
                if (account.jumiaShopSid && shopSid && shopSid !== account.jumiaShopSid)
                    continue;
                let items = [];
                try {
                    items = await fetchOrderItems(apiBaseAcct, authHeaderAcct, order.id);
                }
                catch (err) {
                    (0, logging_1.logWarn)("[onlineSync] failed to fetch order items", {
                        accountId: account.id,
                        orderId: order.id,
                        error: String(err),
                    });
                    continue;
                }
                itemsFetched += items.length;
                for (const item of items) {
                    if (checkTimeBudget()) {
                        return;
                    }
                    const sellingPriceLocal = Number(item.paidPriceLocal ?? item.itemPriceLocal ?? 0);
                    const statusStr = typeof item.status === "string" ? item.status : String(item.status ?? "");
                    const statusUpper = statusStr.toUpperCase();
                    const isReturnedFlag = statusUpper.startsWith("RETURN") || statusUpper === "FAILED";
                    // fees/shipping from raw payload
                    const rawItem = item;
                    const feeVal = Number((rawItem?.seller_fee?.amount ?? rawItem?.seller_fee_amount ?? 0) || 0);
                    const shippingVal = Number((rawItem?.shipping_fee?.amount ?? rawItem?.shipping_fee_amount ?? 0) || 0);
                    // existing record needed for reversal amount
                    const existing = await prisma_1.prisma.marketplaceOrder.findUnique({ where: { id: item.id } });
                    const upserted = await prisma_1.prisma.marketplaceOrder.upsert({
                        where: { id: item.id },
                        create: {
                            id: item.id,
                            accountId: account.id,
                            platform: client_1.Platform.JUMIA,
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
                            rawPayload: item,
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
                            rawPayload: item,
                        },
                    });
                    // PROFIT EVENTS — rely on @@unique([marketplaceOrderId, type]) and ignore P2002
                    try {
                        if (isReturnedFlag) {
                            const prevProfit = existing?.profit ? Number(existing.profit) : 0;
                            if (prevProfit > 0) {
                                try {
                                    await prisma_1.prisma.profitEvent.create({
                                        data: {
                                            marketplaceOrderId: upserted.id,
                                            type: "REVERSE",
                                            amount: dec(0).minus(dec(prevProfit)),
                                        },
                                    });
                                }
                                catch (e) {
                                    if (e?.code !== "P2002") {
                                        (0, logging_1.logWarn)("[onlineSync] failed to create REVERSE ProfitEvent", {
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
                            const sellerFeeToUse = upserted.sellerFee != null ? Number(upserted.sellerFee) : feeVal;
                            const shipFeeToUse = upserted.shippingFee != null ? Number(upserted.shippingFee) : shippingVal;
                            const computedProfit = Number(upserted.sellingPrice ?? 0) -
                                Number(sellerFeeToUse ?? 0) -
                                Number(shipFeeToUse ?? 0) -
                                buyingPriceVal;
                            await prisma_1.prisma.marketplaceOrder.update({
                                where: { id: upserted.id },
                                data: { profit: computedProfit },
                            });
                            try {
                                await prisma_1.prisma.profitEvent.create({
                                    data: {
                                        marketplaceOrderId: upserted.id,
                                        type: "RECOGNISE",
                                        amount: dec(computedProfit),
                                    },
                                });
                            }
                            catch (e) {
                                if (e?.code !== "P2002") {
                                    (0, logging_1.logWarn)("[onlineSync] failed to create RECOGNISE ProfitEvent", {
                                        marketplaceOrderId: upserted.id,
                                        error: String(e),
                                    });
                                }
                            }
                        }
                    }
                    catch (err) {
                        (0, logging_1.logWarn)("[onlineSync] ProfitEvent handling failed", { marketplaceOrderId: item.id, error: String(err) });
                    }
                }
            }
            (0, logging_1.logInfo)("[onlineSync] account sync summary", {
                accountId: account.id,
                displayName: account.displayName,
                ordersFetched: orders.length,
                itemsFetched,
            });
        });
        await logStatementCoverage(ingestStats, jumiaAccounts.length);
        (0, logging_1.logInfo)("[onlineSync] finished", { accounts: jumiaAccounts.length });
        // Per-week debug logging: counts of real vs placeholder rows and payout sums
        try {
            for (const w of weekWindows) {
                const normalizedStart = w.weekStart;
                const rows = await prisma_1.prisma.marketplacePayoutWeek.findMany({
                    where: { weekStart: normalizedStart, account: { platform: client_1.Platform.JUMIA } },
                    select: { accountId: true, statementNumber: true, payoutAmount: true, grossSales: true, rawPayload: true },
                });
                const real = rows.filter((r) => !(r.rawPayload && r.rawPayload.placeholder === true));
                const placeholder = rows.filter((r) => (r.rawPayload && r.rawPayload.placeholder === true));
                const realSum = real.reduce((s, r) => s + Number(r.payoutAmount ?? r.grossSales ?? 0), 0);
                const placeholderSum = placeholder.reduce((s, r) => s + Number(r.payoutAmount ?? r.grossSales ?? 0), 0);
                (0, logging_1.logInfo)('[onlineSync] week coverage', {
                    weekStart: normalizedStart.toISOString(),
                    totalRows: rows.length,
                    realCount: real.length,
                    placeholderCount: placeholder.length,
                    realSum,
                    placeholderSum,
                });
            }
        }
        catch (e) {
            (0, logging_1.logWarn)('[onlineSync] per-week debug logging failed', { error: String(e) });
        }
        const fetchedTotal = ingestStats.reduce((sum, s) => sum + (s.fetched ?? 0), 0);
        const matchedTotal = ingestStats.reduce((sum, s) => sum + (s.matched ?? 0), 0);
        const upsertedTotal = ingestStats.reduce((sum, s) => sum + (s.upserted ?? 0), 0);
        const placeholdersTotal = ingestStats.reduce((sum, s) => sum + (s.placeholdersUpserted ?? 0), 0);
        const hardErrors = ingestStats.filter((s) => s.error && s.error !== "MISSING_SHOP_SID" && s.error !== "MISSING_SHOP_RECORD" && s.error !== "TIME_BUDGET_EXCEEDED").length;
        const configMissingShopSid = ingestStats.filter((s) => s.error === "MISSING_SHOP_SID").length;
        const configMissingShopRecord = ingestStats.filter((s) => s.error === "MISSING_SHOP_RECORD").length;
        return {
            ok: true,
            partial,
            createdAfter: createdAfter.toISOString(),
            createdBefore: createdBefore.toISOString(),
            weeks: weekWindows.length,
            accounts: jumiaAccounts.length,
            ingestStatsCount: ingestStats.length,
            placeholdersTotal,
            fetchedTotal,
            matchedTotal,
            upsertedTotal,
            hardErrors,
            configMissingShopSid,
            configMissingShopRecord,
        };
    }
    catch (err) {
        (0, logging_1.logError)("[onlineSync] marketplace sync failed", { error: String(err) });
        const fallbackDate = new Date();
        return {
            ok: false,
            partial: false,
            createdAfter: opts?.periodStart?.toISOString() ?? fallbackDate.toISOString(),
            createdBefore: opts?.periodEnd?.toISOString() ?? fallbackDate.toISOString(),
            weeks: 0,
            accounts: 0,
            ingestStatsCount: 0,
            placeholdersTotal: 0,
            fetchedTotal: 0,
            matchedTotal: 0,
            upsertedTotal: 0,
            hardErrors: 0,
            configMissingShopSid: 0,
            configMissingShopRecord: 0,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
async function upsertWeeklySaleEntry(shopId, platform, weekStart, weekEnd, amount) {
    const { weekStart: normalizedWeekStart, weekEnd: normalizedWeekEnd } = (0, weekWindow_1.mondayToSundayNairobiWindow)(weekStart);
    const key = { shopId, platform, weekStart: normalizedWeekStart, weekEnd: normalizedWeekEnd };
    const existing = await prisma_1.prisma.weeklySale.findUnique({
        where: { shopId_platform_weekStart_weekEnd: key },
    });
    const amountDec = new client_1.Prisma.Decimal(Number(amount ?? 0));
    if (!existing) {
        await prisma_1.prisma.weeklySale.create({
            data: {
                ...key,
                amount: amountDec,
                userId: null,
                status: client_1.WeeklySaleStatus.PENDING,
                source: client_1.WeeklySaleSource.AUTOMATIC,
                createdBy: null,
                approvedBy: null,
            },
        });
        return;
    }
    const isManualOverride = existing.source === client_1.WeeklySaleSource.MANUAL ||
        existing.createdBy !== null ||
        existing.userId !== null ||
        existing.approvedBy !== null;
    if (isManualOverride)
        return;
    await prisma_1.prisma.weeklySale.update({
        where: { shopId_platform_weekStart_weekEnd: key },
        data: { amount: amountDec },
    });
}
async function refreshJumiaToken(credentials, apiBase) {
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
    const data = (await res.json());
    if (data.refresh_token && data.refresh_token !== credentials.refreshToken) {
        if (credentials.source === "env") {
            process.env.JUMIA_REFRESH_TOKEN = data.refresh_token;
        }
        else if (credentials.source === "db" && credentials.credentialId) {
            await prisma_1.prisma.apiCredential.update({
                where: { id: credentials.credentialId },
                data: { refreshToken: data.refresh_token },
            });
        }
    }
    return data.access_token;
}
async function ensureWeeklySalePlaceholder(shopId, platform, weekStart, _weekEnd) {
    const { weekStart: normalizedWeekStart, weekEnd: normalizedWeekEnd } = (0, weekWindow_1.mondayToSundayNairobiWindow)(weekStart);
    const key = {
        shopId,
        platform,
        weekStart: normalizedWeekStart,
        weekEnd: normalizedWeekEnd,
    };
    await prisma_1.prisma.weeklySale.upsert({
        where: { shopId_platform_weekStart_weekEnd: key },
        create: {
            ...key,
            amount: new client_1.Prisma.Decimal(0),
            userId: null,
            status: client_1.WeeklySaleStatus.PENDING,
            source: client_1.WeeklySaleSource.AUTOMATIC,
            createdBy: null,
            approvedBy: null,
        },
        update: {},
    });
}
function statementTimestamp(statement) {
    const updated = statement.updatedAt ?? statement.createdAt;
    if (updated) {
        const parsed = new Date(updated);
        if (!Number.isNaN(parsed.getTime()))
            return parsed.getTime();
    }
    return 0;
}
async function fetchStatementsForPaidFlag(apiBase, authHeader, createdAfter, paidFlag) {
    const url = new URL("/payout-statement", apiBase);
    url.searchParams.set("createdAfter", createdAfter.toISOString().split("T")[0]);
    url.searchParams.set("currency", "LOCAL");
    url.searchParams.set("paid", paidFlag ? "true" : "false");
    url.searchParams.set("size", "1000");
    const res = await (0, fetchWithRetry_1.requestWithRetry)(url.toString(), { headers: { Authorization: authHeader } });
    if (!res.ok) {
        throw new Error(`Failed to fetch payout statements (${res.status})`);
    }
    const data = (await res.json());
    return data.statements ?? [];
}
async function fetchStatementsAll(apiBase, authHeader, createdAfter) {
    const [paidStatements, unpaidStatements] = await Promise.all([
        fetchStatementsForPaidFlag(apiBase, authHeader, createdAfter, true),
        fetchStatementsForPaidFlag(apiBase, authHeader, createdAfter, false),
    ]);
    const statementMap = new Map();
    for (const statement of [...paidStatements, ...unpaidStatements]) {
        const key = statement.statementNumber?.trim();
        if (!key)
            continue;
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
async function fetchOrders(apiBase, authHeader, createdAfter, createdBefore) {
    const orders = [];
    let nextToken = null;
    do {
        const url = new URL("/orders", apiBase);
        url.searchParams.set("createdAfter", createdAfter.toISOString().split("T")[0]);
        url.searchParams.set("createdBefore", createdBefore.toISOString().split("T")[0]);
        url.searchParams.set("size", "200");
        if (nextToken)
            url.searchParams.set("token", nextToken);
        const res = await (0, fetchWithRetry_1.requestWithRetry)(url.toString(), { headers: { Authorization: authHeader } });
        if (!res.ok)
            throw new Error(`Failed to fetch orders (${res.status})`);
        const data = (await res.json());
        if (data.orders?.length)
            orders.push(...data.orders);
        nextToken = data.nextToken ?? null;
        if (data.isLastPage)
            break;
    } while (nextToken);
    return orders;
}
async function fetchOrderItems(apiBase, authHeader, orderId) {
    const url = new URL("/orders/items", apiBase);
    url.searchParams.set("orderId", orderId);
    const res = await (0, fetchWithRetry_1.requestWithRetry)(url.toString(), { headers: { Authorization: authHeader } });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        (0, logging_1.logWarn)("[onlineSync] order items fetch failed", {
            orderId,
            status: res.status,
            url: url.toString(),
            body: body.slice(0, 300),
        });
        throw new Error(`Failed to fetch order items (${res.status})`);
    }
    const data = (await res.json());
    const items = data.items ?? data.orderItems ?? data.data?.items ?? [];
    if (!Array.isArray(items)) {
        (0, logging_1.logWarn)("[onlineSync] order items unexpected shape", {
            orderId,
            keys: Object.keys(data ?? {}),
        });
        return [];
    }
    if (items.length === 0) {
        (0, logging_1.logInfo)("[onlineSync] order has 0 items", { orderId });
    }
    return items;
}
function deriveWeekWindow(statement) {
    const parsed = (0, weekWindow_1.parseDateOnlyUtc)(statement.period?.startDate);
    const baseDate = parsed ?? (statement.createdAt ? new Date(statement.createdAt) : new Date());
    return (0, weekWindow_1.mondayToSundayNairobiWindow)(baseDate);
}
// Automatic WeeklySale creation has been disabled so admins can manage overrides manually.
