import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

function requireAdmin(session: any) {
  if (!session || !session.user) return false;
  const role = session.user.role ?? null;
  return role === "ADMIN" || role === "SUPERVISOR";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session: any = await getServerSession(authOptions as any);
  if (!requireAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attendantId = url.searchParams.get("attendantId");
  if (!attendantId) return NextResponse.json({ error: "attendantId required" }, { status: 400 });

  // Use current trading period bounds to scope receipts
  const period = getTradingPeriodFor(new Date());
  const start = period.start;
  const end = period.end;

  // Find receipts (order items) for attendant where buying price is missing or zero
  // and that fall within the trading period.
  const receipts = await prisma.order.findMany({
    where: {
      attendantId: attendantId,
      createdAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      totalAmount: true,
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          sellingPrice: true,
          orderCosts: { select: { unitCost: true } },
          profitSnapshots: { select: { unitCost: true } },
        },
      },
    },
  });

  // Filter receipts that have at least one orderItem lacking a buyingPrice
  const missing = receipts
    .map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      createdAt: r.createdAt,
      sellingTotal: r.totalAmount,
      items: r.items.filter((it) => {
        const hasCost = (it.orderCosts && it.orderCosts.length > 0) || (it.profitSnapshots && it.profitSnapshots.length > 0);
        return !hasCost;
      }),
    }))
    .filter((r) => (r.items?.length ?? 0) > 0);

  return NextResponse.json({ period: period.label ?? "", attendantId, missing });
}
