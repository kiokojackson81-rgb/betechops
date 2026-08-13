import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getPeriodKeyVariants } from "@/lib/payrollPeriodKey";
import { ensurePayrollAdjustmentStorage } from "@/lib/payrollAdjustmentStorage";
import { notifyPayrollAdjustmentApplied } from "@/services/payroll-notifications/payroll-notification.service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;
  const params = (ctx && (ctx.params || ctx)) || {};
  const paramsId = params.id as string | undefined;
  const url = new URL(req.url);
  const urlPathSegments = url.pathname.split('/').filter(Boolean);
  const pathAttendantId = (() => {
    const idx = urlPathSegments.findIndex((s) => s === 'attendants');
    return idx >= 0 && urlPathSegments.length > idx + 1 ? urlPathSegments[idx + 1] : undefined;
  })();
  const queryAttendantId = url.searchParams.get('attendantId') || undefined;
  const attendantId = paramsId ?? queryAttendantId ?? pathAttendantId;
  const periodKey = url.searchParams.get("periodKey") || undefined;

  // TEMP LOGGING: record incoming request for staging diagnostics
  try {
    console.info('[payroll-adjustments][req][GET]', {
      url: req.url,
      paramsId,
      queryAttendantId,
      pathAttendantId,
      attendantId,
      periodKey,
      ts: new Date().toISOString(),
    });
  } catch {}
  try {
    await ensurePayrollAdjustmentStorage();
    const where: any = { attendantId };
    if (periodKey) {
      const variants = getPeriodKeyVariants(periodKey);
      where.periodKey = { in: variants.length ? variants : [periodKey] };
    }
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
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bodyAttendantId = body?.attendantId as string | undefined;
  const paramsId = (params.id as string | undefined) ?? undefined;
  const url = new URL(req.url);
  const urlPathSegments = url.pathname.split('/').filter(Boolean);
  const pathAttendantId = (() => {
    const idx = urlPathSegments.findIndex((s) => s === 'attendants');
    return idx >= 0 && urlPathSegments.length > idx + 1 ? urlPathSegments[idx + 1] : undefined;
  })();
  const queryAttendantId = url.searchParams.get('attendantId') || undefined;
  const attendantId = paramsId ?? bodyAttendantId ?? queryAttendantId ?? pathAttendantId;

  // TEMP LOGGING: record incoming request body and derived attendantId
  try {
    const bodySnippet = JSON.stringify(body || {}).slice(0, 2000);
    console.info('[payroll-adjustments][req][POST]', {
      url: req.url,
      paramsId,
      bodySnippet,
      queryAttendantId,
      pathAttendantId,
      attendantId,
      ts: new Date().toISOString(),
    });
  } catch {}
  const { periodKey, periodLabel, adjustmentType, label, amount, adjustmentKind } = body || {};
  if (!periodKey || typeof adjustmentType !== "string" || !label || typeof amount !== "number") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!attendantId) return NextResponse.json({ error: "attendantId required" }, { status: 400 });

  try {
    await ensurePayrollAdjustmentStorage();
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

    let notification: any = null;
    try {
      notification = await notifyPayrollAdjustmentApplied({
        attendantId,
        periodKey,
        periodLabel: periodLabel ?? periodKey,
        adjustmentType: adjustmentType as any,
        adjustmentKind: kind as any,
        amount: Math.trunc(Math.max(0, amount)),
        label: String(label || ""),
      });
    } catch (notificationError) {
      notification = {
        status: "failed",
        detail: notificationError instanceof Error ? notificationError.message : String(notificationError),
      };
    }

    return NextResponse.json({ created, notification });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create adjustment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const params = (ctx && (ctx.params || ctx)) || {};
  const url = new URL(req.url);
  const paramsId = params.id as string | undefined;

  // read optional body (may be empty for DELETE)
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const urlPathSegments = url.pathname.split('/').filter(Boolean);
  const pathAttendantId = (() => {
    const idx = urlPathSegments.findIndex((s) => s === 'attendants');
    return idx >= 0 && urlPathSegments.length > idx + 1 ? urlPathSegments[idx + 1] : undefined;
  })();

  const queryAttendantId = url.searchParams.get("attendantId") || undefined;
  const bodyAttendantId = body?.attendantId as string | undefined;
  const attendantId = paramsId ?? bodyAttendantId ?? queryAttendantId ?? pathAttendantId;

  const adjustmentId = url.searchParams.get("adjustmentId");
  if (!adjustmentId) return NextResponse.json({ error: "adjustmentId required" }, { status: 400 });
  if (!attendantId) return NextResponse.json({ error: "attendantId required" }, { status: 400 });

  // TEMP LOGGING: record incoming DELETE request context for staging
  try {
    const bodySnippet = body ? JSON.stringify(body).slice(0, 2000) : null;
    console.info('[payroll-adjustments][req][DELETE]', {
      url: req.url,
      paramsId,
      bodySnippet,
      queryAttendantId,
      pathAttendantId,
      attendantId,
      adjustmentId,
      ts: new Date().toISOString(),
    });
  } catch {}
  try {
    await ensurePayrollAdjustmentStorage();
    const row = await prisma.attendantPayrollAdjustment.findUnique({ where: { id: adjustmentId } as any });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.attendantId !== attendantId) return NextResponse.json({ error: "Mismatched attendant" }, { status: 403 });
    if (row.recurringItemId) {
      await prisma.$transaction([
        prisma.attendantPayrollAdjustment.deleteMany({
          where: {
            attendantId,
            recurringItemId: row.recurringItemId,
          },
        }),
        prisma.attendantRecurringPayrollItem.delete({
          where: { id: row.recurringItemId },
        }),
      ]);
      return NextResponse.json({ ok: true, deletedRecurringItemId: row.recurringItemId, deletedMode: "recurring" });
    }

    await prisma.attendantPayrollAdjustment.delete({ where: { id: adjustmentId } as any });
    return NextResponse.json({ ok: true, deletedMode: "single" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
