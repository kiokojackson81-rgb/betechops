import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { syncPosReceiptToCustomerAccount } from "@/lib/posCustomerAccountSync";
import { requireRole } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  buildProjectHandlerSignature,
  normalizeProjectHandlerPhone,
  resolveProjectStaffPhone,
} from "@/lib/projectHandlers";
import { syncCompletedProjectReceiptToPricing } from "@/lib/projectPricingSync";
import {
  buildReceiptProjectFlow,
  readReceiptProjectFlow,
  RECEIPT_PROJECT_DEPOSIT_TYPES,
  RECEIPT_PROJECT_HANDLER_TYPES,
  RECEIPT_PROJECT_PAYMENT_METHODS,
  RECEIPT_PROJECT_PAYMENT_TERMS,
  RECEIPT_PROJECT_STAGES,
  type ReceiptProjectHandlerAssignment,
} from "@/lib/receiptProjects";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";
import { publishProjectNotification } from "@/services/project-notifications/project-notification.service";
import {
  hasProjectAssignedHandler,
  hasProjectBookingDate,
  resolveProjectNotificationEvents,
  shouldSendProjectAssigned,
  shouldSendProjectBooked,
} from "@/services/project-notifications/project-notification.logic";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  stage: z.enum(RECEIPT_PROJECT_STAGES).optional(),
  paymentTerm: z.enum(RECEIPT_PROJECT_PAYMENT_TERMS).optional(),
  depositType: z.enum(RECEIPT_PROJECT_DEPOSIT_TYPES).optional(),
  depositValue: z.number().min(0).optional(),
  depositPercent: z.number().min(0).max(100).optional(),
  depositPaidAmount: z.number().min(0).optional(),
  depositPaymentMethod: z.enum(RECEIPT_PROJECT_PAYMENT_METHODS).optional(),
  depositReference: z.string().trim().nullable().optional(),
  balancePaidAmount: z.number().min(0).optional(),
  balancePaymentMethod: z.enum(RECEIPT_PROJECT_PAYMENT_METHODS).optional(),
  balanceReference: z.string().trim().nullable().optional(),
  scheduledDate: z.string().trim().nullable().optional(),
  internalNotes: z.string().trim().nullable().optional(),
  paymentNotes: z.string().trim().nullable().optional(),
  handlerType: z.enum(RECEIPT_PROJECT_HANDLER_TYPES).nullable().optional(),
  handlerStaffId: z.string().trim().nullable().optional(),
  handlerStaffName: z.string().trim().nullable().optional(),
  handlerStaffIds: z.array(z.string().trim()).optional(),
  externalAgentId: z.string().trim().nullable().optional(),
  externalAgentName: z.string().trim().nullable().optional(),
  externalAgentIds: z.array(z.string().trim()).optional(),
  externalAgentPhone: z.string().trim().nullable().optional(),
});

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

type StaffAssignmentUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  technicalProfile: { phoneNumber: string | null } | null;
};

type ExternalAgentRecord = {
  id: string;
  name: string;
  whatsappNumber: string;
};

