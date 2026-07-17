import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getQuoteRequestById,
  recordQuotationEvent,
  requireQuoteRequestsStaffActor,
} from "@/lib/quoteRequests";
import { parseStoredQuoteProposal, type QuotePaymentTerms } from "@/lib/quoteProposal";
import {
  QUOTE_PROJECT_PAYMENT_TERMS,
  QUOTE_PROJECT_STAGES,
  getQuoteProjectOrderByQuoteRequestId,
  listQuoteProjectEvents,
  upsertQuoteProjectOrder,
  type QuoteProjectPaymentTerm,
  type QuoteProjectStage,
} from "@/lib/quoteProjects";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  paymentTerm: z.enum(QUOTE_PROJECT_PAYMENT_TERMS).optional(),
  depositPercent: z.number().min(0).max(100).optional(),
});

const updateSchema = z.object({
  stage: z.enum(QUOTE_PROJECT_STAGES).optional(),
  paymentTerm: z.enum(QUOTE_PROJECT_PAYMENT_TERMS).optional(),
  totalAmount: z.number().min(0).optional(),
  depositPercent: z.number().min(0).max(100).optional(),
  depositPaidAmount: z.number().min(0).optional(),
  amountPaidTotal: z.number().min(0).optional(),
  scheduledDate: z.string().trim().optional().nullable(),
  postedReceiptNumber: z.string().trim().optional().nullable(),
  internalNotes: z.string().trim().optional().nullable(),
});

function mapQuotePaymentTerm(value: QuotePaymentTerms | null): QuoteProjectPaymentTerm {
  if (value === "APPROVED_AFTER_INSTALLATION") return "FULL_AFTER_INSTALLATION";
  if (value === "DEPOSIT_AND_BALANCE") return "DEPOSIT_AND_BALANCE";
  return "FULL_BEFORE_INSTALLATION";
}

