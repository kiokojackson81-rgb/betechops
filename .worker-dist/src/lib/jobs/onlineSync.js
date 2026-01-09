"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOnlineMarketplaceData = syncOnlineMarketplaceData;
exports.upsertWeeklySaleEntry = upsertWeeklySaleEntry;
const client_1 = require("@prisma/client");
const prisma_1 = require("../prisma");
const jumia_1 = require("../credentials/jumia");
const weekWindow_1 = require("../weekWindow");
const statementStatus_1 = require("../statementStatus");
const fetchWithRetry_1 = require("../fetchWithRetry");
const DEFAULT_API_BASE = process.env.JUMIA_VENDOR_API_BASE ?? "https://vendor-api.jumia.com";
const DEFAULT_LOOKBACK_DAYS = 70;
async function syncOnlineMarketplaceData(opts) {
    let createdBefore = opts?.periodEnd ?? new Date();
    let createdAfter = opts?.periodStart ??
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
    const jumiaAccounts = await prisma_1.prisma.marketplaceAccount.findMany({
        where: { platform: client_1.Platform.JUMIA, isActive: true },
        include: {
            assignments: {
                where: activeAssignmentsWhere,
                orderBy: { startsAt: "desc" },
            },
        },
    });
    const jumiaShops = await prisma_1.prisma.shop.findMany({
        where: { platform: client_1.Platform.JUMIA },
        select: { id: true, name: true, jumiaShopSid: true },
    });
    const shopsByJumiaSid = new Map();
    jumiaShops.forEach((shop) => {
        if (shop.jumiaShopSid)
            shopsByJumiaSid.set(shop.jumiaShopSid, shop);
    });
    const accountsBySid = new Map();
    jumiaAccounts.forEach((account) => {
        if (account.jumiaShopSid)
            accountsBySid.set(account.jumiaShopSid, account);
    });
    // Try to load GLOBAL/env credentials for fetching payout statements
    let statements = [];
    try {
        const globalCreds = await (async () => {
            try {
                return await (0, jumia_1.loadJumiaCredentials)();
            }
            catch (e) {
                return null;
            }
        })();
        if (globalCreds) {
            const apiBaseGlobal = globalCreds.baseUrl?.trim() || DEFAULT_API_BASE;
            const authSchemeGlobal = globalCreds.authScheme?.trim() || process.env.JUMIA_AUTH_SCHEME?.trim() || "Bearer";
            const accessTokenGlobal = await refreshJumiaToken(globalCreds, apiBaseGlobal);
            const authHeaderGlobal = `${authSchemeGlobal} ${accessTokenGlobal}`;
            statements = await fetchStatementsAll(apiBaseGlobal, authHeaderGlobal, createdAfter);
        }
        else {
            statements = [];
        }
    }
    catch (err) {
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
            console.error(`[onlineSync] SHOP_SID_MISMATCH statement ${statement.statementNumber} shopSid ${statement.shopSid} does not match account jumiaShopSid ${mappedAccount.jumiaShopSid} - skipping attribution`);
            continue;
        }
        const statementNumber = (statement.statementNumber ?? "").trim();
        if (!statementNumber) {
            console.warn(`[onlineSync] Skipping statement without statementNumber for account ${mappedAccount.displayName ?? targetAccountId} shopSid ${stmtShopSid}`);
            continue;
        }
        const { weekStart, weekEnd } = deriveWeekWindow(statement);
        const amountValue = Number(statement.payout?.amount ?? 0);
        const { isPaid } = (0, statementStatus_1.deriveStatementStatus)(statement.statementNumber, statement.paid);
        let shopRecord = mappedAccount.jumiaShopSid ? shopsByJumiaSid.get(mappedAccount.jumiaShopSid) : undefined;
        // Fallback: if we don't have a jumiaShopSid mapping, try to match by displayName
        if (!shopRecord && mappedAccount.displayName) {
            const nameLower = String(mappedAccount.displayName).toLowerCase();
            for (const s of jumiaShops) {
                if (s.name && String(s.name).toLowerCase().includes(nameLower)) {
                    shopRecord = s;
                    break;
                }
            }
        }
        if (!shopRecord) {
            console.warn(`[onlineSync] No Shop record for marketplace account ${mappedAccount.displayName ?? mappedAccount.id} jumiaShopSid=${mappedAccount.jumiaShopSid}; skipping statement ${statement.statementNumber}`);
            continue;
        }
        try {
            await prisma_1.prisma.marketplacePayoutWeek.upsert({
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
                    rawPayload: statement,
                },
                update: {
                    weekStart,
                    weekEnd,
                    grossSales: amountValue,
                    payoutAmount: amountValue,
                    isPaid,
                    rawPayload: statement,
                },
            });
        }
        catch (err) {
            console.warn('[onlineSync] Failed to upsert MarketplacePayoutWeek', err);
            continue;
        }
        try {
            await upsertWeeklySaleEntry(shopRecord.id, mappedAccount.platform, weekStart, weekEnd, amountValue);
        }
        catch (err) {
            console.warn('[onlineSync] Failed to upsert WeeklySale for payout week', err);
        }
    }
    // Fetch orders per-account using that account's credentials (support per-account ApiCredential)
    // Limit concurrency when syncing accounts to avoid hitting vendor rate limits.
    async function runWithConcurrency(items, limit, worker) {
        let idx = 0;
        async function runner() {
            while (true) {
                const i = idx++;
                if (i >= items.length)
                    return;
                const it = items[i];
                try {
                    await worker(it);
                }
                catch (err) {
                    console.error('[onlineSync] account worker error', err);
                }
            }
        }
        const parallel = Math.min(limit, items.length);
        const runners = [];
        for (let i = 0; i < parallel; i++)
            runners.push(runner());
        await Promise.all(runners);
    }
    await runWithConcurrency(jumiaAccounts, 2, async (account) => {
        let credentialsForAccount = null;
        try {
            credentialsForAccount = await (0, jumia_1.loadJumiaCredentials)(`MARKETPLACE_ACCOUNT:${account.id}`);
        }
        catch (err) {
            // Fall back to GLOBAL/env if no per-account credential exists
            try {
                credentialsForAccount = await (0, jumia_1.loadJumiaCredentials)();
            }
            catch (err2) {
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
            if (account.jumiaShopSid && shopSid && shopSid !== account.jumiaShopSid)
                continue;
            const items = await fetchOrderItems(apiBaseAcct, authHeaderAcct, order.id);
            for (const item of items) {
                const sellingPriceLocal = Number(item.paidPriceLocal ?? item.itemPriceLocal ?? 0);
                const statusStr = typeof item.status === 'string' ? item.status : String(item.status ?? '');
                const isReturnedFlag = statusStr.startsWith('RETURN') || statusStr === 'FAILED';
                // load existing order (if any) so we can emit reversal events when needed
                const existing = await prisma_1.prisma.marketplaceOrder.findUnique({ where: { id: item.id } });
                // extract fee/shipping from raw payload when available
                const rawItem = item;
                const feeVal = Number((rawItem?.seller_fee?.amount ?? rawItem?.seller_fee_amount ?? 0) || 0);
                const shippingVal = Number((rawItem?.shipping_fee?.amount ?? rawItem?.shipping_fee_amount ?? 0) || 0);
                const upsertResult = await prisma_1.prisma.marketplaceOrder.upsert({
                    where: {
                        id: item.id,
                    },
                    create: {
                        id: item.id,
                        accountId: account.id,
                        platform: client_1.Platform.JUMIA,
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
                        rawPayload: item,
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
                        rawPayload: item,
                    },
                });
                // If this item was previously recognised with profit and is now returned,
                // create a reversal ProfitEvent to mirror the change.
                try {
                    if (isReturnedFlag && existing && existing.profit && Number(existing.profit) > 0) {
                        await prisma_1.prisma.profitEvent.create({
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
                            await prisma_1.prisma.marketplaceOrder.update({ where: { id: upsertResult.id }, data: { profit: computedProfit } });
                            await prisma_1.prisma.profitEvent.create({ data: { marketplaceOrderId: upsertResult.id, type: "RECOGNISE", amount: computedProfit } });
                        }
                        catch (err) {
                            console.warn("Failed to record computed profit for delivered marketplace order", err);
                        }
                    }
                }
                catch (err) {
                    console.warn("Failed to create ProfitEvent reversal for returned order", err);
                }
            }
        }
    });
}
async function upsertWeeklySaleEntry(shopId, platform, weekStart, weekEnd, amount) {
    // Upsert WeeklySale using the compound unique key: shopId_platform_weekStart_weekEnd
    try {
        await prisma_1.prisma.weeklySale.upsert({
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
                status: client_1.WeeklySaleStatus.PENDING,
                source: client_1.WeeklySaleSource.AUTOMATIC,
                createdBy: null,
            },
            update: {
                // Update amount only; leave userId/status/source untouched so admins keep control.
                amount: amount ?? 0,
            },
        });
    }
    catch (err) {
        // Bubble up the error to caller for logging
        throw err;
    }
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
    if (!res.ok)
        throw new Error(`Failed to fetch order items (${res.status})`);
    const data = (await res.json());
    return data.items ?? [];
}
function deriveWeekWindow(statement) {
    const parsed = (0, weekWindow_1.parseDateOnlyUtc)(statement.period?.startDate);
    const baseDate = parsed ?? (statement.createdAt ? new Date(statement.createdAt) : new Date());
    return (0, weekWindow_1.mondayToSundayNairobiWindow)(baseDate);
}
// Automatic WeeklySale creation has been disabled so admins can manage overrides manually.
