import { NextRequest, NextResponse } from "next/server";
import { WebsiteOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  buildWebsiteOrderReceiptPrefill,
  isWebsiteOrderPod,
  requireWebsiteOrdersAdmin,
  serializeWebsiteOrder,
  websiteOrderAdminInclude,
} from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["pod", "normal"]).optional(),
});

function encodePrefill(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export async function POST(request: NextRequest, context: { params: Promise<any> }) {
  const guard = await requireWebsiteOrdersAdmin();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = (await context.params) as { id: string };
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid receipt draft payload." }, { status: 400 });
  }

  const existing = await prisma.websiteOrder.findUnique({
    where: { id },
    include: websiteOrderAdminInclude,
  });

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Website order not found." }, { status: 404 });
  }

  if (existing.status === WebsiteOrderStatus.CANCELLED) {
    return NextResponse.json({ ok: false, error: "Cancelled website orders cannot be routed to receipts." }, { status: 400 });
  }

  const order = serializeWebsiteOrder(existing);
  const defaultMode = isWebsiteOrderPod(order.orderType, order.paymentMethod) ? "pod" : "normal";
  const mode = parsed.data.mode ?? defaultMode;
  const prefill = buildWebsiteOrderReceiptPrefill(order, mode);
  const url = `/receipts?prefill=${encodeURIComponent(encodePrefill(prefill))}`;

  return NextResponse.json({
    ok: true,
    mode,
    url,
    order,
  });
}
