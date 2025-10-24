import { prisma } from "@/lib/prisma";
import { computeProfit } from "@/lib/profit";
import type { Prisma, SettlementRow } from '@prisma/client';

export type RecomputeArgs = { from: Date; to: Date; shopId?: string | null; actorId?: string | null };

export async function recomputeProfit({ from, to, shopId, actorId }: RecomputeArgs) {
  const rows = await prisma.settlementRow.findMany({
    where: { postedAt: { gte: from, lte: to }, ...(shopId ? { shopId } : {}), orderItemId: { not: null } },
  });
  if (!rows.length) return { snapshots: 0 };

    const byItem = new Map<string, unknown[]>();
  for (const r of rows) {
    const id = r.orderItemId as string;
    if (!byItem.has(id)) byItem.set(id, []);
    byItem.get(id)!.push(r);
  }
  const itemIds = Array.from(byItem.keys());
  const items = await prisma.orderItem.findMany({
    where: { id: { in: itemIds } },
    include: { product: { select: { sku: true, category: true } }, order: { select: { shopId: true, createdAt: true } } },
  });
    type ItemInfo = { id: string; product?: { sku?: string; category?: string | null }; order?: { shopId?: string | null; createdAt?: Date | string }; quantity?: number | null; sellingPrice?: number | null };
    const itemMap = new Map<string, ItemInfo>(items.map((i) => [i.id, i as unknown as ItemInfo]));

  const overrides = await prisma.orderCost.findMany({ where: { orderItemId: { in: itemIds } }, orderBy: { createdAt: "desc" } });
  const latestOverride = new Map<string, unknown>();
  for (const oc of overrides) if (!latestOverride.has(oc.orderItemId)) latestOverride.set(oc.orderItemId, oc);

  let snapshots = 0;
  const now = new Date();
  for (const orderItemId of itemIds) {
    const info = itemMap.get(orderItemId);
    if (!info) continue;
    const sku = info.product?.sku as string;
    const qty = Number(info.quantity || 0);
    const sellPrice = Number(info.sellingPrice || 0);
    const refDate: Date = new Date(info.order?.createdAt || now);
    const shop = info.order?.shopId || null;

    const rowsFor = (byItem.get(orderItemId) || []) as unknown[];
    const sumBy = (k: string) => (rowsFor as SettlementRow[])
      .filter((r) => ((r.kind || "") as string).toLowerCase() === k)
      .reduce((t: number, r) => t + Number((r.amount as unknown) ?? 0), 0);
    const commission = sumBy("commission");
    const penalty = sumBy("penalty");
    const shipping_fee = sumBy("shipping_fee");
    const refund = sumBy("refund");

    let unitCost: number | null = null;
  const oc = latestOverride.get(orderItemId) as { unitCost?: number | string } | undefined;
  if (oc) unitCost = Number(oc.unitCost || 0);
    if (unitCost == null) {
      const catShop = await prisma.costCatalog.findFirst({
        where: { sku, shopId: shop, effectiveFrom: { lte: refDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: refDate } }] },
        orderBy: { effectiveFrom: "desc" },
      });
      if (catShop) unitCost = Number(catShop.cost || 0);
      if (unitCost == null) {
        const catGlobal = await prisma.costCatalog.findFirst({
          where: { sku, shopId: null, effectiveFrom: { lte: refDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: refDate } }] },
          orderBy: { effectiveFrom: "desc" },
        });
        if (catGlobal) unitCost = Number(catGlobal.cost || 0);
      }
    }
    if (unitCost == null) unitCost = 0;

    const p = computeProfit({ sellPrice: sellPrice, qty, unitCost, settlement: { commission: [commission], penalty: [penalty], shipping_fee: [shipping_fee], refund: [refund] } });
    const snap = await prisma.profitSnapshot.create({ data: { orderItemId, revenue: p.revenue, fees: p.fees, shipping: p.shipping, refunds: p.refunds, unitCost: p.unitCost, qty: p.qty, profit: p.profit } });
    snapshots++;
  if (actorId) await prisma.actionLog.create({ data: { actorId, entity: "ProfitSnapshot", entityId: snap.id, action: "RECOMPUTE", before: undefined, after: snap as unknown as Prisma.InputJsonValue } });
  }
  return { snapshots };
}
