import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function resolveAttendantId(req: Request, ctx: any, body?: any) {
  const params = (ctx && (ctx.params || ctx)) || {};
  const paramsId = params.id as string | undefined;
  const url = new URL(req.url);
  const urlPathSegments = url.pathname.split("/").filter(Boolean);
  const pathAttendantId = (() => {
    const idx = urlPathSegments.findIndex((segment) => segment === "attendants");
    return idx >= 0 && urlPathSegments.length > idx + 1 ? urlPathSegments[idx + 1] : undefined;
  })();
  const queryAttendantId = url.searchParams.get("attendantId") || undefined;
  return paramsId ?? body?.attendantId ?? queryAttendantId ?? pathAttendantId;
}

export async function GET(req: Request, ctx: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;
  const attendantId = resolveAttendantId(req, ctx);
  if (!attendantId) return NextResponse.json({ error: "attendantId required" }, { status: 400 });

  const rows = await prisma.attendantRecurringPayrollItem.findMany({
    where: { attendantId },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ rows });
}

export async function POST(req: Request, ctx: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const attendantId = resolveAttendantId(req, ctx, body);
  if (!attendantId) return NextResponse.json({ error: "attendantId required" }, { status: 400 });

  const amount = Math.trunc(Math.max(0, Number(body.amount ?? 0)));
  const cadence = String(body.cadence ?? "MONTHLY").toUpperCase() === "WEEKLY" ? "WEEKLY" : "MONTHLY";
  const adjustmentKind = String(body.adjustmentKind ?? "DEDUCTION").toUpperCase() === "ADDITION" ? "ADDITION" : "DEDUCTION";
  const adjustmentType = String(body.adjustmentType ?? "OTHER").toUpperCase();
  const label = String(body.label ?? "").trim();
  if (!label || !amount) return NextResponse.json({ error: "label and amount are required" }, { status: 400 });

  const dayOfWeek =
    cadence === "WEEKLY" ? Math.min(6, Math.max(0, Math.trunc(Number(body.dayOfWeek ?? 1)))) : null;
  const dayOfMonth =
    cadence === "MONTHLY" ? Math.min(31, Math.max(1, Math.trunc(Number(body.dayOfMonth ?? 1)))) : null;

  const created = await prisma.attendantRecurringPayrollItem.create({
    data: {
      attendantId,
      label,
      amount,
      cadence: cadence as any,
      adjustmentKind: adjustmentKind as any,
      adjustmentType: adjustmentType as any,
      dayOfWeek,
      dayOfMonth,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      isActive: body.isActive !== false,
      createdById: (auth.session?.user as any)?.id ?? "",
    },
  });

  return NextResponse.json({ created });
}

export async function PATCH(req: Request, ctx: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const attendantId = resolveAttendantId(req, ctx, body);
  if (!attendantId) return NextResponse.json({ error: "attendantId required" }, { status: 400 });

  const existing = await prisma.attendantRecurringPayrollItem.findUnique({ where: { id: String(body.id) } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.attendantId !== attendantId) return NextResponse.json({ error: "Mismatched attendant" }, { status: 403 });

  const cadence = body.cadence
    ? String(body.cadence).toUpperCase() === "WEEKLY"
      ? "WEEKLY"
      : "MONTHLY"
    : existing.cadence;
  const adjustmentKind = body.adjustmentKind
    ? String(body.adjustmentKind).toUpperCase() === "ADDITION"
      ? "ADDITION"
      : "DEDUCTION"
    : existing.adjustmentKind;
  const adjustmentType = body.adjustmentType
    ? String(body.adjustmentType).toUpperCase()
    : existing.adjustmentType;
  const label = typeof body.label === "string" ? body.label.trim() : existing.label;
  const amount =
    typeof body.amount === "number"
      ? Math.trunc(Math.max(0, Number(body.amount)))
      : existing.amount;

  const dayOfWeek =
    cadence === "WEEKLY"
      ? Math.min(6, Math.max(0, Math.trunc(Number(body.dayOfWeek ?? existing.dayOfWeek ?? 1))))
      : null;
  const dayOfMonth =
    cadence === "MONTHLY"
      ? Math.min(31, Math.max(1, Math.trunc(Number(body.dayOfMonth ?? existing.dayOfMonth ?? 1))))
      : null;

  const updated = await prisma.attendantRecurringPayrollItem.update({
    where: { id: existing.id },
    data: {
      label,
      amount,
      cadence: cadence as any,
      adjustmentType: adjustmentType as any,
      adjustmentKind: adjustmentKind as any,
      dayOfWeek,
      dayOfMonth,
      startDate:
        Object.prototype.hasOwnProperty.call(body, "startDate")
          ? body.startDate
            ? new Date(body.startDate)
            : null
          : existing.startDate,
      endDate:
        Object.prototype.hasOwnProperty.call(body, "endDate")
          ? body.endDate
            ? new Date(body.endDate)
            : null
          : existing.endDate,
      isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
    },
  });
  return NextResponse.json({ updated });
}

export async function DELETE(req: Request, ctx: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const attendantId = resolveAttendantId(req, ctx);
  if (!attendantId) return NextResponse.json({ error: "attendantId required" }, { status: 400 });

  const existing = await prisma.attendantRecurringPayrollItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.attendantId !== attendantId) return NextResponse.json({ error: "Mismatched attendant" }, { status: 403 });

  await prisma.$transaction([
    prisma.attendantPayrollAdjustment.deleteMany({
      where: {
        attendantId,
        recurringItemId: id,
      },
    }),
    prisma.attendantRecurringPayrollItem.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
