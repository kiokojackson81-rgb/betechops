import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getActorId, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recomputeOrderEconomics } from "@/lib/recomputeOrderEconomics";
import { publishSummaryUpdate } from "@/lib/receiptSseBroker";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { recomputeSupportCommissionLedger } from "@/lib/supportCommission";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveParams(context: ParamsContext) {
  const params = context.params;
  return typeof (params as Promise<{ id: string }>).then === "function"
    ? await (params as Promise<{ id: string }>)
    : (params as { id: string });
}

export async function POST(request: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const { id } = await resolveParams(context);
  const body = await request.json().catch(() => ({}));
  const attendantId = typeof body?.attendantId === "string" ? body.attendantId.trim() : "";
  if (!attendantId) return NextResponse.json({ error: "Choose a staff member." }, { status: 400 });

  const [receipt, nextOwner] = await Promise.all([
    prisma.receipt.findUnique({
      where: { id },
      include: { order: { include: { items: { select: { id: true } } } } },
    }),
    prisma.user.findFirst({ where: { id: attendantId, isActive: true }, select: { id: true, name: true, email: true } }),
  ]);
  if (!receipt?.order) return NextResponse.json({ error: "Receipt order not found." }, { status: 404 });
  if (!nextOwner) return NextResponse.json({ error: "Selected staff member is unavailable." }, { status: 400 });

  const previousOwnerId = receipt.order.attendantId ?? null;
  if (previousOwnerId === nextOwner.id) return NextResponse.json({ ok: true, unchanged: true });

  const actorId = await getActorId();
  const receiptData = receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
    ? (receipt.data as Record<string, unknown>)
    : {};
  const changedAt = new Date().toISOString();
  const nextData = {
    ...receiptData,
    attendantId: nextOwner.id,
    ownershipAssignment: {
      assignedAt: changedAt,
      assignedById: actorId,
      previousOwnerId,
      ownerId: nextOwner.id,
    },
  };

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: receipt.order!.id }, data: { attendantId: nextOwner.id } });
    await tx.receipt.update({ where: { id }, data: { data: nextData as Prisma.InputJsonValue } });

    const itemIds = receipt.order!.items.map((item) => item.id);
    if (itemIds.length) {
      // Repoint existing product and gross commission rows. This removes the
      // former owner's credit rather than creating a second commission.
      await tx.commissionEarning.updateMany({ where: { orderItemId: { in: itemIds } }, data: { staffId: nextOwner.id } });
    }
    await tx.commissionRecord.updateMany({ where: { orderId: receipt.order!.id }, data: { attendantId: nextOwner.id } });

    if (actorId) {
      await tx.actionLog.create({
        data: {
          actorId,
          entity: "Receipt",
          entityId: id,
          action: "REASSIGN_OWNER",
          before: { attendantId: previousOwnerId } as Prisma.InputJsonValue,
          after: { attendantId: nextOwner.id, assignedAt: changedAt } as Prisma.InputJsonValue,
        } as any,
      }).catch(() => undefined);
    }
  });

  await recomputeOrderEconomics(receipt.order.id);
  const period = getTradingPeriodFor(new Date());
  await Promise.all(
    [previousOwnerId, nextOwner.id]
      .filter((value): value is string => Boolean(value))
      .map((userId) => recomputeSupportCommissionLedger({ userId, period }).catch(() => undefined)),
  );
  publishSummaryUpdate({ receiptId: id, attendantId: nextOwner.id, timestamp: changedAt });

  return NextResponse.json({ ok: true, owner: { id: nextOwner.id, name: nextOwner.name ?? nextOwner.email ?? "Staff" } });
}
