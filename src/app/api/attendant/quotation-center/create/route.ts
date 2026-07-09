import { NextRequest, NextResponse } from "next/server";
import {
  createManualQuotation,
  manualQuotationCreateSchema,
  requireQuoteRequestsStaffActor,
} from "@/lib/quoteRequests";
import {
  deliverQuotationNotifications,
  prepareQuotationPdfAssets,
} from "@/lib/quotationNotifications";

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

function normalizeCreateBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const raw = body as Record<string, unknown>;
  const normalized: Record<string, unknown> = {
    ...raw,
    email: typeof raw.email === "string" ? raw.email.trim() || "" : raw.email,
    location: normalizeText(raw.location),
    county: normalizeText(raw.county),
    town: normalizeText(raw.town),
    specificLocation: normalizeText(raw.specificLocation),
    propertyType: normalizeText(raw.propertyType),
    preferredProducts: normalizeText(raw.preferredProducts),
    notes: normalizeText(raw.notes),
    templateId: normalizeText(raw.templateId),
    templateName: normalizeText(raw.templateName),
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

export async function POST(request: NextRequest) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const body = await request.json().catch(() => null);
  const normalizedBody = normalizeCreateBody(body);
  const parsed = manualQuotationCreateSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const issuePath = firstIssue?.path?.join(".") || "payload";
    const issueMessage = firstIssue?.message || "Invalid quotation payload.";
    console.error("[quotation-center.create.invalid]", {
      issues: parsed.error.flatten(),
      issuePath,
      issueMessage,
      bodyKeys:
        normalizedBody && typeof normalizedBody === "object"
          ? Object.keys(normalizedBody as Record<string, unknown>)
          : [],
    });
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid quotation payload: ${issuePath} - ${issueMessage}`,
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const created = await createManualQuotation(parsed.data, {
      id: guard.userId,
      name: guard.name,
      email: guard.email,
    });

    if (!created) {
      return NextResponse.json({ ok: false, error: "Unable to save quotation." }, { status: 500 });
    }

    let notifications: Array<{
      channel: "email" | "sms" | "whatsapp";
      ok: boolean;
      error?: string;
      meta?: Record<string, unknown>;
    }> = [];
    let pdfUrl: string | null = null;

    try {
      const assets = await prepareQuotationPdfAssets(created, {
        name: guard.name,
        email: guard.email,
      });
      pdfUrl = assets.pdfUrl;
      notifications = await deliverQuotationNotifications(created, {
        pdfBuffer: assets.pdfBuffer,
        pdfUrl: assets.pdfUrl,
        sendEmail: Boolean(created.customerEmail),
        sendSms: Boolean(created.customerPhone),
        triggerWhatsapp: true,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Failed to prepare quotation notifications.";
      console.error("[quotation-center.create.notify_failed]", {
        quoteRequestId: created.id,
        quoteRef: created.quoteRef,
        error: message,
      });
    }

    return NextResponse.json({ ok: true, request: created, pdfUrl, notifications });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Unable to save quotation.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
