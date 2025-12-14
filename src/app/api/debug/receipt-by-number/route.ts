import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session: any = await getServerSession(authOptions as any);
  if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const orderNumber = url.searchParams.get("orderNumber");
  if (!orderNumber) return NextResponse.json({ error: "Missing orderNumber" }, { status: 400 });

  // Find receipt and related order/issuedBy info
  const receipt = await prisma.receipt.findFirst({
    where: { order: { orderNumber } },
    include: { order: { select: { id: true, orderNumber: true, attendantId: true } }, issuedBy: { select: { id: true, name: true, email: true } } },
  });

  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orderAttendantId = (receipt as any).order?.attendantId ?? null;
  const issuedById = (receipt as any).issuedBy?.id ?? null;
  const userId = session.user?.id ?? null;

  // Allow if the logged-in user is the order attendant or the issuedBy user
  if (userId !== orderAttendantId && userId !== issuedById) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mapped = {
    id: receipt.id,
    orderId: receipt.orderId,
    orderNumber: (receipt as any).order?.orderNumber ?? null,
    issuedById,
    orderAttendantId,
    generatedAt: receipt.generatedAt,
    totals: receipt.totals,
    data: receipt.data ?? null,
  };

  return NextResponse.json({ receipt: mapped });
}
