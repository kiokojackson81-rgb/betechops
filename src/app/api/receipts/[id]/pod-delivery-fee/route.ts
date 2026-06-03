import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

const toFeeAmount = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
};

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
  try {
    const body = (await req.json()) ?? {};
    amount = toFeeAmount(body.amount);
    if (amount === null) {
      return NextResponse.json({ error: "Delivery fee must be a valid number" }, { status: 400 });
    }
    if (typeof body.note === "string" && body.note.trim()) {
      note = body.note.trim();
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const nextPodDelivery = {
    ...podDelivery,
    deliveryFee: amount,
    deliveryFeeUpdatedAt: new Date().toISOString(),
    deliveryFeeUpdatedById: actorId || null,
    ...(note ? { deliveryFeeNote: note } : {}),
  };

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

  return NextResponse.json({ ok: true, deliveryFee: amount, podDelivery: nextPodDelivery });
}
