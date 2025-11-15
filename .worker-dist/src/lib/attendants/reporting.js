"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendantCategorySummary = getAttendantCategorySummary;
const prisma_1 = require("@/lib/prisma");
const categories_1 = require("./categories");
async function getAttendantCategorySummary(days) {
    const rangeDays = Math.min(90, Math.max(1, days));
    const since = new Date();
    since.setDate(since.getDate() - rangeDays + 1);
    const [activityAgg, assignmentCounts, fallbackUsers, jumiaOrders, kilimallOrders] = await Promise.all([
        prisma_1.prisma.attendantActivity.groupBy({
            by: ["category", "metric"],
            where: { entryDate: { gte: since } },
            _sum: { numericValue: true, intValue: true },
        }),
        prisma_1.prisma.attendantCategoryAssignment.groupBy({
            by: ["category"],
            where: { user: { role: { in: ["ATTENDANT", "SUPERVISOR"] }, isActive: true } },
            _count: { _all: true },
        }),
        prisma_1.prisma.user.findMany({
            where: {
                role: { in: ["ATTENDANT", "SUPERVISOR"] },
                isActive: true,
                categoryAssignments: { none: {} },
            },
            select: { attendantCategory: true },
        }),
        prisma_1.prisma.order.groupBy({
            by: ["status"],
            where: { shop: { platform: "JUMIA" } },
            _count: true,
        }),
        prisma_1.prisma.order.groupBy({
            by: ["status"],
            where: { shop: { platform: "KILIMALL" } },
            _count: true,
        }),
    ]);
    const totalsByCategory = categories_1.attendantCategories.reduce((acc, def) => {
        acc[def.id] = { users: 0, metrics: {} };
        return acc;
    }, {});
    for (const row of assignmentCounts) {
        const cat = row.category;
        if (!totalsByCategory[cat])
            totalsByCategory[cat] = { users: 0, metrics: {} };
        totalsByCategory[cat].users += row._count._all;
    }
    for (const user of fallbackUsers) {
        const cat = user.attendantCategory;
        if (!totalsByCategory[cat])
            totalsByCategory[cat] = { users: 0, metrics: {} };
        totalsByCategory[cat].users += 1;
    }
    for (const agg of activityAgg) {
        const cat = agg.category;
        if (!totalsByCategory[cat])
            totalsByCategory[cat] = { users: 0, metrics: {} };
        const numeric = agg._sum.numericValue;
        const numericSum = numeric ? Number(numeric) : 0;
        totalsByCategory[cat].metrics[agg.metric] = {
            numericSum,
            intSum: agg._sum.intValue ?? 0,
        };
    }
    const jumiaCounts = {};
    for (const row of jumiaOrders) {
        jumiaCounts[row.status] = row._count;
    }
    const kilimallCounts = {};
    for (const row of kilimallOrders) {
        kilimallCounts[row.status] = row._count;
    }
    if (totalsByCategory.JUMIA_OPERATIONS) {
        totalsByCategory.JUMIA_OPERATIONS.orderCounts = jumiaCounts;
    }
    if (totalsByCategory.KILIMALL_OPERATIONS) {
        totalsByCategory.KILIMALL_OPERATIONS.orderCounts = kilimallCounts;
    }
    return {
        since,
        days: rangeDays,
        categories: totalsByCategory,
    };
}
