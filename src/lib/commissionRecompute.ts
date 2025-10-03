import { prisma } from "@/lib/prisma";
import { pickRule, computeCommission } from "@/lib/commissions";

type Window = { from: Date; to: Date };

export type RecomputeInput = {
  shopId?: string | null;
  window: Window;
};

export type RecomputeResult = {
  deleted: number;
  created: number;
  reversed: number;
};

export async function recomputeCommissions(input: RecomputeInput): Promise<RecomputeResult> {
  const { shopId, window } = input;
  const from = new Date(window.from);
  const to = new Date(window.to);

  // Fetch relevant snapshots with orderItem->product and order relation
  const snapshots = await (prisma as any).profitSnapshot.findMany({
    where: {
      computedAt: { gte: from, lte: to },
      orderItem: shopId ? { order: { shopId } } : undefined,
    },
    include: {
      orderItem: {
        include: {
          product: true,
          order: true,
        },
      },
    },
  });

  // Collect shopIds present for rule pre-filtering
  const shopIds = Array.from(
    new Set(
      snapshots
        .map((s: any) => s.orderItem?.order?.shopId)
        .filter(Boolean)
    )
  ) as string[];

  // Fetch CommissionRules overlapping the window; we'll filter by scope in-memory
  const rules = await (prisma as any).commissionRule.findMany({
    where: {
      AND: [
        { effectiveFrom: { lte: to } },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }] },
      ],
      // Narrow by shopId for shop-scoped rules if available
      OR: [
        { scope: "global" },
        { scope: "sku" },
        { scope: "category" },
        shopIds.length ? { AND: [{ scope: "shop" }, { shopId: { in: shopIds } }] } : { scope: "shop" },
      ],
    },
  });

  // Remove existing earnings in the window and scope to avoid duplicates
  const delRes = await (prisma as any).commissionEarning.deleteMany({
    where: {
      createdAt: { gte: from, lte: to },
      orderItem: shopId ? { order: { shopId } } : undefined,
    },
  });

  type EarningRow = {
    staffId: string;
    orderItemId: string;
    basis: string;
    qty: number;
    amount: number;
    status: string;
    calcDetail: any;
    createdAt: Date;
  };

  const earnings: EarningRow[] = [];

  for (const s of snapshots as any[]) {
    const order = s.orderItem?.order;
    const product = s.orderItem?.product;
    const staffId = order?.attendantId as string | null;
    if (!order || !product || !staffId) continue; // cannot attribute without attendant
    const basis = {
      revenue: Number(s.revenue),
      profit: Number(s.profit),
      qty: Number(s.qty || 1),
      sku: String(product.sku),
      category: product.category || null,
      shopId: String(order.shopId),
      at: new Date(s.computedAt),
    };

    const rule = pickRule(rules as any[], basis);
    if (!rule) continue;
    const { amount, detail } = computeCommission(rule as any, basis);
    if (!amount) continue;

    const basisKind = (rule as any).type === "percent_profit" ? "profit" : (rule as any).type === "percent_gross" ? "gross" : "flat";

    earnings.push({
      staffId,
      orderItemId: s.orderItemId,
      basis: basisKind,
      qty: basis.qty,
      amount: Number(amount),
      status: "pending",
      calcDetail: { ...detail, at: basis.at, shopId: basis.shopId, sku: basis.sku },
      createdAt: new Date(),
    });
  }

  // Handle return reversals within window: create negative entries for impacted items
  const adjustments = await (prisma as any).returnAdjustment.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      returnCase: shopId ? { shopId } : undefined,
    },
    include: {
      orderItem: { include: { order: true } },
    },
  });

  // Map to total computed per orderItem from this batch
  const totalsByItem = new Map<string, number>();
  for (const e of earnings) {
    totalsByItem.set(e.orderItemId, (totalsByItem.get(e.orderItemId) || 0) + Number(e.amount));
  }

  let reversed = 0;
  for (const adj of adjustments as any[]) {
    if (adj.commissionImpact !== "reverse") continue;
    const itemId = adj.orderItemId as string;
    const order = adj.orderItem?.order;
    const staffId = order?.attendantId as string | null;
    if (!staffId) continue;
    const total = totalsByItem.get(itemId) || 0;
    if (!total) continue;
    earnings.push({
      staffId,
      orderItemId: itemId,
      basis: "profit",
      qty: 0,
      amount: -Math.abs(total),
      status: "reversed",
      calcDetail: { reason: "return_reverse", adjustmentId: adj.id },
      createdAt: new Date(),
    });
    reversed++;
  }

  let created = 0;
  if (earnings.length) {
    const res = await (prisma as any).commissionEarning.createMany({ data: earnings });
    created = res.count || 0;
  }

  return { deleted: delRes.count || 0, created, reversed };
}