function parseIsoDate(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function loadProjectPayload(id: string) {
  const quoteRequest = await getQuoteRequestById(id);
  if (!quoteRequest) return null;
  const projectOrder = await getQuoteProjectOrderByQuoteRequestId(quoteRequest.id);
  const projectEvents = projectOrder ? await listQuoteProjectEvents(projectOrder.id) : [];
  return {
    quoteRequest,
    projectOrder,
    projectEvents,
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  if (!guard.isElevatedActor) {
    return NextResponse.json({ ok: false, error: "Only admin can inspect project workflow here." }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = await loadProjectPayload(id);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Quotation request not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...payload });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  if (!guard.isElevatedActor) {
    return NextResponse.json({ ok: false, error: "Only admin can create project workflow here." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid project workflow payload." }, { status: 400 });
  }

  const { id } = await context.params;
  const quoteRequest = await getQuoteRequestById(id);
  if (!quoteRequest) {
    return NextResponse.json({ ok: false, error: "Quotation request not found." }, { status: 404 });
  }

  const proposal = parseStoredQuoteProposal(quoteRequest.quotationData);
  const paymentTerm = parsed.data.paymentTerm ?? mapQuotePaymentTerm(proposal.paymentTerms);
  const totalAmount = Number(proposal.total ?? 0);
  const depositPercent =
    paymentTerm === "DEPOSIT_AND_BALANCE"
      ? parsed.data.depositPercent ??
        (proposal.depositAmount && totalAmount > 0 ? (proposal.depositAmount / totalAmount) * 100 : 30)
      : 0;

  const projectOrder = await upsertQuoteProjectOrder({
    quoteRequestId: quoteRequest.id,
    stage: "RECEIPT_CREATED",
    paymentTerm,
    totalAmount,
    depositPercent,
    depositRequiredAmount: proposal.depositAmount ?? null,
    amountPaidTotal: 0,
    depositPaidAmount: 0,
    assignedStaffId: quoteRequest.assignedAttendant?.id ?? null,
    assignedStaffEmail: quoteRequest.assignedAttendant?.email ?? null,
    assignedStaffName: quoteRequest.assignedAttendant?.name ?? null,
    actorUserId: guard.userId,
    createEvent: {
      eventType: "PROJECT_ORDER_CREATED",
      eventLabel: "Project workflow created",
      eventDetail: `Project workflow started with ${paymentTerm.replace(/_/g, " ").toLowerCase()} terms.`,
      metadata: {
        quoteRef: quoteRequest.quoteRef,
        totalAmount,
        paymentTerm,
      },
    },
  });

  if (projectOrder) {
    await recordQuotationEvent({
      quoteRequestId: quoteRequest.id,
      eventType: "PROJECT_ORDER_CREATED",
      eventLabel: "Project workflow created",
      eventDetail: `Started project order with ${projectOrder.stage.replace(/_/g, " ").toLowerCase()}.`,
      actorUserId: guard.userId,
      actorName: guard.name,
      metadata: {
        projectOrderId: projectOrder.id,
        projectStage: projectOrder.stage,
        paymentTerm: projectOrder.paymentTerm,
      },
    }).catch(() => undefined);
  }

  const refreshed = await loadProjectPayload(id);
  return NextResponse.json({ ok: true, ...refreshed });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  if (!guard.isElevatedActor) {
    return NextResponse.json({ ok: false, error: "Only admin can update project workflow here." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid project workflow update." }, { status: 400 });
  }

  const { id } = await context.params;
  const quoteRequest = await getQuoteRequestById(id);
  if (!quoteRequest) {
    return NextResponse.json({ ok: false, error: "Quotation request not found." }, { status: 404 });
  }

  const existing = await getQuoteProjectOrderByQuoteRequestId(quoteRequest.id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Create the project workflow first." }, { status: 404 });
  }

  const stage = parsed.data.stage ?? existing.stage;
  const paymentTerm = parsed.data.paymentTerm ?? existing.paymentTerm;
  const totalAmount = parsed.data.totalAmount ?? existing.totalAmount;
  const scheduledDate = parsed.data.scheduledDate !== undefined
    ? parseIsoDate(parsed.data.scheduledDate)
    : existing.scheduledDate
      ? new Date(existing.scheduledDate)
      : null;

  const projectOrder = await upsertQuoteProjectOrder({
    quoteRequestId: quoteRequest.id,
    stage,
    paymentTerm,
    totalAmount,
    depositPercent: parsed.data.depositPercent ?? existing.depositPercent,
    depositPaidAmount: parsed.data.depositPaidAmount ?? existing.depositPaidAmount,
    amountPaidTotal: parsed.data.amountPaidTotal ?? existing.amountPaidTotal,
    scheduledDate,
    completedAt:
      stage === "COMPLETED_POSTED"
        ? existing.completedAt
          ? new Date(existing.completedAt)
          : new Date()
        : null,
    postedToPosAt:
      stage === "COMPLETED_POSTED"
        ? existing.postedToPosAt
          ? new Date(existing.postedToPosAt)
          : new Date()
        : null,
    postedReceiptNumber:
      parsed.data.postedReceiptNumber !== undefined
        ? parsed.data.postedReceiptNumber || null
        : existing.postedReceiptNumber,
    assignedStaffId: quoteRequest.assignedAttendant?.id ?? existing.assignedStaffId,
    assignedStaffEmail: quoteRequest.assignedAttendant?.email ?? existing.assignedStaffEmail,
    assignedStaffName: quoteRequest.assignedAttendant?.name ?? existing.assignedStaffName,
    internalNotes:
      parsed.data.internalNotes !== undefined ? parsed.data.internalNotes || null : existing.internalNotes,
    actorUserId: guard.userId,
    createEvent: {
      eventType: "PROJECT_ORDER_UPDATED",
      eventLabel: "Project workflow updated",
      eventDetail: `Stage: ${stage.replace(/_/g, " ")} · Payment: ${paymentTerm.replace(/_/g, " ")}`,
      metadata: {
        stage,
        paymentTerm,
        totalAmount,
        scheduledDate: scheduledDate?.toISOString() ?? null,
      },
    },
  });

  if (projectOrder) {
    const quoteStatus = stage === "COMPLETED_POSTED" ? "CONVERTED" : quoteRequest.status;
    if (quoteStatus !== quoteRequest.status) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "QuoteRequest"
        SET "status" = ${quoteStatus}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${quoteRequest.id}
      `);
    }
    await recordQuotationEvent({
      quoteRequestId: quoteRequest.id,
      eventType: "PROJECT_ORDER_UPDATED",
      eventLabel: "Project workflow updated",
      eventDetail: `Project stage is now ${projectOrder.stage.replace(/_/g, " ").toLowerCase()}.`,
      actorUserId: guard.userId,
      actorName: guard.name,
      metadata: {
        projectOrderId: projectOrder.id,
        projectStage: projectOrder.stage,
        paymentTerm: projectOrder.paymentTerm,
        paymentStatus: projectOrder.paymentStatus,
        postedReceiptNumber: projectOrder.postedReceiptNumber,
      },
    }).catch(() => undefined);
  }

  const refreshed = await loadProjectPayload(id);
  return NextResponse.json({ ok: true, ...refreshed });
}
