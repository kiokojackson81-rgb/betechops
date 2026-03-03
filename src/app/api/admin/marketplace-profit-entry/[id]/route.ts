import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { id } = await Promise.resolve(ctx.params);
  const entryId = String(id ?? "").trim();
  if (!entryId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as
    | {
        buyingPriceKes?: number | string;
        orderId?: string | null;
        sku?: string | null;
        productName?: string | null;
      }
    | null;

  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const buying =
    body.buyingPriceKes === undefined
      ? undefined
      : typeof body.buyingPriceKes === "string"
        ? Number(body.buyingPriceKes)
        : body.buyingPriceKes;

  if (buying !== undefined && (!Number.isFinite(buying) || buying < 0)) {
    return NextResponse.json({ error: "buyingPriceKes must be a non-negative number" }, { status: 400 });
  }

  try {
    const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
    const existing = await (prisma as any).marketplaceProfitEntry.findUnique({
      where: { id: entryId },
      select: { id: true, netPayout: true, buyingPrice: true, enteredByAdminId: true },
    });
    if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    if ((auth as any).isBenjamin && actorId && String(existing.enteredByAdminId) !== actorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nextBuying = buying !== undefined ? buying : Number(existing.buyingPrice ?? 0);
    const netPayout = Number(existing.netPayout ?? 0);
    const profit = netPayout - nextBuying;
    const marginPct = netPayout !== 0 ? (profit / netPayout) * 100 : 0;
    const isLoss = profit < 0;

    const updated = await (prisma as any).marketplaceProfitEntry.update({
      where: { id: entryId },
      data: {
        ...(buying !== undefined ? { buyingPrice: nextBuying } : {}),
        profit,
        marginPct,
        isLoss,
        ...(body.orderId !== undefined ? { orderId: body.orderId?.trim() || null } : {}),
        ...(body.sku !== undefined ? { sku: body.sku?.trim() || null } : {}),
        ...(body.productName !== undefined ? { productName: body.productName?.trim() || null } : {}),
      },
      select: { id: true, buyingPrice: true, profit: true, marginPct: true, isLoss: true },
    });

    return NextResponse.json({
      id: String(updated.id),
      buyingPrice: Number(updated.buyingPrice ?? nextBuying),
      profit: Number(updated.profit ?? profit),
      marginPct: Number(updated.marginPct ?? marginPct),
      isLoss: Boolean(updated.isLoss),
    });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return NextResponse.json(
        { error: "Profit capture is not available yet (database migration pending)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { id } = await Promise.resolve(ctx.params);
  const entryId = String(id ?? "").trim();
  if (!entryId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
    if ((auth as any).isBenjamin && actorId) {
      const existing = await (prisma as any).marketplaceProfitEntry.findUnique({
        where: { id: entryId },
        select: { id: true, enteredByAdminId: true },
      });
      if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      if (String(existing.enteredByAdminId) !== actorId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await (prisma as any).marketplaceProfitEntry.delete({ where: { id: entryId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return NextResponse.json(
        { error: "Profit capture is not available yet (database migration pending)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed" }, { status: 500 });
  }
}
