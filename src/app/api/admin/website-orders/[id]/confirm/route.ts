import { NextRequest, NextResponse } from "next/server";
import { WebsiteOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureWebsiteOrdersSchema, requireWebsiteOrdersAdmin, serializeWebsiteOrder, websiteOrderAdminInclude } from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

export async function POST(_: NextRequest, context: { params: Promise<any> }) {
  const guard = await requireWebsiteOrdersAdmin();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  await ensureWebsiteOrdersSchema();

  const { id } = (await context.params) as { id: string };
  const existing = await prisma.websiteOrder.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Website order not found." }, { status: 404 });
  }

  if (existing.status === WebsiteOrderStatus.CANCELLED) {
    return NextResponse.json({ ok: false, error: "Cancelled website orders cannot be confirmed." }, { status: 400 });
  }

  const order = await prisma.websiteOrder.update({
    where: { id },
    data: {
      status: existing.status === WebsiteOrderStatus.RECEIPT_ISSUED ? existing.status : WebsiteOrderStatus.CONFIRMED,
      confirmedAt: new Date(),
      confirmedById: guard.userId,
    },
    include: websiteOrderAdminInclude,
  });

  return NextResponse.json({ ok: true, order: serializeWebsiteOrder(order) });
}