async function resolveId(context: ParamsContext) {
  const params = await (context as { params: Promise<{ id: string }> | { id: string } }).params;
  return params.id;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function buildAssignedHandlerChange(
  previous: ReceiptProjectHandlerAssignment[] | null | undefined,
  next: ReceiptProjectHandlerAssignment[] | null | undefined,
) {
  const previousSignature = JSON.stringify((previous ?? []).map(buildProjectHandlerSignature).sort());
  const nextSignature = JSON.stringify((next ?? []).map(buildProjectHandlerSignature).sort());
  return previousSignature !== nextSignature;
}

export async function PATCH(req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!guard.ok) return guard.res;
  const session = await auth().catch(() => null);
  const actor = session?.user as { id?: string | null; attendantCategory?: string | null } | undefined;
  const actorId = String(actor?.id || "").trim() || null;

  const id = await resolveId(context);
  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project update payload" }, { status: 400 });
  }

  const existing = await prisma.receipt.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          totalAmount: true,
          paidAmount: true,
          orderNumber: true,
          attendantId: true,
        },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const existingData =
    existing.data && typeof existing.data === "object" && !Array.isArray(existing.data)
      ? (existing.data as Record<string, unknown>)
      : {};
  const existingProjectFlow = readReceiptProjectFlow(existingData.projectFlow);
  if (!existingProjectFlow && String(existingData.customerType || "").toLowerCase() !== "project") {
    return NextResponse.json({ error: "This receipt is not tagged as a project receipt" }, { status: 400 });
  }

  const existingAssignedHandlers = existingProjectFlow?.assignedHandlers ?? [];
  if (guard.role === "ATTENDANT") {
    const assignedToActor = existingAssignedHandlers.some(
      (entry) => entry.kind === "STAFF" && String(entry.staffId || "").trim() === actorId,
    );
    const createdByActor = String(existing.issuedById || "").trim() === actorId;
    const isTechnicalActor = isTechnicalTeamCategory(actor?.attendantCategory);
    if (!isTechnicalActor || (!assignedToActor && !createdByActor)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const nextHandlerStaffIds =
    parsed.data.handlerStaffIds !== undefined
      ? uniqueStrings(parsed.data.handlerStaffIds)
      : parsed.data.handlerStaffId !== undefined
        ? uniqueStrings([parsed.data.handlerStaffId])
        : uniqueStrings(existingProjectFlow?.handlerStaffIds ?? existingProjectFlow?.handlerStaffId ? [existingProjectFlow?.handlerStaffId ?? ""] : []);
  const nextExternalAgentIds =
    parsed.data.externalAgentIds !== undefined
      ? uniqueStrings(parsed.data.externalAgentIds)
      : parsed.data.externalAgentId !== undefined
        ? uniqueStrings([parsed.data.externalAgentId])
        : uniqueStrings(existingProjectFlow?.externalAgentIds ?? existingProjectFlow?.externalAgentId ? [existingProjectFlow?.externalAgentId ?? ""] : []);

  const [staffMembers, externalAgents] = await Promise.all([
    nextHandlerStaffIds.length
      ? prisma.user.findMany({
          where: { id: { in: nextHandlerStaffIds } },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            whatsappNumber: true,
            technicalProfile: { select: { phoneNumber: true } },
          },
        })
      : Promise.resolve([] as StaffAssignmentUser[]),
    nextExternalAgentIds.length
      ? prisma.projectExternalAgent.findMany({
          where: { id: { in: nextExternalAgentIds }, isActive: true },
          select: { id: true, name: true, whatsappNumber: true },
        })
      : Promise.resolve([] as ExternalAgentRecord[]),
  ]);

  const staffById = new Map<string, StaffAssignmentUser>(staffMembers.map((entry) => [entry.id, entry] as const));
  const externalById = new Map<string, ExternalAgentRecord>(externalAgents.map((entry) => [entry.id, entry] as const));

  if (nextExternalAgentIds.length > externalAgents.length) {
    return NextResponse.json(
      { error: "One or more selected external agents could not be found or are inactive" },
      { status: 400 },
    );
  }

  const nextAssignedHandlers: ReceiptProjectHandlerAssignment[] = [
    ...nextHandlerStaffIds.map((staffId) => {
      const user = staffById.get(staffId);
      const name = user?.name ?? user?.email ?? parsed.data.handlerStaffName ?? null;
      return {
        kind: "STAFF",
        staffId,
        staffName: name,
        externalAgentId: null,
        externalAgentName: null,
        phone: resolveProjectStaffPhone({
          name,
          whatsappNumber: user?.whatsappNumber ?? null,
          phone: user?.phone ?? null,
          technicalPhoneNumber: user?.technicalProfile?.phoneNumber ?? null,
        }),
      } satisfies ReceiptProjectHandlerAssignment;
    }),
    ...nextExternalAgentIds.map((externalAgentId) => {
      const agent = externalById.get(externalAgentId);
      return {
        kind: "EXTERNAL",
        staffId: null,
        staffName: null,
        externalAgentId,
        externalAgentName: agent?.name ?? parsed.data.externalAgentName ?? null,
        phone: normalizeProjectHandlerPhone(agent?.whatsappNumber ?? parsed.data.externalAgentPhone ?? null),
      } satisfies ReceiptProjectHandlerAssignment;
    }),
  ];

  const nextScheduledDate =
    parsed.data.scheduledDate !== undefined ? parsed.data.scheduledDate : existingProjectFlow?.scheduledDate;
  const requestedStage = parsed.data.stage ?? existingProjectFlow?.stage ?? "RECEIPT_CREATED";
  const effectiveStage =
    parsed.data.stage === undefined &&
    requestedStage === "RECEIPT_CREATED" &&
    nextAssignedHandlers.length > 0 &&
    nextScheduledDate
      ? "PROJECT_SCHEDULED"
      : requestedStage;

  if (effectiveStage === "PROJECT_SCHEDULED" && (!nextScheduledDate || nextAssignedHandlers.length === 0)) {
    return NextResponse.json(
      { error: "Assign a technician or agent and select an installation date before confirming the project." },
      { status: 400 },
    );
  }

  const stageOrder = [
    "RECEIPT_CREATED",
    "PROJECT_SCHEDULED",
    "PROJECT_IN_PROGRESS",
    "PROJECT_INSTALLED",
    "COMPLETED_POSTED",
  ] as const;
  const currentStageIndex = stageOrder.indexOf(existingProjectFlow?.stage ?? "RECEIPT_CREATED");
  const nextStageIndex = stageOrder.indexOf(effectiveStage);
  if (parsed.data.stage !== undefined && nextStageIndex > currentStageIndex + 1) {
    return NextResponse.json(
      { error: "Complete the current project stage before moving to the next one." },
      { status: 409 },
    );
  }

  if (parsed.data.stage !== undefined && nextStageIndex < currentStageIndex) {
    return NextResponse.json(
      { error: "Completed project stages cannot be moved backwards." },
      { status: 409 },
    );
  }

  const nextProjectFlow = buildReceiptProjectFlow({
    existing: existingProjectFlow as unknown as Record<string, unknown> | null,
    stage: effectiveStage,
    paymentTerm: parsed.data.paymentTerm ?? existingProjectFlow?.paymentTerm,
    projectValue: Number(existing.order?.totalAmount ?? existingProjectFlow?.projectValue ?? 0),
    amountPaidTotal: Number(existing.order?.paidAmount ?? existingProjectFlow?.amountPaidTotal ?? 0),
    depositType: parsed.data.depositType ?? existingProjectFlow?.depositType,
    depositValue: parsed.data.depositValue ?? existingProjectFlow?.depositValue,
    depositPercent: parsed.data.depositPercent ?? existingProjectFlow?.depositPercent,
    depositPaidAmount: parsed.data.depositPaidAmount ?? existingProjectFlow?.depositPaidAmount,
    depositPaymentMethod: parsed.data.depositPaymentMethod ?? existingProjectFlow?.depositPaymentMethod,
    depositReference: parsed.data.depositReference ?? existingProjectFlow?.depositReference,
    balancePaidAmount: parsed.data.balancePaidAmount ?? existingProjectFlow?.balancePaidAmount,
    balancePaymentMethod: parsed.data.balancePaymentMethod ?? existingProjectFlow?.balancePaymentMethod,
    balanceReference: parsed.data.balanceReference ?? existingProjectFlow?.balanceReference,
    scheduledDate: nextScheduledDate,
    postedReceiptNumber: existing.order?.orderNumber ?? existingProjectFlow?.postedReceiptNumber ?? null,
    internalNotes: parsed.data.internalNotes !== undefined ? parsed.data.internalNotes : existingProjectFlow?.internalNotes,
    paymentNotes: parsed.data.paymentNotes !== undefined ? parsed.data.paymentNotes : existingProjectFlow?.paymentNotes,
    assignedHandlers: nextAssignedHandlers,
  });

  const changedFields = [
    existingProjectFlow?.scheduledDate !== nextProjectFlow.scheduledDate ? "scheduledDate" : null,
    existingProjectFlow?.handlerType !== nextProjectFlow.handlerType ? "handlerType" : null,
    existingProjectFlow?.stage !== nextProjectFlow.stage ? "stage" : null,
    buildAssignedHandlerChange(existingAssignedHandlers, nextProjectFlow.assignedHandlers) ? "handlerAssignments" : null,
  ].filter(Boolean) as Array<"scheduledDate" | "handlerType" | "handlerAssignments" | "stage">;

  const wasCompleted = existingProjectFlow?.stage === "COMPLETED_POSTED";
  const isCompleted = nextProjectFlow.stage === "COMPLETED_POSTED";
  const isBooked = hasProjectBookingDate(nextProjectFlow);

  const updated = await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.update({
      where: { id },
      data: {
        data: {
          ...existingData,
          customerType: "project",
          projectFlow: nextProjectFlow,
        },
        order: existing.order
          ? {
              update: {
                paidAmount: nextProjectFlow.totalPaidAmount,
                paymentStatus:
                  nextProjectFlow.paymentStatus === "FULLY_PAID"
                    ? "PAID"
                    : nextProjectFlow.paymentStatus === "PARTIALLY_PAID"
                      ? "PARTIAL"
                      : "UNPAID",
                status: nextProjectFlow.stage === "COMPLETED_POSTED" ? "COMPLETED" : "PENDING",
              },
            }
          : undefined,
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            paidAmount: true,
            attendantId: true,
          },
        },
      },
    });

    if (nextProjectFlow.stage === "COMPLETED_POSTED" && tx.supportDailyEntry && tx.supportReceipt) {
      await syncCompletedProjectReceiptToPricing(tx, receipt, nextProjectFlow);
    }

    return receipt;
  });

  const bookedLog = isBooked
    ? await prisma.projectNotificationLog.findFirst({
        where: {
          receiptId: id,
          eventType: "PROJECT_BOOKED",
          status: "SENT",
        },
        select: { id: true },
      })
    : null;
  const hasSuccessfulBookedLog = Boolean(bookedLog);
  const shouldQueueBooked = shouldSendProjectBooked({
    previousProjectFlow: existingProjectFlow,
    nextProjectFlow,
    hasSuccessfulBookedLog,
  });
  const shouldQueueAssigned = shouldSendProjectAssigned({
    previousProjectFlow: existingProjectFlow,
    nextProjectFlow,
    changedFields,
  });
  const queuedEvents = resolveProjectNotificationEvents({
    shouldQueueBooked,
    shouldQueueAssigned,
    wasCompleted,
    isCompleted,
  });

  const notificationResults: Array<unknown> = [];
  for (const event of queuedEvents) {
    try {
      notificationResults.push(
        await publishProjectNotification({
          receiptId: id,
          event,
          triggeredByUserId: actorId,
          changedFields:
            event === "PROJECT_ASSIGNED" && changedFields.length === 0
              ? ["handlerAssignments"]
              : changedFields,
        }),
      );
    } catch (error) {
      console.error("[PROJECT_NOTIFY] service failed", {
        receiptId: updated.id,
        eventType: event,
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      });
    }
  }
  await syncPosReceiptToCustomerAccount(id).catch((error) => {
    console.error("[PROJECT_SYNC] failed to update customer order lifecycle", {
      receiptId: id,
      stage: nextProjectFlow.stage,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return NextResponse.json({
    ok: true,
    projectFlow: nextProjectFlow,
    receipt: updated,
    projectSaved: true,
    notificationResults,
  });
}
