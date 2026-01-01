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
      externalId: true,
      createdAt: true,
      sellingTotal: true,
      orderItems: {
        select: {
          id: true,
          productId: true,
          qty: true,
          sellingPrice: true,
          buyingPrice: true,
        },
      },
    },
  });

  // Filter receipts that have at least one orderItem lacking a buyingPrice
  const missing = receipts
    .map((r) => ({
      id: r.id,
      externalId: r.externalId,
      createdAt: r.createdAt,
      sellingTotal: r.sellingTotal,
      items: r.orderItems.filter((it) => it.buyingPrice == null || Number(it.buyingPrice) === 0),
    }))
    .filter((r) => (r.items?.length ?? 0) > 0);

  return NextResponse.json({ period: period.label ?? "", attendantId, missing });
}
