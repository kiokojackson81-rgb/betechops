"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendantCategorySummary = getAttendantCategorySummary;
const prisma_1 = require("@/lib/prisma");
const definitions_1 = require("./definitions");
async function getAttendantCategorySummary(opts = 7) {
    let rangeDays = 7;
    let since = new Date();
    if (typeof opts === "number") {
        rangeDays = Math.min(90, Math.max(1, opts));
        since = new Date();
        since.setDate(since.getDate() - rangeDays + 1);
    }
    else {
        const days = opts.days ?? 7;
        if (opts.tradingPeriod) {
            const ref = opts.refDate ? new Date(opts.refDate) : new Date();
            // Trading period runs 25th -> 24th. Determine the period that contains ref.
            const year = ref.getFullYear();
            const month = ref.getMonth(); // 0-indexed
            if (ref.getDate() >= 25) {
                // start is 25th of current month
                since = new Date(year, month, 25);
                const end = new Date(year, month + 1, 24);
                rangeDays = Math.ceil((end.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            }
            else {
                // start is 25th of previous month
                since = new Date(year, month - 1, 25);
                const end = new Date(year, month, 24);
                rangeDays = Math.ceil((end.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            }
        }
        else {
            rangeDays = Math.min(90, Math.max(1, days));
            since = new Date();
            since.setDate(since.getDate() - rangeDays + 1);
        }
    }
    const [activityAgg, assignmentCounts, fallbackUsers, jumiaOrders, kilimallOrders] = await Promise.all([
        prisma_1.prisma.$queryRaw `
      SELECT category::text AS category, metric, SUM(COALESCE(numericValue::numeric, 0)) AS numeric_sum, SUM(COALESCE(intValue, 0)) AS int_sum
      FROM "AttendantActivity"
      WHERE "entryDate" >= ${since}
      GROUP BY category, metric
    `,
        prisma_1.prisma.$queryRaw `
      SELECT a.category::text AS category, COUNT(*) AS _count
      FROM "AttendantCategoryAssignment" a
      JOIN "User" u ON u.id = a."userId"
      WHERE u.role IN ('ATTENDANT','SUPERVISOR') AND u."isActive" = true
      GROUP BY a.category
    `,
        prisma_1.prisma.$queryRaw `
      SELECT u."attendantCategory"::text AS "attendantCategory"
      FROM "User" u
      WHERE u.role IN ('ATTENDANT','SUPERVISOR') AND u."isActive" = true
        AND NOT EXISTS (SELECT 1 FROM "AttendantCategoryAssignment" a WHERE a."userId" = u.id)
    `,
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
    // fetch DailyReport concerns with user category (limit recent rows)
    const concernsRows = await prisma_1.prisma.$queryRaw `
    SELECT d.concerns, d."createdAt", d."userId", u."attendantCategory"::text AS "attendantCategory"
    FROM "DailyReport" d
    LEFT JOIN "User" u ON u.id = d."userId"
    WHERE d.date >= ${since} AND d.concerns IS NOT NULL
    ORDER BY d."createdAt" DESC
  `;
    const totalsByCategory = definitions_1.attendantCategoryDefinitions.reduce((acc, def) => {
        acc[def.id] = { users: 0, metrics: {} };
        return acc;
    }, {});
    for (const row of assignmentCounts) {
        const cat = row.category;
        if (!totalsByCategory[cat])
            totalsByCategory[cat] = { users: 0, metrics: {} };
        totalsByCategory[cat].users += Number(row._count ?? 0);
    }
    for (const user of fallbackUsers) {
        const cat = (user.attendantCategory ?? "DIRECT_SALES_OPS");
        if (!totalsByCategory[cat])
            totalsByCategory[cat] = { users: 0, metrics: {} };
        totalsByCategory[cat].users += 1;
    }
    for (const agg of activityAgg) {
        const cat = agg.category;
        if (!totalsByCategory[cat])
            totalsByCategory[cat] = { users: 0, metrics: {} };
        const numericSum = agg.numeric_sum ? Number(agg.numeric_sum) : 0;
        const intSum = agg.int_sum ? Number(agg.int_sum) : 0;
        totalsByCategory[cat].metrics[agg.metric] = {
            numericSum,
            intSum,
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
    const combinedOrderCounts = {};
    for (const row of jumiaOrders) {
        combinedOrderCounts[`JUMIA ${row.status}`] = row._count;
    }
    for (const row of kilimallOrders) {
        combinedOrderCounts[`KILIMALL ${row.status}`] = row._count;
    }
    if (totalsByCategory["JUMIA_KILIMALL_OPS"]) {
        totalsByCategory["JUMIA_KILIMALL_OPS"].orderCounts = combinedOrderCounts;
    }
    // group concerns by attendant category (trim and ignore empty values)
    for (const r of concernsRows) {
        const cat = (r.attendantCategory ?? "DIRECT_SALES_OPS");
        if (!totalsByCategory[cat])
            totalsByCategory[cat] = { users: 0, metrics: {} };
        const c = totalsByCategory[cat].concerns ?? { count: 0, recent: [] };
        const text = r.concerns ? String(r.concerns).trim() : "";
        if (text.length === 0)
            continue;
        c.count += 1;
        // keep up to 5 recent concerns
        if (c.recent.length < 5)
            c.recent.push(text);
        totalsByCategory[cat].concerns = c;
    }
    return {
        since,
        days: rangeDays,
        categories: totalsByCategory,
    };
}
