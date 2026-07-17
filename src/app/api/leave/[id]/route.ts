import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  assertLeaveBalanceCanCover,
  calculateLeaveDays,
  ensureLeaveBalance,
  syncApprovedLeaveBalance,
} from "@/lib/wellness";

export const dynamic = "force-dynamic";

const leaveTypeValues = ["ANNUAL", "SICK", "EMERGENCY", "UNPAID", "OTHER"] as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const id = params.id;
  const body = (await req.json().catch(() => null)) as {
    startDate?: string;
    endDate?: string;
    type?: string;
    reason?: string;
    supportingDocumentUrl?: string | null;
    managerComment?: string | null;
  } | null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.leaveRequest.findUnique({ where: { id } });
      if (!existing) throw new Error("Leave request not found");

      const startDate = String(body?.startDate ?? existing.startDate.toISOString().slice(0, 10)).trim();
      const endDate = String(body?.endDate ?? existing.endDate.toISOString().slice(0, 10)).trim();
      const type = String(body?.type ?? existing.type).trim().toUpperCase();
      const reason = String(body?.reason ?? existing.reason).trim();
      const supportingDocumentUrl =
        body?.supportingDocumentUrl === undefined
          ? existing.supportingDocumentUrl
          : String(body.supportingDocumentUrl ?? "").trim() || null;
      const managerComment =
        body?.managerComment === undefined
          ? existing.managerComment
          : String(body.managerComment ?? "").trim() || null;

      if (!startDate || !endDate || !reason) {
        throw new Error("startDate, endDate, and reason are required");
      }
      if (!leaveTypeValues.includes(type as (typeof leaveTypeValues)[number])) {
        throw new Error("Invalid leave type");
      }

      const nextDaysRequested = calculateLeaveDays(startDate, endDate);

      if (existing.status === "APPROVED") {
        await syncApprovedLeaveBalance({ leaveRequestId: id, actorId, mode: "revoke", db: tx });
      }

      if (existing.status === "APPROVED") {
        const balance = await ensureLeaveBalance(existing.userId, tx);
        assertLeaveBalanceCanCover(balance, type as any, nextDaysRequested);
      }

      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          type: type as any,
          reason,
          supportingDocumentUrl,
          managerComment,
          daysRequested: nextDaysRequested,
        },
      });

      if (existing.status === "APPROVED") {
        await syncApprovedLeaveBalance({ leaveRequestId: id, actorId, mode: "approve", db: tx });
      }

      await tx.actionLog.create({
        data: {
          actorId,
          entity: "LeaveRequest",
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
    const message = error instanceof Error ? error.message : "Failed to update leave request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const id = params.id;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.leaveRequest.findUnique({ where: { id } });
      if (!existing) throw new Error("Leave request not found");

      if (existing.status === "APPROVED") {
        await syncApprovedLeaveBalance({ leaveRequestId: id, actorId, mode: "revoke", db: tx });
      }

      await tx.leaveRequest.delete({ where: { id } });
      await tx.actionLog.create({
        data: {
          actorId,
          entity: "LeaveRequest",
          entityId: id,
          action: "DELETE",
          before: existing as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete leave request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
