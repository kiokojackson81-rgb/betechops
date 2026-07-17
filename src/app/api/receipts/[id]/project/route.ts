import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import {
  buildReceiptProjectFlow,
  readReceiptProjectFlow,
  RECEIPT_PROJECT_HANDLER_TYPES,
  RECEIPT_PROJECT_PAYMENT_TERMS,
  RECEIPT_PROJECT_STAGES,
} from "@/lib/receiptProjects";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  stage: z.enum(RECEIPT_PROJECT_STAGES).optional(),
  paymentTerm: z.enum(RECEIPT_PROJECT_PAYMENT_TERMS).optional(),
  depositPercent: z.number().min(0).max(100).optional(),
  scheduledDate: z.string().trim().nullable().optional(),
  internalNotes: z.string().trim().nullable().optional(),
  handlerType: z.enum(RECEIPT_PROJECT_HANDLER_TYPES).nullable().optional(),
  handlerStaffId: z.string().trim().nullable().optional(),
  handlerStaffName: z.string().trim().nullable().optional(),
  externalAgentName: z.string().trim().nullable().optional(),
  externalAgentPhone: z.string().trim().nullable().optional(),
});

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveId(context: ParamsContext) {
  const params = await (context as { params: Promise<{ id: string }> | { id: string } }).params;
  return params.id;
}

export async function PATCH(req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

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

  const nextProjectFlow = buildReceiptProjectFlow({
    existing: existingProjectFlow as unknown as Record<string, unknown> | null,
    stage: parsed.data.stage ?? existingProjectFlow?.stage,
    paymentTerm: parsed.data.paymentTerm ?? existingProjectFlow?.paymentTerm,
    projectValue: Number(existing.order?.totalAmount ?? existingProjectFlow?.projectValue ?? 0),
    amountPaidTotal: Number(existing.order?.paidAmount ?? existingProjectFlow?.amountPaidTotal ?? 0),
    depositPercent: parsed.data.depositPercent ?? existingProjectFlow?.depositPercent,
    scheduledDate:
      parsed.data.scheduledDate !== undefined ? parsed.data.scheduledDate : existingProjectFlow?.scheduledDate,
    postedReceiptNumber: existing.order?.orderNumber ?? existingProjectFlow?.postedReceiptNumber ?? null,
    internalNotes:
      parsed.data.internalNotes !== undefined ? parsed.data.internalNotes : existingProjectFlow?.internalNotes,
    handlerType:
      parsed.data.handlerType !== undefined ? parsed.data.handlerType : existingProjectFlow?.handlerType,
    handlerStaffId:
      parsed.data.handlerStaffId !== undefined ? parsed.data.handlerStaffId : existingProjectFlow?.handlerStaffId,
    handlerStaffName:
      parsed.data.handlerStaffName !== undefined
        ? parsed.data.handlerStaffName
        : existingProjectFlow?.handlerStaffName,
    externalAgentName:
      parsed.data.externalAgentName !== undefined
        ? parsed.data.externalAgentName
        : existingProjectFlow?.externalAgentName,
    externalAgentPhone:
      parsed.data.externalAgentPhone !== undefined
        ? parsed.data.externalAgentPhone
        : existingProjectFlow?.externalAgentPhone,
  });

  const updated = await prisma.receipt.update({
    where: { id },
    data: {
      data: {
        ...existingData,
        customerType: "project",
        projectFlow: nextProjectFlow,
      },
    },
    include: {
      order: {
        select: {
          orderNumber: true,
          totalAmount: true,
          paidAmount: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    projectFlow: nextProjectFlow,
    receipt: updated,
  });
}
