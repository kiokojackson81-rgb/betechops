import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  adjustmentTypeForOffense,
  labelForAdjustmentRequest,
  normalizePayrollAdjustmentKind,
  normalizePayrollAdjustmentOffenseType,
  resolveAdjustmentRequestPeriod,
} from "@/lib/payrollAdjustmentRequests";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const id = params.id;
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
    adminComment?: string;
  } | null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await (tx as any).payrollAdjustmentRequest.findUnique({
        where: { id },
      });
      if (!existing) throw new Error("Adjustment request not found");

      const attendantId = String(body?.attendantId ?? existing.attendantId).trim();
      const amount = Math.trunc(Number(body?.amount ?? existing.amount));
      const details = String(body?.details ?? existing.details).trim();
      const evidenceUrl =
        body?.evidenceUrl === undefined ? existing.evidenceUrl : String(body.evidenceUrl ?? "").trim() || null;
      const adminComment =
        body?.adminComment === undefined ? existing.adminComment : String(body.adminComment ?? "").trim() || null;
      const kind = normalizePayrollAdjustmentKind(body?.adjustmentKind ?? existing.adjustmentKind);
      const offenseType = normalizePayrollAdjustmentOffenseType(body?.offenseType ?? existing.offenseType);
      const incidentDateRaw =
        body?.incidentDate === undefined
          ? existing.incidentDate
            ? new Date(existing.incidentDate).toISOString().slice(0, 10)
            : ""
          : String(body.incidentDate ?? "").trim();
      const incidentDate = incidentDateRaw ? new Date(incidentDateRaw) : null;
      const period = resolveAdjustmentRequestPeriod(body?.periodKey ?? existing.periodKey);

      if (!attendantId) throw new Error("attendantId is required");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero");
      if (!details) throw new Error("Details are required");
      if (incidentDate && Number.isNaN(incidentDate.getTime())) throw new Error("Invalid incident date");

      const label = labelForAdjustmentRequest({
        offenseType,
        label: body?.label ?? existing.label,
        incidentDate,
      });
      const adjustmentType = adjustmentTypeForOffense(offenseType, kind);

      let payrollAdjustmentId = existing.payrollAdjustmentId ?? null;
      if (existing.status === "APPROVED" && payrollAdjustmentId) {
        await tx.attendantPayrollAdjustment.update({
          where: { id: payrollAdjustmentId },
          data: {
            attendantId,
            periodKey: period.key,
            periodLabel: period.label,
            adjustmentType,
            adjustmentKind: kind,
            label,
            amount,
          },
        });
      }

      const updated = await (tx as any).payrollAdjustmentRequest.update({
        where: { id },
        data: {
          attendantId,
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
          adminComment,
          payrollAdjustmentId,
        },
        include: {
          attendant: { select: { id: true, name: true, email: true, attendantCategory: true } },
          requestedBy: { select: { id: true, name: true, email: true, attendantCategory: true } },
          decidedBy: { select: { id: true, name: true, email: true, attendantCategory: true } },
          payrollAdjustment: true,
        },
      });

      await tx.actionLog.create({
        data: {
          actorId,
          entity: "PayrollAdjustmentRequest",
          entityId: id,
          action: "UPDATE",
          before: existing as unknown as Prisma.InputJsonValue,
          after: updated as unknown as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    return NextResponse.json({ updated: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update adjustment request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const id = params.id;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await (tx as any).payrollAdjustmentRequest.findUnique({
        where: { id },
      });
      if (!existing) throw new Error("Adjustment request not found");

      if (existing.payrollAdjustmentId) {
        await tx.attendantPayrollAdjustment.deleteMany({
          where: { id: existing.payrollAdjustmentId },
        });
      }
      await (tx as any).payrollAdjustmentRequest.delete({ where: { id } });
      await tx.actionLog.create({
        data: {
          actorId,
          entity: "PayrollAdjustmentRequest",
          entityId: id,
          action: "DELETE",
          before: existing as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete adjustment request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
