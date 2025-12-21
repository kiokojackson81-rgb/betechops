import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const params = (ctx && (ctx.params || ctx)) || {};
  const attendantId = params.id as string;
  const url = new URL(req.url);
  const periodKey = url.searchParams.get("periodKey") || undefined;

  try {
    const where: any = { attendantId };
    if (periodKey) where.periodKey = periodKey;
    const rows = await prisma.attendantPayrollAdjustment.findMany({ where, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch adjustments";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const params = (ctx && (ctx.params || ctx)) || {};
  const attendantId = params.id as string;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { periodKey, periodLabel, adjustmentType, label, amount, adjustmentKind } = body || {};
  if (!periodKey || typeof adjustmentType !== "string" || !label || typeof amount !== "number") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const kindCandidate = String(adjustmentKind ?? "DEDUCTION").toUpperCase();
    const kind = kindCandidate === "ADDITION" ? "ADDITION" : "DEDUCTION";
    const created = await prisma.attendantPayrollAdjustment.create({
      data: {
        attendantId,
        periodKey,
        periodLabel: periodLabel ?? periodKey,
        adjustmentType: adjustmentType as any,
        label,
        amount: Math.trunc(Math.max(0, amount)),
        adjustmentKind: kind as any,
        createdById: (auth.session?.user as any)?.id ?? "",
      },
    });
    return NextResponse.json({ created });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create adjustment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const params = (ctx && (ctx.params || ctx)) || {};
  const attendantId = params.id as string;
  const url = new URL(req.url);
  const adjustmentId = url.searchParams.get("adjustmentId");
  if (!adjustmentId) return NextResponse.json({ error: "adjustmentId required" }, { status: 400 });

  try {
    const row = await prisma.attendantPayrollAdjustment.findUnique({ where: { id: adjustmentId } as any });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.attendantId !== attendantId) return NextResponse.json({ error: "Mismatched attendant" }, { status: 403 });
    await prisma.attendantPayrollAdjustment.delete({ where: { id: adjustmentId } as any });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
