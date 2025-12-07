"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const next_1 = require("next-auth/next");
const nextAuth_1 = require("@/lib/nextAuth");
const prisma_1 = require("@/lib/prisma");
const commission_1 = require("@/lib/commission");
exports.dynamic = "force-dynamic";
async function GET() {
    const session = (await (0, next_1.getServerSession)(nextAuth_1.authOptions));
    if (!session?.user?.id) {
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const now = new Date();
    const { period, tiers, tradingPeriod } = await (0, commission_1.getOrCreateCommissionPeriod)(now);
    // Normalize tradingPeriod shape: some helpers return { key,label,startDate,endDate }
    // while others return { periodKey,periodLabel,startDate,endDate }.
    let periodKey;
    let periodLabel;
    let start;
    let end;
    if ("periodKey" in tradingPeriod) {
        periodKey = tradingPeriod.periodKey;
        periodLabel = tradingPeriod.periodLabel;
        start = tradingPeriod.startDate ?? tradingPeriod.start;
        end = tradingPeriod.endDate ?? tradingPeriod.end;
    }
    else {
        periodKey = tradingPeriod.key;
        periodLabel = tradingPeriod.label;
        start = tradingPeriod.startDate ?? tradingPeriod.start;
        end = tradingPeriod.endDate ?? tradingPeriod.end;
    }
    const snapshots = await prisma_1.prisma.profitSnapshot.findMany({
        where: {
            orderItem: {
                order: {
                    attendantId: userId,
                    createdAt: { gte: start, lte: end },
                },
            },
        },
        select: {
            revenue: true,
            profit: true,
        },
    });
    let totalSales = 0;
    let totalProfit = 0;
    for (const row of snapshots) {
        totalSales += Number(row.revenue ?? 0);
        totalProfit += Number(row.profit ?? 0);
    }
    const reports = await prisma_1.prisma.dailyReport.findMany({
        where: { userId, date: { gte: start, lte: end } },
        select: {
            newProducts: true,
            productsEdited: true,
            copiesUploaded: true,
            walkInServed: true,
            purchasesMade: true,
        },
    });
    let newProducts = 0;
    let editedProducts = 0;
    let copiedProducts = 0;
    let walkInsServed = 0;
    let walkInsPurchased = 0;
    for (const rep of reports) {
        newProducts += rep.newProducts ?? 0;
        editedProducts += rep.productsEdited ?? 0;
        copiedProducts += rep.copiesUploaded ?? 0;
        walkInsServed += rep.walkInServed ?? 0;
        walkInsPurchased += rep.purchasesMade ?? 0;
    }
    const totalReceipts = reports.length;
    const totalItems = await prisma_1.prisma.dailySale.count({
        where: {
            dailyReport: {
                userId,
                date: { gte: start, lte: end },
            },
        },
    });
    // Use default profit fallback here so attendant endpoints keep previous
    // commission behaviour (fallback percent configured in commission helper).
    const salesCommission = (0, commission_1.computeSalesCommissionFromTiers)(totalSales, totalProfit, tiers);
    const { newProductCommission, copiedCommission, editedCommission } = (0, commission_1.computeProductCommissions)({
        newProducts,
        copiedProducts,
        editedProducts,
    });
    const grossCommission = salesCommission + newProductCommission + copiedCommission + editedCommission;
    const detail = {
        periodKey,
        periodLabel,
        totalSales,
        totalProfit,
        salesCommission,
        newProductCommission,
        copiedCommission,
        editedCommission,
        totalNewProducts: newProducts,
        totalEditedProducts: editedProducts,
        totalCopiedProducts: copiedProducts,
        walkInsServed,
        walkInsPurchased,
        totalReceipts,
        totalItems,
    };
    await prisma_1.prisma.commissionLedger.upsert({
        where: {
            userId_periodStart_periodEnd: {
                userId,
                periodStart: period.startDate,
                periodEnd: period.endDate,
            },
        },
        update: {
            grossCommission: grossCommission.toString(),
            netCommission: grossCommission.toString(),
            detail,
        },
        create: {
            userId,
            periodStart: period.startDate,
            periodEnd: period.endDate,
            grossCommission: grossCommission.toString(),
            netCommission: grossCommission.toString(),
            detail,
        },
    });
    return server_1.NextResponse.json({
        periodKey,
        periodLabel,
        totalSales,
        totalProfit,
        salesCommission,
        newProductCommission,
        copiedCommission,
        editedCommission,
        grossCommission,
        totalNewProducts: newProducts,
        totalEditedProducts: editedProducts,
        totalCopiedProducts: copiedProducts,
        walkInsServed,
        walkInsPurchased,
        totalReceipts,
        totalItems,
    });
}
