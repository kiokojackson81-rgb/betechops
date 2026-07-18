import { NextRequest, NextResponse } from "next/server";
import { Prisma, WebsiteOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureReviewInvitationsForWebsiteOrder, syncReferralLinkForWebsiteOrder } from "@/lib/reviewsReferrals";
import {
  buildWebsiteOrderReceiptPayload,
  canAdvanceWebsiteOrderStatus,
  ensureWebsiteOrdersSchema,
  isWebsiteOrderPod,
  requireWebsiteOrdersAdmin,
  serializeWebsiteOrder,
  websiteOrderAdminInclude,
} from "@/lib/websiteOrders";

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
    include: websiteOrderAdminInclude,
  }).catch(() => null);

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Website order not found." }, { status: 404 });
  }

  const transition = canAdvanceWebsiteOrderStatus(existing.status, parsed.data.status);
  if (!transition.ok) {
    return NextResponse.json({ ok: false, error: transition.error }, { status: 409 });
  }

  let metadata =
    existing.metadata && typeof existing.metadata === "object"
      ? { ...(existing.metadata as Record<string, unknown>) }
      : {};
  const updates: Record<string, unknown> = { status: parsed.data.status };
  const nowIso = new Date().toISOString();

  if (parsed.data.status === WebsiteOrderStatus.PROCESSING) {
    metadata.processingAt = metadata.processingAt ?? nowIso;
  }

  if (parsed.data.status === WebsiteOrderStatus.RECEIPT_ISSUED) {
    const serialized = await serializeWebsiteOrder(existing);
    const mode = isWebsiteOrderPod(serialized.orderType, serialized.paymentMethod) ? "pod" : "normal";
    if (!existing.receiptId) {
      const receiptPayload = buildWebsiteOrderReceiptPayload(serialized, mode);
      const receiptResponse = await fetch(new URL("/api/receipts?link=1", request.nextUrl.origin), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie") as string } : {}),
        },
        body: JSON.stringify(receiptPayload),
        cache: "no-store",
      });
      const receiptData = await receiptResponse.json().catch(() => null);
      if (!receiptResponse.ok || !receiptData?.ok) {
        return NextResponse.json(
          { ok: false, error: receiptData?.message || receiptData?.error || "Failed to create receipt automatically." },
          { status: 500 },
        );
      }
      const latestLinked = await prisma.websiteOrder.findUnique({
        where: { id },
        select: { metadata: true, receiptId: true },
      });
      if (latestLinked?.metadata && typeof latestLinked.metadata === "object") {
        metadata = { ...(latestLinked.metadata as Record<string, unknown>) };
      }
      if (latestLinked?.receiptId) {
        updates.receiptId = latestLinked.receiptId;
      }
    } else {
      updates.receiptId = existing.receiptId;
    }
    metadata.receiptIssuedAt = nowIso;
    metadata.receiptFlowMode = mode;
    metadata.receiptIssuedAutomatically = true;
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

  await syncReferralLinkForWebsiteOrder(order.id).catch((error) => {
    console.error("[referrals] failed to sync customer referral after admin website order status change", {
      orderId: order.id,
      status: order.status,
      error: error instanceof Error ? error.message : String(error),
    });
  });
  await ensureReviewInvitationsForWebsiteOrder(order.id).catch((error) => {
    console.error("[reviews] failed to provision review invitations after admin website order status change", {
      orderId: order.id,
      status: order.status,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return NextResponse.json({ ok: true, order: await serializeWebsiteOrder(order) });
}
