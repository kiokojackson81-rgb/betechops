"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const client_1 = require("@prisma/client");
const onlineCommission_1 = require("@/lib/onlineCommission");
const prisma_1 = require("@/lib/prisma");
const auth_1 = require("@/lib/auth");
const onlineOps_1 = require("@/lib/onlineOps");
const resolveTargetUser_1 = require("@/lib/resolveTargetUser");
exports.dynamic = "force-dynamic";
const weekRangeForDate = (reference) => {
    const now = new Date(reference);
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { start: weekStart, end: weekEnd };
};
const formatRangeLabel = (start, end) => {
    const format = (value) => value.toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
    return `Week (${format(start)} - ${format(end)})`;
};
const parseDateParam = (value) => {
    if (!value)
        return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
async function GET(req) {
    const auth = await (0, auth_1.requireAttendant)(req, [
        "JUMIA_KILIMALL_OPS",
        "BETECH_OPS",
        "SUPERVISOR",
        "ADMIN",
    ]);
    if (!auth.ok)
        return auth.res;
    const identity = await (0, resolveTargetUser_1.resolveTargetUserId)(req);
    const meta = identity;
    const targetUserId = identity.resolvedUserId;
    if (!targetUserId) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(req.url);
    if (url.searchParams.has("start") || url.searchParams.has("end")) {
        return server_1.NextResponse.json({ error: "This endpoint requires a server-resolved trading period; do not supply start/end." }, { status: 400 });
    }
    const { start, end } = weekRangeForDate(new Date());
    const rangeLabel = formatRangeLabel(start, end);
    const weekLabel = `${start.toLocaleDateString("en-KE", {
        day: "2-digit",
        month: "short",
    })} - ${end.toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}`;
    const isAdmin = auth.role === "ADMIN" || auth.role === "SUPERVISOR";
    let accountIds = [];
    if (isAdmin) {
        const accounts = await prisma_1.prisma.marketplaceAccount.findMany({
            where: { isActive: true },
            select: { id: true },
        });
        accountIds = accounts.map((a) => a.id);
    }
    else {
        const assignments = await (0, onlineOps_1.getMarketplaceAssignmentsForUser)(targetUserId);
        accountIds = assignments.accountIds;
    }
    if (!accountIds.length) {
        const emptyResponse = {
            rangeLabel,
            totals: { sales: 0, commission: 0, orders: 0, shops: 0 },
            rows: [],
        };
        return server_1.NextResponse.json((0, resolveTargetUser_1.composeIdentityResponse)(meta, emptyResponse));
    }
    const accounts = await prisma_1.prisma.marketplaceAccount.findMany({
        where: { id: { in: accountIds }, isActive: true },
        select: {
            id: true,
            displayName: true,
            platform: true,
            jumiaShopSid: true,
            kilimallShopCode: true,
        },
        orderBy: [{ platform: "asc" }, { displayName: "asc" }],
    });
    if (!accounts.length) {
        const emptyResponse = {
            rangeLabel,
            totals: { sales: 0, commission: 0, orders: 0, shops: 0 },
            rows: [],
        };
        return server_1.NextResponse.json((0, resolveTargetUser_1.composeIdentityResponse)(meta, emptyResponse));
    }
    const normalizeName = (value) => value?.trim().toLowerCase() ?? "";
    const normalizeApiKey = (value) => value?.trim().toLowerCase() ?? "";
    const accountById = new Map();
    const accountByName = new Map();
    const accountByJumiaSid = new Map();
    const accountByKilimallCode = new Map();
    accounts.forEach((account) => {
        accountById.set(account.id, account.id);
        const normalizedName = normalizeName(account.displayName);
        if (normalizedName) {
            accountByName.set(normalizedName, account.id);
        }
        const normalizedJumia = normalizeApiKey(account.jumiaShopSid);
        if (normalizedJumia) {
            accountByJumiaSid.set(normalizedJumia, account.id);
        }
        const normalizedKilimall = normalizeApiKey(account.kilimallShopCode);
        if (normalizedKilimall) {
            accountByKilimallCode.set(normalizedKilimall, account.id);
        }
    });
    const manualEntries = await prisma_1.prisma.weeklySale.findMany({
        where: {
            status: client_1.WeeklySaleStatus.APPROVED,
            source: client_1.WeeklySaleSource.MANUAL,
            AND: [{ weekEnd: { gte: start } }, { weekStart: { lte: end } }],
        },
        select: {
            id: true,
            shopId: true,
            amount: true,
            platform: true,
            shop: {
                select: {
                    id: true,
                    name: true,
                    platform: true,
                    apiConfig: { select: { apiKey: true } },
                },
            },
        },
    });
    const unmatchedManualByPlatform = new Map();
    const manualSalesByAccount = new Map();
    const manualEntriesCountByAccount = new Map();
    manualEntries.forEach((entry) => {
        const manualAmount = Number(entry.amount ?? 0);
        if (!manualAmount) {
            return;
        }
        let matchedAccountId = entry.shopId && accountById.has(entry.shopId) ? entry.shopId : undefined;
        const normalizedShopName = normalizeName(entry.shop?.name);
        const platformKey = (entry.platform ?? entry.shop?.platform ?? "").toUpperCase();
        const apiKey = normalizeApiKey(entry.shop?.apiConfig?.apiKey);
        if (!matchedAccountId && normalizedShopName && accountByName.has(normalizedShopName)) {
            matchedAccountId = accountByName.get(normalizedShopName);
        }
        if (!matchedAccountId &&
            apiKey &&
            platformKey === "JUMIA" &&
            accountByJumiaSid.has(apiKey)) {
            matchedAccountId = accountByJumiaSid.get(apiKey);
        }
        if (!matchedAccountId &&
            apiKey &&
            platformKey === "KILIMALL" &&
            accountByKilimallCode.has(apiKey)) {
            matchedAccountId = accountByKilimallCode.get(apiKey);
        }
        if (!matchedAccountId) {
            const key = platformKey || "UNKNOWN";
            const current = unmatchedManualByPlatform.get(key) ?? { sales: 0, entries: 0 };
            current.sales += manualAmount;
            current.entries += 1;
            unmatchedManualByPlatform.set(key, current);
            return;
        }
        const amount = Number(entry.amount ?? 0);
        if (!amount) {
            return;
        }
        manualSalesByAccount.set(matchedAccountId, (manualSalesByAccount.get(matchedAccountId) ?? 0) + amount);
        manualEntriesCountByAccount.set(matchedAccountId, (manualEntriesCountByAccount.get(matchedAccountId) ?? 0) + 1);
    });
    const orders = await prisma_1.prisma.marketplaceOrder.findMany({
        where: {
            accountId: { in: accounts.map((a) => a.id) },
            orderedAt: { gte: start, lte: end },
        },
        select: {
            accountId: true,
            sellingPrice: true,
            profit: true,
        },
    });
    const returns = await prisma_1.prisma.marketplaceReturn.findMany({
        where: {
            accountId: { in: accounts.map((a) => a.id) },
            dueAt: { gte: start, lte: end },
            status: client_1.MarketplaceReturnStatus.CHARGED_TO_ATTENDANT,
        },
        select: {
            accountId: true,
            expectedAmount: true,
        },
    });
    const rows = accounts
        .map((account) => {
        const accountOrders = orders.filter((order) => order.accountId === account.id);
        const sales = accountOrders.reduce((sum, order) => sum + Number(order.sellingPrice ?? 0), 0);
        const profit = accountOrders.reduce((sum, order) => sum + Number(order.profit ?? 0), 0);
        const accountReturns = returns.filter((entry) => entry.accountId === account.id);
        const chargedReturns = accountReturns.reduce((sum, entry) => sum + Number(entry.expectedAmount ?? 0), 0);
        const manualSalesAmount = manualSalesByAccount.get(account.id) ?? 0;
        const manualEntryCount = manualEntriesCountByAccount.get(account.id) ?? 0;
        const totalSales = sales + manualSalesAmount;
        // Use the canonical marketplace commission calculation so manual entries
        // contribute to sales (and therefore ladder computation) rather than
        // being treated as a direct commission amount. Subtract charged returns
        // afterwards to reflect attendant-charged returns.
        const commissionResult = (0, onlineCommission_1.computeMarketplaceCommission)(totalSales);
        const totalCommission = Math.max(0, Number(commissionResult.amount || 0) - chargedReturns);
        return {
            shopId: account.id,
            shopName: account.displayName,
            platform: account.platform,
            weekLabel,
            weekStart: start.toISOString(),
            weekEnd: end.toISOString(),
            sales: totalSales,
            commission: totalCommission,
            orders: accountOrders.length + manualEntryCount,
        };
    })
        .sort((a, b) => b.sales - a.sales);
    const manualSummaryRows = Array.from(unmatchedManualByPlatform.entries()).map(([platform, data]) => {
        const commissionResult = (0, onlineCommission_1.computeMarketplaceCommission)(data.sales);
        return {
            shopId: `manual-${platform}-${start.toISOString()}`,
            shopName: `Manual ${platform}`,
            platform,
            weekLabel,
            weekStart: start.toISOString(),
            weekEnd: end.toISOString(),
            sales: data.sales,
            commission: Number(commissionResult.amount || 0),
            orders: data.entries,
        };
    });
    const finalRows = [...rows, ...manualSummaryRows].sort((a, b) => b.sales - a.sales);
    const totals = finalRows.reduce((acc, row) => {
        acc.sales += row.sales;
        acc.commission += row.commission;
        acc.orders += row.orders ?? 0;
        return acc;
    }, { sales: 0, commission: 0, orders: 0 });
    const data = {
        rangeLabel,
        totals: { ...totals, shops: finalRows.length },
        rows: finalRows,
    };
    return server_1.NextResponse.json((0, resolveTargetUser_1.composeIdentityResponse)(meta, data));
}
