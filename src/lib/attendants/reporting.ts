import { prisma } from "@/lib/prisma";
import type { AttendantCategory } from "@prisma/client";
import { attendantCategories } from "./categories";

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

  const [activityAgg, userCounts, jumiaOrders, kilimallOrders] = await Promise.all([
    prisma.attendantActivity.groupBy({
      by: ["category", "metric"],
      where: { entryDate: { gte: since } },
      _sum: { numericValue: true, intValue: true },
    }),
    prisma.user.groupBy({
      by: ["attendantCategory"],
      _count: true,
      where: { role: { in: ["ATTENDANT", "SUPERVISOR"] }, isActive: true },
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

  const totalsByCategory = attendantCategories.reduce<TotalsByCategory>((acc, def) => {
    acc[def.id] = { users: 0, metrics: {} };
    return acc;
  }, {} as TotalsByCategory);

  for (const row of userCounts) {
    const cat = row.attendantCategory as AttendantCategory;
    if (!totalsByCategory[cat]) totalsByCategory[cat] = { users: 0, metrics: {} };
    totalsByCategory[cat].users = row._count;
  }

  for (const agg of activityAgg) {
    const cat = agg.category as AttendantCategory;
    if (!totalsByCategory[cat]) totalsByCategory[cat] = { users: 0, metrics: {} };
    const numeric = agg._sum.numericValue;
    const numericSum = numeric ? Number(numeric) : 0;
    totalsByCategory[cat].metrics[agg.metric] = {
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
