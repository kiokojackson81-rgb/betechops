import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureWebsiteOrdersSchema, requireWebsiteOrdersAdmin, serializeWebsiteOrder, websiteOrderAdminInclude } from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, context: { params: Promise<any> }) {
  const guard = await requireWebsiteOrdersAdmin();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  await ensureWebsiteOrdersSchema();

  const { id } = (await context.params) as { id: string };
  const order = await prisma.websiteOrder.findUnique({
    where: { id },
    include: websiteOrderAdminInclude,
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: "Website order not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order: await serializeWebsiteOrder(order) });
}
