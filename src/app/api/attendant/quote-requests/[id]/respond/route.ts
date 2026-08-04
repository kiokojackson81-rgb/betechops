import { NextRequest, NextResponse } from "next/server";
import {
  quoteRequestResponseSchema,
  getAssignedQuoteRequestById,
  getQuoteRequestById,
  requireQuoteRequestsStaffActor,
  updateQuoteRequestResponse,
} from "@/lib/quoteRequests";
import {
  deliverQuotationNotifications,
  prepareQuotationPdfAssets,
} from "@/lib/quotationNotifications";
import {
  cancelQuotationFollowUps,
  scheduleQuotationFollowUps,
} from "@/lib/quotationFollowUps";

export const dynamic = "force-dynamic";

const TEXT_LIMITS = {
  quoteTitle: 200,
  quoteMessage: 12000,
  fullSystemWarranty: 4000,
  customWarranty: 4000,
  warrantyGeneralNotes: 4000,
  aiWarrantySummary: 4000,
  projectOverview: 12000,
  whatPriceIncludes: 12000,
  whatItCanPower: 12000,
  deliveryTimeline: 4000,
  installationTimeline: 4000,
  afterSalesSupport: 8000,
  importantNotes: 8000,
  scopeExclusions: 8000,
  similarProjects: 8000,
  termsAndConditions: 12000,
  preparedByDetails: 4000,
  companyLegalDetails: 8000,
  projectReferenceLinks: 4000,
  followUpNotes: 4000,
} as const;

function normalizeText(value: unknown, max?: number) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!max || trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

function normalizeNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeResponseBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const raw = body as Record<string, unknown>;
  const normalized: Record<string, unknown> = {
    ...raw,
  };

  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    normalized[key] = normalizeText(raw[key], max);
  }

  normalized.depositAmount = normalizeNumber(raw.depositAmount);
  normalized.balanceAmount = normalizeNumber(raw.balanceAmount);
  normalized.discountAmount = normalizeNumber(raw.discountAmount);
  normalized.deliveryMode = normalizeText(raw.deliveryMode);
  normalized.installationMode = normalizeText(raw.installationMode);

  if (Array.isArray(raw.quoteItems)) {
    normalized.quoteItems = raw.quoteItems
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const rawItem = item as Record<string, unknown>;
        const quantity = normalizeNumber(rawItem.quantity);
        const unitPrice = normalizeNumber(rawItem.unitPrice);
        return {
          itemName: normalizeText(rawItem.itemName, 600),
          description: normalizeText(rawItem.description, 4000),
          quantity: quantity && quantity > 0 ? quantity : 1,
          unitPrice: unitPrice && unitPrice >= 0 ? unitPrice : 0,
          defaultWarranty: normalizeText(rawItem.defaultWarranty, 4000),
          warranty: normalizeText(rawItem.warranty, 4000),
          warrantyPeriod: normalizeNumber(rawItem.warrantyPeriod),
          warrantyUnit: normalizeText(rawItem.warrantyUnit),
          warrantyNotes: normalizeText(rawItem.warrantyNotes, 4000),
          warrantySource: normalizeText(rawItem.warrantySource),
        };
      })
      .filter((item) => typeof item.itemName === "string" && item.itemName.length > 0);
  }

  return normalized;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const normalizedBody = normalizeResponseBody(body);
  const parsed = quoteRequestResponseSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid quotation response payload." }, { status: 400 });
  }

  const existing =
    guard.isElevatedActor && !request.nextUrl.searchParams.get("impersonateId")
      ? await getQuoteRequestById(id)
      : await getAssignedQuoteRequestById(id, guard.userId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Quotation request not found." }, { status: 404 });
  }

  const updated = await updateQuoteRequestResponse(
    id,
    {
      id: guard.userId,
      name: guard.name,
      email: guard.email,
    },
    parsed.data,
  );

  if (!updated) {
    return NextResponse.json({ ok: false, error: "Unable to update quotation request." }, { status: 500 });
  }

  const assets = await prepareQuotationPdfAssets(updated, {
    name: guard.name,
    email: guard.email,
  });
  const notifications = await deliverQuotationNotifications(updated, {
    pdfBuffer: assets.pdfBuffer,
    pdfUrl: assets.pdfUrl,
    whatsappPdfUrl: assets.whatsappPdfUrl,
    sendEmail: Boolean(parsed.data.sendEmail),
    sendSms: Boolean(parsed.data.sendSms),
    // Automatic WhatsApp delivery happens on initial quotation creation.
    // Follow-up edits or email/SMS sends should not retrigger the same
    // quotation_ready flow unless we add an explicit resend action.
    triggerWhatsapp: false,
  });

  if (["QUOTED", "FOLLOW_UP", "REVISED"].includes(updated.status)) {
    await scheduleQuotationFollowUps(updated.id, {
      quotationPdfLink: assets.pdfUrl,
      resetAutomaticFollowUps: true,
      actor: {
        userId: guard.userId,
        name: guard.name,
        email: guard.email,
      },
    }).catch(() => undefined);
  } else if (["APPROVED", "CONVERTED", "CLOSED"].includes(updated.status)) {
    await cancelQuotationFollowUps(updated.id, {
      reason: `Quotation moved to ${updated.status}.`,
      actor: {
        userId: guard.userId,
        name: guard.name,
        email: guard.email,
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    request: updated,
    pdfUrl: assets.pdfUrl,
    notifications,
  });
}
