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

export async function getAttendantCategorySummary(days: number) {
  const rangeDays = Math.min(90, Math.max(1, days));
  const since = new Date();
  since.setDate(since.getDate() - rangeDays + 1);

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
