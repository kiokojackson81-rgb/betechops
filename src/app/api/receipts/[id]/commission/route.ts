import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as any).params;
  if (maybePromise && typeof maybePromise.then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

function toSafeAmount(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, amount);
}

export async function PATCH(req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const { id } = await resolveParams(context);
  const body = await req.json().catch(() => ({}));
  const amount = toSafeAmount(body?.amount);
  const actorId = (guard.session?.user as any)?.id ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findUnique({ where: { id } });
    if (!receipt) return null;
    const prevData =
      receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
        ? (receipt.data as Record<string, unknown>)
        : {};
    const prevTotals =
      receipt.totals && typeof receipt.totals === "object" && !Array.isArray(receipt.totals)
        ? (receipt.totals as Record<string, unknown>)
        : {};
    const total = Number(prevTotals.total ?? 0);
    const buyingTotal = Number(prevTotals.buyingTotal ?? 0);
    const nextProfit = total - buyingTotal - amount;
    const totals = {
      ...prevTotals,
      posCommission: amount,
      profit: Number.isFinite(nextProfit) ? nextProfit : 0,
    };
    const data = {
      ...prevData,
      manualPosCommissionAmount: amount,
      manualPosCommissionUpdatedAt: new Date().toISOString(),
      manualPosCommissionUpdatedById: actorId,
      totals,
    };
    return tx.receipt.update({
      where: { id },
      data: { totals, data: data as any },
    });
  });

  if (!updated) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  return NextResponse.json({ ok: true, amount });
}

export async function DELETE(_req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;
  const { id } = await resolveParams(context);

  const updated = await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findUnique({ where: { id } });
    if (!receipt) return null;
    const prevData =
      receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
        ? (receipt.data as Record<string, unknown>)
        : {};
    const prevTotals =
      receipt.totals && typeof receipt.totals === "object" && !Array.isArray(receipt.totals)
        ? (receipt.totals as Record<string, unknown>)
        : {};
    const total = Number(prevTotals.total ?? 0);
    const buyingTotal = Number(prevTotals.buyingTotal ?? 0);
    const totals = {
      ...prevTotals,
      posCommission: 0,
      profit: Number.isFinite(total - buyingTotal) ? total - buyingTotal : 0,
    };
    const data = { ...prevData } as Record<string, unknown>;
    delete data.manualPosCommissionAmount;
    delete data.manualPosCommissionUpdatedAt;
    delete data.manualPosCommissionUpdatedById;
    data.totals = totals;

    return tx.receipt.update({
      where: { id },
      data: { totals, data: data as any },
    });
  });

  if (!updated) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
