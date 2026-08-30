import { NextResponse } from "next/server";
import type { LeaveRequestType, Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  assertLeaveBalanceCanCover,
  buildLeaveBalanceSummary,
  calculateLeaveDays,
  ensureLeaveBalance,
} from "@/lib/wellness";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { notifyAdminCriticalSms } from "@/lib/adminCriticalSms";

export const dynamic = "force-dynamic";
const leaveTypeValues = ["ANNUAL", "SICK", "EMERGENCY", "UNPAID", "OTHER"] as const;

export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  if (!identity.resolvedUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [balance, leaveRequests] = await Promise.all([
    ensureLeaveBalance(identity.resolvedUserId),
    prisma.leaveRequest.findMany({
      where: { userId: identity.resolvedUserId },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  return NextResponse.json(
    composeIdentityResponse(identity, {
      leaveBalance: buildLeaveBalanceSummary(balance),
      rows: leaveRequests,
    }),
  );
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? identity.actorId ?? null;
  const userId = identity.resolvedUserId;
  if (!userId || !actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    startDate?: string;
    endDate?: string;
    type?: string;
    reason?: string;
    supportingDocumentUrl?: string;
  } | null;

  const startDate = String(body?.startDate ?? "").trim();
  const endDate = String(body?.endDate ?? "").trim();
  const type = String(body?.type ?? "").trim().toUpperCase();
  const reason = String(body?.reason ?? "").trim();
  const supportingDocumentUrl = String(body?.supportingDocumentUrl ?? "").trim() || null;

  if (!startDate || !endDate || !type || !reason) {
    return NextResponse.json({ error: "startDate, endDate, type, and reason are required" }, { status: 400 });
  }
  if (!leaveTypeValues.includes(type as (typeof leaveTypeValues)[number])) {
    return NextResponse.json({ error: "Invalid leave type" }, { status: 400 });
  }

  try {
    const daysRequested = calculateLeaveDays(startDate, endDate);
    const balance = await ensureLeaveBalance(userId);
    const leaveType = type as LeaveRequestType;
    assertLeaveBalanceCanCover(balance, leaveType, daysRequested);

    const created = await prisma.leaveRequest.create({
      data: {
        userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type: leaveType,
        daysRequested,
        reason,
        supportingDocumentUrl,
      },
    });

    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "LeaveRequest",
        entityId: created.id,
        action: "CREATE",
        after: created as unknown as Prisma.InputJsonValue,
      },
    });

    const employee = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }).catch(() => null);
    await notifyAdminCriticalSms({
      eventType: "WELLNESS_LEAVE_REQUESTED",
      entityId: created.id,
      title: "New employee leave request",
      details: [
        `Employee: ${employee?.name || employee?.email || userId}`,
        `Type: ${leaveType.replace(/_/g, " ")}`,
        `Dates: ${startDate} to ${endDate}`,
        `Days: ${daysRequested}`,
      ],
      actionPath: "/admin/wellness",
      payload: { leaveRequestId: created.id, employeeId: userId },
    });

    return NextResponse.json({ created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create leave request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
