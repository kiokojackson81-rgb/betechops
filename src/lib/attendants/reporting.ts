import { prisma } from "@/lib/prisma";
import type { AttendantCategory } from "@prisma/client";
import { attendantCategoryDefinitions } from "./definitions";

type TotalsByCategory = Record<
  AttendantCategory,
  {
    users: number;
    metrics: Record<string, { numericSum: number; intSum: number }>;
    orderCounts?: Record<string, number>;
    concerns?: { count: number; recent: string[] };
  }
>;

type SummaryOptions =
  | number
  | {
      days?: number;
      tradingPeriod?: boolean;
      refDate?: string; // ISO date string to compute trading period around
    };

export async function getAttendantCategorySummary(opts: SummaryOptions = 7) {
  let rangeDays = 7;
  let since = new Date();

  if (typeof opts === "number") {
    rangeDays = Math.min(90, Math.max(1, opts));
    since = new Date();
    since.setDate(since.getDate() - rangeDays + 1);
  } else {
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
      } else {
        // start is 25th of previous month
        since = new Date(year, month - 1, 25);
        const end = new Date(year, month, 24);
        rangeDays = Math.ceil((end.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }
    } else {
      rangeDays = Math.min(90, Math.max(1, days));
      since = new Date();
      since.setDate(since.getDate() - rangeDays + 1);
    }
  }

  const [activityAgg, assignmentCounts, fallbackUsers, jumiaOrders, kilimallOrders] = await Promise.all([
    prisma.$queryRaw`
      SELECT category::text AS category, metric, SUM(COALESCE(numericValue::numeric, 0)) AS numeric_sum, SUM(COALESCE(intValue, 0)) AS int_sum
      FROM "AttendantActivity"
      WHERE "entryDate" >= ${since}
      GROUP BY category, metric
    `,
    prisma.$queryRaw`
      SELECT a.category::text AS category, COUNT(*) AS _count
      FROM "AttendantCategoryAssignment" a
      JOIN "User" u ON u.id = a."userId"
      WHERE u.role IN ('ATTENDANT','SUPERVISOR') AND u."isActive" = true
      GROUP BY a.category
    `,
    prisma.$queryRaw`
      SELECT u."attendantCategory"::text AS "attendantCategory"
      FROM "User" u
      WHERE u.role IN ('ATTENDANT','SUPERVISOR') AND u."isActive" = true
        AND NOT EXISTS (SELECT 1 FROM "AttendantCategoryAssignment" a WHERE a."userId" = u.id)
    `,
    prisma.order.groupBy({
      by: ["status"],
      where: { shop: { platform: "JUMIA" } },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { shop: { platform: "KILIMALL" } },
      _count: true,
    }),
  ] as const);

  // fetch DailyReport concerns with user category (limit recent rows)
  const concernsRows = await prisma.$queryRaw`
    SELECT d.concerns, d."createdAt", d."userId", u."attendantCategory"::text AS "attendantCategory"
    FROM "DailyReport" d
    LEFT JOIN "User" u ON u.id = d."userId"
    WHERE d.date >= ${since} AND d.concerns IS NOT NULL
    ORDER BY d."createdAt" DESC
  ` as Array<{
    concerns: string | null;
    createdAt: Date;
    userId: string | null;
    attendantCategory: string | null;
  }>;

  const totalsByCategory = attendantCategoryDefinitions.reduce<TotalsByCategory>((acc, def) => {
    (acc as any)[def.id] = { users: 0, metrics: {} };
    return acc;
  }, {} as TotalsByCategory);

  for (const row of assignmentCounts as Array<{ category: string; _count: string | number }>) {
    const cat = row.category as AttendantCategory;
    if (!(totalsByCategory as any)[cat]) (totalsByCategory as any)[cat] = { users: 0, metrics: {} };
    (totalsByCategory as any)[cat].users += Number((row as any)._count ?? 0);
  }

  for (const user of fallbackUsers as Array<{ attendantCategory: string | null }>) {
    const cat = (user.attendantCategory ?? "DIRECT_SALES_OPS") as AttendantCategory;
    if (!(totalsByCategory as any)[cat]) (totalsByCategory as any)[cat] = { users: 0, metrics: {} };
    (totalsByCategory as any)[cat].users += 1;
  }

  for (const agg of activityAgg as Array<{ category: string; metric: string; numeric_sum: string | null; int_sum: string | null }>) {
    const cat = agg.category as AttendantCategory;
    if (!(totalsByCategory as any)[cat]) (totalsByCategory as any)[cat] = { users: 0, metrics: {} };
    const numericSum = agg.numeric_sum ? Number(agg.numeric_sum) : 0;
    const intSum = agg.int_sum ? Number(agg.int_sum) : 0;
    (totalsByCategory as any)[cat].metrics[agg.metric] = {
      numericSum,
      intSum,
    };
  }

  const jumiaCounts: Record<string, number> = {};
  for (const row of jumiaOrders) {
    jumiaCounts[row.status] = row._count;
  }
  const kilimallCounts: Record<string, number> = {};
  for (const row of kilimallOrders) {
    kilimallCounts[row.status] = row._count;
  }

  const combinedOrderCounts: Record<string, number> = {};
  for (const row of jumiaOrders) {
    combinedOrderCounts[`JUMIA ${row.status}`] = row._count;
  }
  for (const row of kilimallOrders) {
    combinedOrderCounts[`KILIMALL ${row.status}`] = row._count;
  }
  if ((totalsByCategory as any)["JUMIA_KILIMALL_OPS"]) {
    (totalsByCategory as any)["JUMIA_KILIMALL_OPS"].orderCounts = combinedOrderCounts;
  }

  // group concerns by attendant category (trim and ignore empty values)
  for (const r of concernsRows) {
    const cat = ((r.attendantCategory ?? "DIRECT_SALES_OPS") as AttendantCategory) as AttendantCategory;
    if (!(totalsByCategory as any)[cat]) (totalsByCategory as any)[cat] = { users: 0, metrics: {} };
    const c = (totalsByCategory as any)[cat].concerns ?? { count: 0, recent: [] };
    const text = r.concerns ? String(r.concerns).trim() : "";
    if (text.length === 0) continue;
    c.count += 1;
    // keep up to 5 recent concerns
    if (c.recent.length < 5) c.recent.push(text);
    (totalsByCategory as any)[cat].concerns = c;
  }

  return {
    since,
    days: rangeDays,
    categories: totalsByCategory,
  };
}
