import { NextRequest, NextResponse } from "next/server";
import { WebsiteOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWebsiteOrdersAdmin, serializeWebsiteOrder, websiteOrderAdminInclude } from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.nativeEnum(WebsiteOrderStatus),
});

export async function PATCH(request: NextRequest, context: { params: Promise<any> }) {
  const guard = await requireWebsiteOrdersAdmin();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = (await context.params) as { id: string };
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid status payload." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    status: parsed.data.status,
  };

  if (parsed.data.status === WebsiteOrderStatus.CANCELLED) {
    updates.cancelledAt = new Date();
  }

  const order = await prisma.websiteOrder.update({
    where: { id },
    data: updates,
    include: websiteOrderAdminInclude,
  }).catch(() => null);

  if (!order) {
    return NextResponse.json({ ok: false, error: "Website order not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order: serializeWebsiteOrder(order) });
}
