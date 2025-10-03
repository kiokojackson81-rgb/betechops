import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { computeProfit } from "@/lib/profit";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const { from, to, shopId } = await req.json().catch(() => ({} as any));
  const now = new Date();
  const fromAt = from ? new Date(from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const toAt = to ? new Date(to) : now;
  if (isNaN(fromAt.getTime()) || isNaN(toAt.getTime())) return noStoreJson({ error: "invalid from/to" }, { status: 400 });

  // Pull settlement rows in window, optionally shop-scoped
  const rows = await (prisma as any).settlementRow.findMany({
    where: {
      postedAt: { gte: fromAt, lte: toAt },
      ...(shopId ? { shopId } : {}),
      orderItemId: { not: null },
    },
  });
  if (!rows.length) return noStoreJson({ ok: true, inserted: 0, snapshots: 0 });

  // Group rows by orderItemId
  const byItem = new Map<string, any[]>();
  for (const r of rows) {
    const id = r.orderItemId as string;
    if (!byItem.has(id)) byItem.set(id, []);
    byItem.get(id)!.push(r);
  }

  const itemIds = Array.from(byItem.keys());
  // Fetch order items with product (sku) and order (shopId, createdAt)
  const items = await (prisma as any).orderItem.findMany({
    where: { id: { in: itemIds } },
    include: { product: { select: { sku: true, category: true } }, order: { select: { shopId: true, createdAt: true } } },
  });
  const itemMap = new Map<string, any>(items.map((i: any) => [i.id, i]));

  // Prefetch overrides
  const overrides = await (prisma as any).orderCost.findMany({
    where: { orderItemId: { in: itemIds } },
    orderBy: { createdAt: "desc" },
  });
  const latestOverride = new Map<string, any>();
  for (const oc of overrides) if (!latestOverride.has(oc.orderItemId)) latestOverride.set(oc.orderItemId, oc);

  const actorId = await getActorId();
  let snapshots = 0;

  for (const orderItemId of itemIds) {
    const info = itemMap.get(orderItemId);
    if (!info) continue;
    const sku = info.product?.sku as string;
    const qty = Number(info.quantity || 0);
    const sellPrice = Number(info.sellingPrice || 0);
    const refDate: Date = new Date(info.order?.createdAt || now);
    const shop: string | null = info.order?.shopId || null;

    // Aggregate settlements
    const rowsFor = byItem.get(orderItemId) || [];
    const sumBy = (k: string) => rowsFor.filter((r: any) => (r.kind || "").toLowerCase() === k).reduce((t: number, r: any) => t + Number(r.amount || 0), 0);
    const commission = sumBy("commission");
    const penalty = sumBy("penalty");
    const shipping_fee = sumBy("shipping_fee");
    const refund = sumBy("refund");

    // Resolve unit cost: override else active catalog (shop-specific preferred else global)
    let unitCost: number | null = null;
    const oc = latestOverride.get(orderItemId);
    if (oc) unitCost = Number(oc.unitCost || 0);
    if (unitCost == null) {
      // shop-specific
      const catShop = await (prisma as any).costCatalog.findFirst({
        where: {
          sku,
          shopId: shop,
          effectiveFrom: { lte: refDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: refDate } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });
      if (catShop) unitCost = Number(catShop.cost || 0);
      if (unitCost == null) {
        const catGlobal = await (prisma as any).costCatalog.findFirst({
          where: {
            sku,
            shopId: null,
            effectiveFrom: { lte: refDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: refDate } }],
          },
          orderBy: { effectiveFrom: "desc" },
        });
        if (catGlobal) unitCost = Number(catGlobal.cost || 0);
      }
    }
    if (unitCost == null) unitCost = 0;

    const basis = {
      sellPrice,
      qty,
      settlement: {
        commission: [commission],
        penalty: [penalty],
        shipping_fee: [shipping_fee],
        refund: [refund],
      },
      unitCost,
    };
    const p = computeProfit(basis);

    const snap = await (prisma as any).profitSnapshot.create({
      data: {
        orderItemId,
        revenue: p.revenue,
        fees: p.fees,
        shipping: p.shipping,
        refunds: p.refunds,
        unitCost: p.unitCost,
        qty: p.qty,
        profit: p.profit,
      },
    });
    snapshots++;
    if (actorId) await (prisma as any).actionLog.create({ data: { actorId, entity: "ProfitSnapshot", entityId: snap.id, action: "RECOMPUTE", before: null, after: snap } });
  }

  return noStoreJson({ ok: true, window: { from: fromAt.toISOString(), to: toAt.toISOString() }, shopId: shopId || null, snapshots });
}
