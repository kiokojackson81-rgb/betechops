import { prisma } from "@/lib/prisma";
import type { AttendantCategory } from "@prisma/client";
import { attendantCategoryDefinitions } from "./definitions";

type TotalsByCategory = Record<
  AttendantCategory,
  {
    users: number;
    metrics: Record<string, { numericSum: number; intSum: number }>;
    orderCounts?: Record<string, number>;
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
    prisma.attendantActivity.groupBy({
      by: ["category", "metric"],
      where: { entryDate: { gte: since } },
      _sum: { numericValue: true, intValue: true },
    }),
    prisma.attendantCategoryAssignment.groupBy({
      by: ["category"],
      where: { user: { role: { in: ["ATTENDANT", "SUPERVISOR"] }, isActive: true } },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: {
        role: { in: ["ATTENDANT", "SUPERVISOR"] },
        isActive: true,
        categoryAssignments: { none: {} },
      },
      select: { attendantCategory: true },
    }),
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
  ]);

  const totalsByCategory = attendantCategoryDefinitions.reduce<TotalsByCategory>((acc, def) => {
    (acc as any)[def.id] = { users: 0, metrics: {} };
    return acc;
  }, {} as TotalsByCategory);

  for (const row of assignmentCounts) {
    const cat = row.category as AttendantCategory;
    if (!(totalsByCategory as any)[cat]) (totalsByCategory as any)[cat] = { users: 0, metrics: {} };
    (totalsByCategory as any)[cat].users += row._count._all;
  }

  for (const user of fallbackUsers) {
    const cat = user.attendantCategory as AttendantCategory;
    if (!(totalsByCategory as any)[cat]) (totalsByCategory as any)[cat] = { users: 0, metrics: {} };
    (totalsByCategory as any)[cat].users += 1;
  }

  for (const agg of activityAgg) {
    const cat = agg.category as AttendantCategory;
    if (!(totalsByCategory as any)[cat]) (totalsByCategory as any)[cat] = { users: 0, metrics: {} };
    const numeric = agg._sum.numericValue;
    const numericSum = numeric ? Number(numeric) : 0;
    (totalsByCategory as any)[cat].metrics[agg.metric] = {
      numericSum,
      intSum: agg._sum.intValue ?? 0,
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

  return {
    since,
    days: rangeDays,
    categories: totalsByCategory,
  };
}
