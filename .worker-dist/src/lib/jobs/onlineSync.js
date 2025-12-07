"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOnlineMarketplaceData = syncOnlineMarketplaceData;
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/credentials/jumia");
const DEFAULT_API_BASE = process.env.JUMIA_VENDOR_API_BASE ?? "https://vendor-api.jumia.com";
const DEFAULT_LOOKBACK_DAYS = 70;
async function syncOnlineMarketplaceData(opts) {
    const credentials = await (0, jumia_1.loadJumiaCredentials)();
    const apiBase = credentials.baseUrl?.trim() || DEFAULT_API_BASE;
    const authScheme = credentials.authScheme?.trim() || process.env.JUMIA_AUTH_SCHEME?.trim() || "Bearer";
    const accessToken = await refreshJumiaToken(credentials, apiBase);
    const authHeader = `${authScheme} ${accessToken}`;
    const days = opts?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    const createdAfter = new Date();
    createdAfter.setDate(createdAfter.getDate() - days);
    const jumiaAccounts = await prisma_1.prisma.marketplaceAccount.findMany({
        where: { platform: client_1.Platform.JUMIA, isActive: true },
    });
    const accountsBySid = new Map();
    jumiaAccounts.forEach((account) => {
        if (account.jumiaShopSid)
            accountsBySid.set(account.jumiaShopSid, account);
    });
    const statements = await fetchStatements(apiBase, authHeader, createdAfter);
    for (const statement of statements) {
        const account = statement.shopSid ? accountsBySid.get(statement.shopSid) : null;
        if (!account)
            continue;
        const { weekStart, weekEnd } = deriveWeekWindow(statement);
        const grossSales = Number(statement.payout?.amount ?? 0);
        await prisma_1.prisma.marketplacePayoutWeek.upsert({
            where: {
                accountId_statementNumber: {
                    accountId: account.id,
                    statementNumber: statement.statementNumber,
                },
            },
            create: {
                accountId: account.id,
                statementNumber: statement.statementNumber,
                weekStart,
                weekEnd,
                grossSales,
                payoutAmount: grossSales,
                currency: "KES",
                isPaid: Boolean(statement.paid),
                rawPayload: statement,
            },
            update: {
                grossSales,
                payoutAmount: grossSales,
                isPaid: Boolean(statement.paid),
                rawPayload: statement,
            },
        });
    }
    const orders = await fetchOrders(apiBase, authHeader, createdAfter);
    for (const order of orders) {
        const shopSid = order.shopIds?.[0];
        const account = shopSid ? accountsBySid.get(shopSid) : null;
        if (!account)
            continue;
        const items = await fetchOrderItems(apiBase, authHeader, order.id);
        for (const item of items) {
            const sellingPriceLocal = Number(item.paidPriceLocal ?? item.itemPriceLocal ?? 0);
            await prisma_1.prisma.marketplaceOrder.upsert({
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
                    rawPayload: item,
                },
                update: {
                    status: item.status,
                    sellingPrice: sellingPriceLocal,
                    currency: item.country?.currencyCode ?? "KES",
                    rawPayload: item,
                },
            });
        }
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
async function fetchStatements(apiBase, authHeader, createdAfter) {
    const url = new URL("/payout-statement", apiBase);
    url.searchParams.set("createdAfter", createdAfter.toISOString().split("T")[0]);
    url.searchParams.set("currency", "LOCAL");
    url.searchParams.set("paid", "true");
    url.searchParams.set("size", "1000");
    const res = await fetch(url.toString(), {
        headers: { Authorization: authHeader },
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch payout statements (${res.status})`);
    }
    const data = (await res.json());
    return data.statements ?? [];
}
async function fetchOrders(apiBase, authHeader, createdAfter) {
    const orders = [];
    let nextToken = null;
    const createdBefore = new Date();
    do {
        const url = new URL("/orders", apiBase);
        url.searchParams.set("createdAfter", createdAfter.toISOString().split("T")[0]);
        url.searchParams.set("createdBefore", createdBefore.toISOString().split("T")[0]);
        url.searchParams.set("size", "200");
        if (nextToken)
            url.searchParams.set("token", nextToken);
        const res = await fetch(url.toString(), {
            headers: { Authorization: authHeader },
        });
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
    const res = await fetch(url.toString(), {
        headers: { Authorization: authHeader },
    });
    if (!res.ok)
        throw new Error(`Failed to fetch order items (${res.status})`);
    const data = (await res.json());
    return data.items ?? [];
}
function deriveWeekWindow(statement) {
    const start = statement.period?.startDate ? new Date(statement.period.startDate) : statement.createdAt ? new Date(statement.createdAt) : new Date();
    const end = statement.period?.endDate
        ? new Date(statement.period.endDate)
        : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    return { weekStart: start, weekEnd: end };
}
