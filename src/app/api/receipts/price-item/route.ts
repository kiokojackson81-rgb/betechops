import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";
import { publishSummaryUpdate } from "@/lib/receiptSseBroker";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

type Payload = { orderItemId: string; buyingPrice: number };

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const email = (session.user as { email?: string }).email?.toLowerCase();
  const allowPricing = role === "ADMIN" || email === process.env.SUPPORT_PRICING_EMAIL?.toLowerCase();
  if (!allowPricing) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { orderItemId, buyingPrice } = payload ?? {};
  if (!orderItemId || typeof orderItemId !== "string") return NextResponse.json({ error: "orderItemId is required" }, { status: 400 });
  if (!Number.isFinite(buyingPrice) || buyingPrice <= 0) return NextResponse.json({ error: "buyingPrice must be positive" }, { status: 400 });

  const rounded = Math.round(buyingPrice);

  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId }, include: { order: true } });
  if (!item) return NextResponse.json({ error: "OrderItem not found" }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      if ((tx as any).orderCost) {
        await (tx as any).orderCost.create({ data: { orderItemId, unitCost: rounded, costSource: "ADMIN_PRICING" } });
      }
    });

    // Recompute order economics and ledgers
    try {
      const { recomputeOrderEconomics } = await import("@/lib/recomputeOrderEconomics");
      await recomputeOrderEconomics(item.orderId);
    } catch (e) {
      // best-effort
    }

    try {
      const period = getTradingPeriodFor(new Date());
      const attendantId = item.order?.attendantId ?? null;
      if (attendantId) {
        const { recomputeDirectSalesLedger } = await import("@/lib/directSalesLedger");
        await recomputeDirectSalesLedger({ userId: attendantId, period });
      }
    } catch (e) {
      // ignore
    }

    try {
      publishSummaryUpdate({ attendantId: item.order?.attendantId ?? null, timestamp: new Date().toISOString() });
    } catch (e) {
      // ignore
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[receipts/price-item] failed", error);
    return NextResponse.json({ error: "Failed to price item" }, { status: 500 });
  }
}

export default POST;
