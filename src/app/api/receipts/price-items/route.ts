import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PriceItem = { orderItemId: string; buyingPrice: number };

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const items: PriceItem[] = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ error: "No items provided" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const touchedOrderIds = new Set<string>();
      for (const it of items) {
        const price = Math.round(Number(it.buyingPrice || 0));
        if (!it.orderItemId || !Number.isFinite(price) || price <= 0) continue;
        try {
          if ((tx as any).orderCost) {
            await (tx as any).orderCost.create({ data: { orderItemId: it.orderItemId, unitCost: price, costSource: "ADMIN_BATCH_PRICING" } });
          }
        } catch (e) {
          // ignore per-item failures
        }
        const oi = await tx.orderItem.findUnique({ where: { id: it.orderItemId }, select: { orderId: true } });
        if (oi?.orderId) touchedOrderIds.add(oi.orderId);
      }

      // recompute outside of inner loop
      for (const orderId of Array.from(touchedOrderIds)) {
        try {
          const { recomputeOrderEconomics } = await import("@/lib/recomputeOrderEconomics");
          await recomputeOrderEconomics(orderId);
        } catch (e) {
          // best-effort
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[receipts/price-items] failed", err);
    return NextResponse.json({ error: "Failed to price items" }, { status: 500 });
  }
}

export default POST;
