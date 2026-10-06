import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { notifyPodCustomer } from "@/lib/customerOrderNotifications";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

const toFeeAmount = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
};

// Speedaf labels are not a fixed length across every service and route.
// Keep a useful guard (a KE-prefixed identifier) without rejecting a valid
// staff-entered label solely because its length differs.
const SPEEDAF_TRACKING_PATTERN = /^KE[A-Z0-9]{4,}$/;
const normalizeSpeedafTrackingNumber = (value: unknown) =>
  String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function POST(req: NextRequest, context: ParamsContext) {
  const requestId = randomUUID();
  let receiptId = "";

  try {
    const paramsObj =
      "params" in context && typeof (context as { params?: Promise<{ id: string }> }).params?.then === "function"
        ? await (context as { params: Promise<{ id: string }> }).params
        : (context as { params: { id: string } }).params;
    receiptId = String(paramsObj.id || "");
  } catch (error) {
    console.error(`[pod-fee][${requestId}] invalid params`, error);
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  let guard;
  try {
    guard = await requireAttendant(req as unknown as Request);
  } catch (maybeRes) {
    if (maybeRes instanceof NextResponse) return maybeRes;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { order: true },
  });
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const baseData =
    typeof receipt.data === "object" && receipt.data ? { ...(receipt.data as Record<string, unknown>) } : {};
  const podDelivery =
    typeof baseData.podDelivery === "object" && baseData.podDelivery
      ? { ...(baseData.podDelivery as Record<string, unknown>) }
      : null;
  if (!podDelivery) {
    return NextResponse.json({ error: "Receipt is not marked for POD delivery" }, { status: 400 });
  }

  const actorRole = String(guard?.user?.role ?? "").toUpperCase();
  const actorId = String(guard?.user?.id ?? "").trim();
  const creatorIds = new Set(
    [
      receipt.issuedById,
      receipt.order?.attendantId,
      typeof baseData.attendantId === "string" ? baseData.attendantId : null,
    ]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
  const canManageAnyReceipt = actorRole === "ADMIN" || actorRole === "SUPERVISOR";
  if (!canManageAnyReceipt && (!actorId || !creatorIds.has(actorId))) {
    return NextResponse.json({ error: "Only the creator of this POD receipt can update the delivery fee" }, { status: 403 });
  }

  let amount: number | null = null;
  let note: string | null = null;
  let trackingNumbers: string[] = [];
  let speedafReceipts: Array<{ url: string; fileName: string; trackingNumbers: string[] }> = [];
  let suppliedTrackingNumbers = false;
  let adminOverride = false;
  let overrideReason = "";
  try {
    const body = (await req.json()) ?? {};
    amount = toFeeAmount(body.amount);
    if (amount === null) {
      return NextResponse.json({ error: "Delivery fee must be a valid number" }, { status: 400 });
    }
    if (typeof body.note === "string" && body.note.trim()) {
      note = body.note.trim();
    }
    suppliedTrackingNumbers = Array.isArray(body.trackingNumbers);
    // Tracking numbers are entered by staff from the printed Speedaf label.
    // Uploaded receipts are evidence only: never let OCR determine the code
    // shown to a customer or used for dispatch.
    const enteredTrackingNumbers: unknown[] = suppliedTrackingNumbers ? body.trackingNumbers : [];
    trackingNumbers = [...new Set(enteredTrackingNumbers.map(normalizeSpeedafTrackingNumber).filter((value) => value.length > 0))];
    speedafReceipts = Array.isArray(body.speedafReceipts) ? body.speedafReceipts.map((item: any) => ({ url: String(item?.url || "").trim(), fileName: String(item?.fileName || "Speedaf receipt").trim(), trackingNumbers: [] })).filter((item) => item.url) : [];
    if (trackingNumbers.some((value) => !SPEEDAF_TRACKING_PATTERN.test(value))) {
      return NextResponse.json({ error: "Each Speedaf tracking number must start with KE and contain its printed letters or numbers." }, { status: 400 });
    }
    adminOverride = body.adminOverride === true;
    overrideReason = typeof body.overrideReason === "string" ? body.overrideReason.trim() : "";
    if (!trackingNumbers.length && !(adminOverride && canManageAnyReceipt && overrideReason)) return NextResponse.json({ error: "Enter at least one Speedaf tracking number manually before dispatching. Admin override requires a reason." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const nextPodDelivery = {
    ...podDelivery,
    status: "dispatched",
    deliveryFee: amount,
    deliveryFeeUpdatedAt: new Date().toISOString(),
    deliveryFeeUpdatedById: actorId || null,
    speedafReceipts: speedafReceipts.length
      ? speedafReceipts.map((receipt, index) => ({ ...receipt, trackingNumbers: index === 0 ? trackingNumbers : [] }))
      : suppliedTrackingNumbers && trackingNumbers.length && Array.isArray(podDelivery.speedafReceipts) && podDelivery.speedafReceipts.length === 1
        ? [{ ...(podDelivery.speedafReceipts[0] as Record<string, unknown>), trackingNumbers }]
        : (Array.isArray(podDelivery.speedafReceipts) ? podDelivery.speedafReceipts : []),
    trackingNumbers,
    ...(adminOverride && !trackingNumbers.length ? { dispatchOverride: { reason: overrideReason, byId: actorId || null, at: new Date().toISOString() } } : {}),
    ...(note ? { deliveryFeeNote: note } : {}),
  };
  const wasAlreadyDispatched = String(podDelivery.status || "").toLowerCase() === "dispatched";
  const dispatchAgent = actorId
    ? await prisma.user.findUnique({ where: { id: actorId }, select: { name: true, oneVoiceCustomerNumber: true } })
    : null;
  const savedOneVoiceNumber =
    podDelivery.dispatchedByPhoneSource === "ONE_VOICE"
      ? String(podDelivery.dispatchedByPhone || "").trim()
      : "";
  const oneVoiceNumber = savedOneVoiceNumber || dispatchAgent?.oneVoiceCustomerNumber || null;
  Object.assign(nextPodDelivery, {
    dispatchedAt: (podDelivery.dispatchedAt as string | undefined) || new Date().toISOString(),
    dispatchedById: (podDelivery.dispatchedById as string | undefined) || actorId || null,
    dispatchedByName: (podDelivery.dispatchedByName as string | undefined) || dispatchAgent?.name || "Betech Customer Care",
    dispatchedByPhone: oneVoiceNumber,
    dispatchedByPhoneSource: oneVoiceNumber ? "ONE_VOICE" : null,
  });

  try {
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        data: { ...baseData, podDelivery: nextPodDelivery } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error(`[pod-fee][${requestId}] failed to persist delivery fee`, error);
    return NextResponse.json({ error: "Failed to save delivery fee" }, { status: 500 });
  }

  try {
    if (actorId) {
      await prisma.actionLog.create({
        data: {
          actorId,
          entity: "Receipt",
          entityId: receiptId,
          action: "POD_DELIVERY_FEE_UPDATED",
          before: { podDelivery: podDelivery ?? null } as Prisma.InputJsonValue,
          after: { podDelivery: nextPodDelivery } as Prisma.InputJsonValue,
        },
      });
    }
  } catch (error) {
    console.warn("[pod-fee] failed to write action log", error);
  }

  if (!wasAlreadyDispatched) {
    await notifyPodCustomer({ receiptId, event: "DISPATCHED" }).catch((error) =>
      console.error(`[pod-fee][${requestId}] customer dispatch notification failed`, error),
    );
  }

  return NextResponse.json({ ok: true, dispatched: true, deliveryFee: amount, podDelivery: nextPodDelivery });
}
