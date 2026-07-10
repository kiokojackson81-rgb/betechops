import { NextRequest, NextResponse } from "next/server";
import {
  createManualQuotation,
  getQuoteStaffUserById,
  manualQuotationCreateSchema,
} from "@/lib/quoteRequests";
import { normalizePhone } from "@/lib/phone";
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
    assignedAttendantId: normalizeText(raw.assignedAttendantId),
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
  const body = await request.json().catch(() => null);
  const normalizedBody = normalizeCreateBody(body);
  const parsed = manualQuotationCreateSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const issuePath = firstIssue?.path?.join(".") || "payload";
    const issueMessage = firstIssue?.message || "Invalid quotation payload.";
    console.error("[public-quotation-center.create.invalid]", {
      issues: parsed.error.flatten(),
      issuePath,
      issueMessage,
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

  const assignedAttendantId = parsed.data.assignedAttendantId?.trim();
  if (!assignedAttendantId) {
    return NextResponse.json(
      { ok: false, error: "Select the staff member who should own this quotation." },
      { status: 400 },
    );
  }

  const owner = await getQuoteStaffUserById(assignedAttendantId);
  if (!owner) {
    return NextResponse.json(
      { ok: false, error: "The selected quotation owner is invalid or unavailable." },
      { status: 400 },
    );
  }

  try {
    const created = await createManualQuotation(
      {
        ...parsed.data,
        assignedAttendantId: owner.id,
        source: parsed.data.source || "RECEIPTS",
      },
      {
        id: owner.id,
        name: owner.name,
        email: owner.email,
      },
    );

    if (!created) {
      return NextResponse.json({ ok: false, error: "Unable to save quotation." }, { status: 500 });
    }

    const fallbackPhone = normalizePhone(parsed.data.phone || "");
    const notificationRequest = {
      ...created,
      customerPhone: created.customerPhone || created.manualCustomerPhone || fallbackPhone || "",
      manualCustomerPhone: created.manualCustomerPhone || fallbackPhone || null,
    };

    console.info("[public-quotation-center.create.notification_context]", {
      quoteRequestId: created.id,
      quoteRef: created.quoteRef,
      submittedPhone: parsed.data.phone,
      fallbackPhone,
      createdCustomerPhone: created.customerPhone || null,
      createdManualCustomerPhone: created.manualCustomerPhone || null,
      notificationPhone: notificationRequest.customerPhone || null,
    });

    let notifications: Array<{
      channel: "email" | "sms" | "whatsapp";
      ok: boolean;
      error?: string;
      meta?: Record<string, unknown>;
    }> = [];
    let pdfUrl: string | null = null;

    try {
      const assets = await prepareQuotationPdfAssets(notificationRequest, {
        name: owner.name,
        email: owner.email,
      });
      pdfUrl = assets.pdfUrl;
      notifications = await deliverQuotationNotifications(notificationRequest, {
        pdfBuffer: assets.pdfBuffer,
        pdfUrl: assets.pdfUrl,
        whatsappPdfUrl: assets.whatsappPdfUrl,
        sendEmail: Boolean(notificationRequest.customerEmail),
        sendSms: Boolean(notificationRequest.customerPhone || notificationRequest.manualCustomerPhone),
        triggerWhatsapp: true,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Failed to prepare quotation notifications.";
      console.error("[public-quotation-center.create.notify_failed]", {
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
