import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole, requireRoleOrBenjamin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  adjustmentTypeForOffense,
  labelForAdjustmentRequest,
  normalizePayrollAdjustmentKind,
  normalizePayrollAdjustmentOffenseType,
  resolveAdjustmentRequestPeriod,
} from "@/lib/payrollAdjustmentRequests";

export const dynamic = "force-dynamic";

const userSelect = { id: true, name: true, email: true, attendantCategory: true } as const;

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = String(url.searchParams.get("status") ?? "").trim().toUpperCase();
  const scope = String(url.searchParams.get("scope") ?? "mine").trim().toLowerCase();

  const where: any = {};
  if (status) where.status = status as any;
  if (auth.role !== "ADMIN" || scope !== "all") {
    where.OR = [{ requestedById: actorId }, { attendantId: actorId }];
  }

  const requests = await (prisma as any).payrollAdjustmentRequest.findMany({
    where,
    include: {
      attendant: { select: userSelect },
      requestedBy: { select: userSelect },
      decidedBy: { select: userSelect },
      payrollAdjustment: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 80,
  });

  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    attendantId?: string;
    periodKey?: string;
    offenseType?: string;
    adjustmentKind?: string;
    label?: string;
    amount?: number | string;
    incidentDate?: string;
    details?: string;
    evidenceUrl?: string;
  } | null;

  const attendantId = String(body?.attendantId ?? "").trim();
  const amount = Math.trunc(Number(body?.amount ?? 0));
  const details = String(body?.details ?? "").trim();
  const evidenceUrl = String(body?.evidenceUrl ?? "").trim() || null;
  const kind = normalizePayrollAdjustmentKind(body?.adjustmentKind);
  const offenseType = normalizePayrollAdjustmentOffenseType(body?.offenseType);
  const incidentDateRaw = String(body?.incidentDate ?? "").trim();
  const incidentDate = incidentDateRaw ? new Date(incidentDateRaw) : null;
  const period = resolveAdjustmentRequestPeriod(body?.periodKey);

  if (!attendantId) return NextResponse.json({ error: "attendantId is required" }, { status: 400 });
  if (amount <= 0) return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  if (!details) return NextResponse.json({ error: "Details are required" }, { status: 400 });
  if (incidentDate && Number.isNaN(incidentDate.getTime())) {
    return NextResponse.json({ error: "Invalid incident date" }, { status: 400 });
  }

  const [attendant, actor] = await Promise.all([
    prisma.user.findUnique({ where: { id: attendantId }, select: userSelect }),
    prisma.user.findUnique({ where: { id: actorId }, select: userSelect }),
  ]);
  if (!attendant) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (!actor) return NextResponse.json({ error: "Requester not found" }, { status: 404 });

  const label = labelForAdjustmentRequest({
    offenseType,
    label: body?.label,
    incidentDate,
  });
  const adjustmentType = adjustmentTypeForOffense(offenseType, kind);

  const created = await (prisma as any).payrollAdjustmentRequest.create({
    data: {
      attendantId,
      requestedById: actorId,
      periodKey: period.key,
      periodLabel: period.label,
      adjustmentType,
      adjustmentKind: kind,
      offenseType,
      label,
      amount,
      incidentDate,
      details,
      evidenceUrl,
    },
    include: {
      attendant: { select: userSelect },
      requestedBy: { select: userSelect },
    },
  });

  await prisma.actionLog.create({
    data: {
      actorId,
      entity: "PayrollAdjustmentRequest",
      entityId: created.id,
      action: "CREATE",
      after: created as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ created }, { status: 201 });
}
