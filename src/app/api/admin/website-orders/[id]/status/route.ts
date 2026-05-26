import { NextRequest, NextResponse } from "next/server";
import { Prisma, WebsiteOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureWebsiteOrdersSchema, requireWebsiteOrdersAdmin, serializeWebsiteOrder, websiteOrderAdminInclude } from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.nativeEnum(WebsiteOrderStatus),
  paymentConfirmationMethod: z.string().trim().min(2).max(100).optional(),
  paymentConfirmationReference: z.string().trim().max(100).optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<any> }) {
  const guard = await requireWebsiteOrdersAdmin();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  await ensureWebsiteOrdersSchema();

  const { id } = (await context.params) as { id: string };
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid status payload." }, { status: 400 });
  }

  const existing = await prisma.websiteOrder.findUnique({
    where: { id },
    select: {
      id: true,
      metadata: true,
      status: true,
    },
  }).catch(() => null);

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Website order not found." }, { status: 404 });
  }

  const metadata =
    existing.metadata && typeof existing.metadata === "object"
      ? { ...(existing.metadata as Record<string, unknown>) }
      : {};
  const updates: Record<string, unknown> = { status: parsed.data.status };
  const nowIso = new Date().toISOString();

  if (parsed.data.status === WebsiteOrderStatus.PROCESSING) {
    metadata.processingAt = metadata.processingAt ?? nowIso;
  }

  if (parsed.data.status === WebsiteOrderStatus.RECEIPT_ISSUED) {
    metadata.receiptIssuedAt = nowIso;
  }

  if (parsed.data.status === WebsiteOrderStatus.DISPATCHED) {
    metadata.dispatchedAt = nowIso;
  }

  if (parsed.data.status === WebsiteOrderStatus.PAYMENT_CONFIRMED) {
    if (!parsed.data.paymentConfirmationMethod) {
      return NextResponse.json({ ok: false, error: "Payment confirmation method is required." }, { status: 400 });
    }
    metadata.paymentConfirmedAt = nowIso;
    metadata.paymentConfirmationMethod = parsed.data.paymentConfirmationMethod;
    metadata.paymentConfirmationReference = parsed.data.paymentConfirmationReference?.trim() || null;
  }

  if (parsed.data.status === WebsiteOrderStatus.DELIVERED) {
    metadata.deliveredAt = nowIso;
  }

  if (parsed.data.status === WebsiteOrderStatus.CANCELLED) {
    updates.cancelledAt = new Date();
  }

  updates.metadata = metadata as Prisma.InputJsonValue;

  const order = await prisma.websiteOrder.update({
    where: { id },
    data: updates,
    include: websiteOrderAdminInclude,
  });

  return NextResponse.json({ ok: true, order: serializeWebsiteOrder(order) });
}
