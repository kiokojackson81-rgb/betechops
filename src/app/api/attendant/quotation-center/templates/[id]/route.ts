import { NextRequest, NextResponse } from "next/server";
import {
  deleteQuotationTemplate,
  quotationTemplateSchema,
  requireQuoteRequestsStaffActor,
  updateQuotationTemplate,
} from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

const TEXT_LIMITS = {
  templateName: 200,
  systemSize: 120,
  brand: 120,
  projectReferenceLinks: 4000,
  projectOverview: 12000,
  whatItCanPower: 12000,
  scopeOfWork: 12000,
  deliveryTimeline: 500,
  installationTimeline: 500,
  warranty: 4000,
  afterSalesSupport: 4000,
  terms: 8000,
  internalNotes: 8000,
  defaultPdfLayout: 120,
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

function normalizeTemplateBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const raw = body as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...raw };

  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    normalized[key] = normalizeText(raw[key], max);
  }

  normalized.category = normalizeText(raw.category);
  normalized.defaultPaymentMethod = normalizeText(raw.defaultPaymentMethod);
  normalized.defaultPaymentTerms = normalizeText(raw.defaultPaymentTerms);
  normalized.defaultDepositAmount = normalizeNumber(raw.defaultDepositAmount);
  normalized.defaultBalanceAmount = normalizeNumber(raw.defaultBalanceAmount);
  normalized.defaultDiscountAmount = normalizeNumber(raw.defaultDiscountAmount);

  if (Array.isArray(raw.items)) {
    normalized.items = raw.items
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

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function guardRequest(request: NextRequest) {
  return requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await guardRequest(request);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = quotationTemplateSchema.safeParse(normalizeTemplateBody(body));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid template payload.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const template = await updateQuotationTemplate(id, parsed.data, {
    id: guard.actorUserId,
    name: guard.name,
    email: guard.email,
  });
  if (!template) {
    return NextResponse.json({ ok: false, error: "Unable to update quotation template." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, template });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = await guardRequest(request);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const deleted = await deleteQuotationTemplate(id);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "Quotation template not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
