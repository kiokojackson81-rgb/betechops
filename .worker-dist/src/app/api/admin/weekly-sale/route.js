"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
exports.dynamic = "force-dynamic";
async function GET(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    const url = new URL(req.url);
    const shopId = url.searchParams.get("shopId") || undefined;
    const userId = url.searchParams.get("userId") || undefined;
    const platformParam = url.searchParams.get("platform");
    const statusParam = url.searchParams.get("status");
    const sourceParam = url.searchParams.get("source");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const where = {};
    if (shopId)
        where.shopId = shopId;
    if (userId)
        where.userId = userId;
    if (platformParam && Object.values(client_1.Platform).includes(platformParam)) {
        where.platform = platformParam;
    }
    if (statusParam && Object.values(client_1.WeeklySaleStatus).includes(statusParam)) {
        where.status = statusParam;
    }
    if (sourceParam && Object.values(client_1.WeeklySaleSource).includes(sourceParam)) {
        where.source = sourceParam;
    }
    if (fromParam || toParam) {
        const fromDate = fromParam ? new Date(fromParam) : undefined;
        const toDate = toParam ? new Date(toParam) : undefined;
        where.weekStart = {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
        };
    }
    const sales = await prisma_1.prisma.weeklySale.findMany({
        where,
        include: {
            shop: { select: { id: true, name: true, platform: true } },
            user: { select: { id: true, name: true, email: true } },
            approved: { select: { id: true, name: true, email: true } },
        },
        orderBy: { weekStart: "desc" },
    });
    return server_1.NextResponse.json(sales);
}
async function POST(req) {
    const auth = await (0, api_1.requireRole)(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok)
        return auth.res;
    const body = (await req.json().catch(() => null));
    if (!body)
        return server_1.NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    const { shopId, weekStart, weekEnd, userId } = body;
    if (!shopId || !weekStart || !weekEnd || body.amount === undefined || body.amount === null) {
        return server_1.NextResponse.json({ error: "shopId, weekStart, weekEnd and amount are required" }, { status: 400 });
    }
    let shop = await prisma_1.prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, platform: true } });
    if (!shop) {
        // If a Shop with the provided id doesn't exist, allow passing a
        // MarketplaceAccount id here by creating a lightweight Shop record.
        // This lets admins select marketplace accounts that weren't mapped to
        // Shop rows yet and still save manual weekly sales.
        const acct = await prisma_1.prisma.marketplaceAccount.findUnique({ where: { id: shopId } });
        if (!acct) {
            return server_1.NextResponse.json({ error: "Shop not found" }, { status: 404 });
        }
        // Create a minimal Shop record for this marketplace account. Keep it
        // active so it appears in future selections. Name uses the account
        // displayName when available.
        shop = await prisma_1.prisma.shop.create({
            data: {
                name: acct.displayName ?? acct.id,
                platform: acct.platform,
                isActive: true,
            },
            select: { id: true, platform: true },
        });
    }
    const normalizedWeekStart = new Date(weekStart);
    const normalizedWeekEnd = new Date(weekEnd);
    if (Number.isNaN(normalizedWeekStart.valueOf()) || Number.isNaN(normalizedWeekEnd.valueOf())) {
        return server_1.NextResponse.json({ error: "Invalid weekStart/weekEnd" }, { status: 400 });
    }
    const amount = typeof body.amount === "string" ? Number(body.amount) : body.amount;
    if (typeof amount !== "number" || Number.isNaN(amount)) {
        return server_1.NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const resolvedShopId = shop.id;
    const resolvedPlatform = shop.platform;
    const weekKey = {
        shopId: resolvedShopId,
        platform: resolvedPlatform,
        weekStart: normalizedWeekStart,
        weekEnd: normalizedWeekEnd,
    };
    const existing = await prisma_1.prisma.weeklySale.findUnique({
        where: { shopId_platform_weekStart_weekEnd: weekKey },
    });
    const overridingAutomatic = existing?.source === client_1.WeeklySaleSource.AUTOMATIC;
    if (overridingAutomatic) {
        console.info(`Manual override replacing automatic weekly sale ${existing.id} for shop ${resolvedShopId} (${normalizedWeekStart.toISOString()} - ${normalizedWeekEnd.toISOString()})`);
    }
    const actorId = auth.session?.user?.id ?? null;
    const record = await prisma_1.prisma.weeklySale.upsert({
        where: { shopId_platform_weekStart_weekEnd: weekKey },
        create: {
            shopId: resolvedShopId,
            platform: resolvedPlatform,
            weekStart: normalizedWeekStart,
            weekEnd: normalizedWeekEnd,
            amount,
            userId: userId ?? null,
            status: client_1.WeeklySaleStatus.PENDING,
            source: client_1.WeeklySaleSource.MANUAL,
            createdBy: actorId,
        },
        update: {
            amount,
            userId: userId ?? null,
            status: client_1.WeeklySaleStatus.PENDING,
            source: client_1.WeeklySaleSource.MANUAL,
            // clear any existing approver when creating/updating manual entries
            approvedBy: null,
            createdBy: actorId,
        },
    });
    try {
        const receiptNumber = `manual-weekly-${record.id}`;
        const entryDate = normalizedWeekStart;
        const dayStart = new Date(entryDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(entryDate);
        dayEnd.setHours(23, 59, 59, 999);
        const dayOfWeek = entryDate.toLocaleDateString("en-KE", { weekday: "long" });
        const dailyEntryWhere = { submittedById: userId ?? null, date: { gte: dayStart, lte: dayEnd } };
        let marketingEntry = await prisma_1.prisma.marketingDailyEntry.findFirst({ where: dailyEntryWhere });
        if (!marketingEntry) {
            marketingEntry = await prisma_1.prisma.marketingDailyEntry.create({
                data: {
                    date: entryDate,
                    dayOfWeek,
                    totalSales: 0,
                    totalProfit: 0,
                    submittedById: userId ?? null,
                },
            });
        }
        const receiptItemsPayload = [
            {
                productName: "Manual weekly sale",
                buyingPrice: 0,
            },
        ];
        let marketingReceipt = await prisma_1.prisma.marketingReceipt.findFirst({
            where: { dailyEntryId: marketingEntry.id, receiptNumber },
        });
        if (marketingReceipt) {
            await prisma_1.prisma.marketingReceiptItem.deleteMany({ where: { receiptId: marketingReceipt.id } });
            marketingReceipt = await prisma_1.prisma.marketingReceipt.update({
                where: { id: marketingReceipt.id },
                data: {
                    sellingTotal: amount,
                    buyingTotal: 0,
                    paymentMethod: client_1.PaymentMethod.MPESA,
                    items: { create: receiptItemsPayload },
                },
            });
        }
        else {
            marketingReceipt = await prisma_1.prisma.marketingReceipt.create({
                data: {
                    dailyEntryId: marketingEntry.id,
                    receiptNumber,
                    sellingTotal: amount,
                    buyingTotal: 0,
                    paymentMethod: client_1.PaymentMethod.MPESA,
                    items: { create: receiptItemsPayload },
                },
            });
        }
        await prisma_1.prisma.marketingDailyEntry.update({
            where: { id: marketingEntry.id },
            data: {
                totalSales: amount,
                totalProfit: amount,
            },
        });
    }
    catch (error) {
        console.error("[weekly-sale] failed to mirror manual entry to marketing ledger", error);
    }
    const enriched = await prisma_1.prisma.weeklySale.findUnique({
        where: { id: record.id },
        include: {
            shop: { select: { id: true, name: true, platform: true } },
            user: { select: { id: true, name: true, email: true } },
            approved: { select: { id: true, name: true, email: true } },
        },
    });
    return server_1.NextResponse.json(enriched, { status: existing ? 200 : 201 });
}
