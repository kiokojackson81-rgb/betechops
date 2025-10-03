import { prisma } from "@/lib/prisma";
import { computeProfit } from "@/lib/profit";

export type RecomputeArgs = { from: Date; to: Date; shopId?: string | null; actorId?: string | null };

export async function recomputeProfit({ from, to, shopId, actorId }: RecomputeArgs) {
  const rows = await (prisma as any).settlementRow.findMany({
    where: { postedAt: { gte: from, lte: to }, ...(shopId ? { shopId } : {}), orderItemId: { not: null } },
  });
  if (!rows.length) return { snapshots: 0 };

  const byItem = new Map<string, any[]>();
  for (const r of rows) {
    const id = r.orderItemId as string;
    if (!byItem.has(id)) byItem.set(id, []);
    byItem.get(id)!.push(r);
  }
  const itemIds = Array.from(byItem.keys());
  const items = await (prisma as any).orderItem.findMany({
    where: { id: { in: itemIds } },
    include: { product: { select: { sku: true, category: true } }, order: { select: { shopId: true, createdAt: true } } },
  });
  const itemMap = new Map<string, any>(items.map((i: any) => [i.id, i]));

  const overrides = await (prisma as any).orderCost.findMany({ where: { orderItemId: { in: itemIds } }, orderBy: { createdAt: "desc" } });
  const latestOverride = new Map<string, any>();
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

    const rowsFor = byItem.get(orderItemId) || [];
    const sumBy = (k: string) => rowsFor.filter((r: any) => (r.kind || "").toLowerCase() === k).reduce((t: number, r: any) => t + Number(r.amount || 0), 0);
    const commission = sumBy("commission");
    const penalty = sumBy("penalty");
    const shipping_fee = sumBy("shipping_fee");
    const refund = sumBy("refund");

    let unitCost: number | null = null;
    const oc = latestOverride.get(orderItemId);
    if (oc) unitCost = Number(oc.unitCost || 0);
    if (unitCost == null) {
      const catShop = await (prisma as any).costCatalog.findFirst({
        where: { sku, shopId: shop, effectiveFrom: { lte: refDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: refDate } }] },
        orderBy: { effectiveFrom: "desc" },
      });
      if (catShop) unitCost = Number(catShop.cost || 0);
      if (unitCost == null) {
        const catGlobal = await (prisma as any).costCatalog.findFirst({
          where: { sku, shopId: null, effectiveFrom: { lte: refDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: refDate } }] },
          orderBy: { effectiveFrom: "desc" },
        });
        if (catGlobal) unitCost = Number(catGlobal.cost || 0);
      }
    }
    if (unitCost == null) unitCost = 0;

    const p = computeProfit({ sellPrice: sellPrice, qty, unitCost, settlement: { commission: [commission], penalty: [penalty], shipping_fee: [shipping_fee], refund: [refund] } });
    const snap = await (prisma as any).profitSnapshot.create({ data: { orderItemId, revenue: p.revenue, fees: p.fees, shipping: p.shipping, refunds: p.refunds, unitCost: p.unitCost, qty: p.qty, profit: p.profit } });
    snapshots++;
    if (actorId) await (prisma as any).actionLog.create({ data: { actorId, entity: "ProfitSnapshot", entityId: snap.id, action: "RECOMPUTE", before: null, after: snap } });
  }
  return { snapshots };
}
