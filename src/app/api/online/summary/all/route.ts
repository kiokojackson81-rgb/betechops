import { NextRequest, NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAttendant(req, ["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const sales = await prisma.weeklySale.findMany({
    orderBy: { weekStart: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      shop: { select: { id: true, name: true } },
    },
  });

  const rows = sales.map((sale) => ({
    id: sale.id,
    userId: sale.userId,
    userName: sale.user?.name || sale.user?.email || sale.userId,
    shopId: sale.shopId,
    shopName: sale.shop?.name ?? null,
    weekStart: sale.weekStart,
    weekEnd: sale.weekEnd,
    amount: Number(sale.amount ?? 0),
    status: sale.status,
    createdAt: sale.createdAt,
  }));

  return NextResponse.json(rows);
}
