import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import {
  convertLppToProject,
  getLppAccountSummary,
  getSerializedLppAccountDetail,
} from "@/lib/lipaPolePoleService";
import { prisma } from "@/lib/prisma";
import { upsertQuoteProjectOrder } from "@/lib/quoteProjects";
import { ensureQuoteRequestsSchema, recordQuotationEvent } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as { params?: Promise<{ id: string }> | { id: string } }).params;
  if (maybePromise && typeof (maybePromise as Promise<{ id: string }>).then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

function mapErrorStatus(message: string) {
  if (["PROJECT_ID_REQUIRED", "LPP_BALANCE_NOT_ZERO", "LPP_NOT_CONVERTIBLE"].includes(message)) return 400;
  if (message === "LPP_NOT_FOUND") return 404;
  if (message === "LPP_ALREADY_CONVERTED") return 409;
  return 500;
}

export async function POST(_req: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());
  const actorName =
    (auth.session?.user as { name?: string | null; email?: string | null } | undefined)?.name ??
    (auth.session?.user as { email?: string | null } | undefined)?.email ??
    "LPP operator";
  const { id } = await resolveParams(context);

  try {
    const summary = await getLppAccountSummary(id);
    if (summary.lpp.convertedProjectId) {
      const detail = await getSerializedLppAccountDetail(id);
      return noStoreJson({ ok: true, quoteRequestId: summary.lpp.convertedProjectId, ...detail });
    }

    const workflow = await ensureLppProjectWorkflow({
      lpp: summary.lpp,
      items: summary.items,
      totalPaid: Number(summary.summary.totalPaid ?? 0),
      actorId,
      actorName,
    });

    await convertLppToProject({
      lipaPolePoleId: id,
      projectId: workflow.quoteRequestId,
      convertedById: actorId,
    });

    const detail = await getSerializedLppAccountDetail(id);
    return noStoreJson({
      ok: true,
      quoteRequestId: workflow.quoteRequestId,
      projectOrderId: workflow.projectOrderId,
      ...detail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to convert LPP to project";
    return noStoreJson({ error: message }, { status: mapErrorStatus(message) });
  }
}

async function ensureLppProjectWorkflow(input: {
  lpp: Awaited<ReturnType<typeof getLppAccountSummary>>["lpp"];
  items: Awaited<ReturnType<typeof getLppAccountSummary>>["items"];
  totalPaid: number;
  actorId: string | null;
  actorName: string;
}) {
  await ensureQuoteRequestsSchema();

  const customer = await prisma.user.findUnique({
    where: { id: input.lpp.customerId },
    select: {
      name: true,
      phone: true,
      email: true,
      county: true,
      town: true,
      estateLandmark: true,
      locationNotes: true,
    },
  });
  const assigned = input.lpp.assignedToId
    ? await prisma.user.findUnique({
        where: { id: input.lpp.assignedToId },
        select: { id: true, email: true, name: true },
      })
    : null;
  const quoteRef = `LPP-PROJECT-${input.lpp.reference}`;
  const existing = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "QuoteRequest"
    WHERE "quoteRef" = ${quoteRef}
    LIMIT 1
  `);

  let quoteRequestId = existing[0]?.id ?? null;
  if (!quoteRequestId) {
    const id = randomUUID();
    const quotationData = {
      items: input.items.map((item) => ({
        itemName: item.description,
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.unitPrice ?? 0),
        serial: item.serial ?? null,
        warranty: item.warranty ?? null,
      })),
      subtotal: Number(input.lpp.agreedTotal ?? 0),
      total: Number(input.lpp.agreedTotal ?? 0),
      paymentMethod: "BANK_TRANSFER",
      paymentTerms: "FULL_PAYMENT",
      depositAmount: Number(input.lpp.agreedTotal ?? 0),
      balanceAmount: 0,
      lppReference: input.lpp.reference,
    } as Prisma.JsonObject;

    const metadata = {
      source: "LIPA_POLE_POLE",
      lppId: input.lpp.id,
      lppReference: input.lpp.reference,
      lppCustomerId: input.lpp.customerId,
      lppSalespersonId: input.lpp.salespersonId,
      lppAssignedToId: input.lpp.assignedToId,
    } as Prisma.JsonObject;

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "QuoteRequest" (
        "id",
        "quoteRef",
        "customerUserId",
        "customerName",
        "customerPhone",
        "customerEmail",
        "customerLocation",
        "county",
        "town",
        "specificLocation",
        "projectType",
        "preferredProducts",
        "notes",
        "status",
        "source",
        "assignedAttendantId",
        "assignedAttendantEmail",
        "assignedAttendantName",
        "quoteTitle",
        "quoteMessage",
        "quotationData",
        "metadata",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${id},
        ${quoteRef},
        ${input.lpp.customerId},
        ${customer?.name ?? "LPP Customer"},
        ${normalizePhone(customer?.phone)},
        ${normalizeEmail(customer?.email)},
        ${[customer?.estateLandmark, customer?.locationNotes].filter(Boolean).join(", ") || null},
        ${customer?.county ?? null},
        ${customer?.town ?? null},
        ${customer?.estateLandmark ?? null},
        ${"OTHER"},
        ${input.items.map((item) => item.description).join(", ") || `LPP ${input.lpp.reference}`},
        ${input.lpp.notes ?? null},
        ${"APPROVED"},
        ${"MANUAL"},
        ${assigned?.id ?? null},
        ${normalizeEmail(assigned?.email)},
        ${assigned?.name ?? assigned?.email ?? null},
        ${`LPP Project Conversion ${input.lpp.reference}`},
        ${`Converted from Lipa Pole Pole ${input.lpp.reference}`},
        ${quotationData},
        ${metadata},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("quoteRef") DO NOTHING
    `);

    const inserted = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "QuoteRequest"
      WHERE "quoteRef" = ${quoteRef}
      LIMIT 1
    `);
    quoteRequestId = inserted[0]?.id ?? null;
  }

  if (!quoteRequestId) {
    throw new Error("FAILED_TO_CREATE_PROJECT_WORKFLOW");
  }

  const projectOrder = await upsertQuoteProjectOrder({
    quoteRequestId,
    stage: "RECEIPT_CREATED",
    paymentTerm: "FULL_BEFORE_INSTALLATION",
    totalAmount: Number(input.lpp.agreedTotal ?? 0),
    depositPercent: 0,
    depositRequiredAmount: 0,
    depositPaidAmount: input.totalPaid,
    amountPaidTotal: input.totalPaid,
    assignedStaffId: assigned?.id ?? null,
    assignedStaffEmail: normalizeEmail(assigned?.email),
    assignedStaffName: assigned?.name ?? assigned?.email ?? null,
    internalNotes: `Created from Lipa Pole Pole ${input.lpp.reference}. Fully paid before project workflow.`,
    actorUserId: input.actorId ?? null,
    createEvent: {
      eventType: "LPP_CONVERTED_TO_PROJECT",
      eventLabel: "LPP converted into project workflow",
      eventDetail: `Lipa Pole Pole ${input.lpp.reference} created this project workflow.`,
      metadata: {
        lppId: input.lpp.id,
        lppReference: input.lpp.reference,
      },
    },
  });

  await recordQuotationEvent({
    quoteRequestId,
    eventType: "LPP_CONVERTED_TO_PROJECT",
    eventLabel: "LPP converted into project workflow",
    eventDetail: `Converted from fully paid Lipa Pole Pole ${input.lpp.reference}.`,
    actorUserId: input.actorId ?? null,
    actorName: input.actorName,
    metadata: {
      lppId: input.lpp.id,
      lppReference: input.lpp.reference,
      projectOrderId: projectOrder?.id ?? null,
    },
  }).catch(() => undefined);

  return {
    quoteRequestId,
    projectOrderId: projectOrder?.id ?? null,
  };
}

function normalizeEmail(value: unknown) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return trimmed || null;
}

function normalizePhone(value: unknown) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}
