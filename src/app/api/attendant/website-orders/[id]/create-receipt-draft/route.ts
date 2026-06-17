import { NextRequest, NextResponse } from "next/server";
import { Prisma, WebsiteOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  buildWebsiteOrderReceiptPrefill,
  ensureWebsiteOrderAssignments,
  ensureWebsiteOrdersSchema,
  isWebsiteOrderAssignedToUser,
  isWebsiteOrderPod,
  requireWebsiteOrdersStaffActor,
  serializeWebsiteOrder,
  websiteOrderAdminInclude,
  withWebsiteOrderAssignmentMetadata,
} from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["pod", "normal"]).optional(),
});

function encodePrefill(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export async function POST(request: NextRequest, context: { params: Promise<any> }) {
  const guard = await requireWebsiteOrdersStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  await ensureWebsiteOrdersSchema();
  await ensureWebsiteOrderAssignments();

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

  if (!existing || !isWebsiteOrderAssignedToUser(existing.metadata, guard.userId)) {
    return NextResponse.json({ ok: false, error: "Website order not found." }, { status: 404 });
  }

  if (existing.status === WebsiteOrderStatus.CANCELLED) {
    return NextResponse.json(
      { ok: false, error: "Cancelled website orders cannot be routed to receipts." },
      { status: 400 },
    );
  }

  if (
    existing.status !== WebsiteOrderStatus.DELIVERED &&
    existing.status !== WebsiteOrderStatus.RECEIPT_ISSUED
  ) {
    return NextResponse.json(
      { ok: false, error: "Only delivered website orders can continue into the receipts desk." },
      { status: 400 },
    );
  }

  const order = serializeWebsiteOrder(existing);
  const defaultMode = isWebsiteOrderPod(order.orderType, order.paymentMethod) ? "pod" : "normal";
  const mode = parsed.data.mode ?? defaultMode;
  const currentMetadata =
    existing.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {};

  await prisma.websiteOrder
    .update({
      where: { id },
      data: {
        confirmedById: guard.userId,
        metadata: {
          ...(withWebsiteOrderAssignmentMetadata(currentMetadata, {
            id: guard.userId,
            email: guard.email,
            name: guard.name,
          }) as Record<string, unknown>),
          receiptFlowMode: mode,
          receiptDraftOpenedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    })
    .catch(() => null);

  const prefill = buildWebsiteOrderReceiptPrefill(order, mode);
  const url = `/receipts?prefill=${encodeURIComponent(encodePrefill(prefill))}`;

  return NextResponse.json({
    ok: true,
    mode,
    url,
    order,
  });
}
