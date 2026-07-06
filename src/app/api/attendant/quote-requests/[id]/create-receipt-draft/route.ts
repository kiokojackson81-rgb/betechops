import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAssignedQuoteRequestById,
  getQuoteRequestById,
  recordQuotationEvent,
  requireQuoteRequestsStaffActor,
} from "@/lib/quoteRequests";
import {
  formatQuoteCurrency,
  getQuotePaymentMethodLabel,
  getQuotePaymentTermsLabel,
  parseStoredQuoteProposal,
} from "@/lib/quoteProposal";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["receipt", "quotation"]).optional(),
});

function encodePrefill(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function buildQuoteReceiptPrefill(
  request: NonNullable<Awaited<ReturnType<typeof getAssignedQuoteRequestById>>>,
  mode: "receipt" | "quotation",
) {
  const proposal = parseStoredQuoteProposal(request.quotationData);
  const paymentMethod =
    proposal.paymentMethod === "MPESA_PAYBILL"
      ? "MPESA"
      : undefined;
  const noteLines = [
    `Quotation reference: ${request.quoteRef}`,
    request.quoteTitle ? `Quotation title: ${request.quoteTitle}` : "",
    proposal.paymentMethod ? `Preferred payment method: ${getQuotePaymentMethodLabel(proposal.paymentMethod)}` : "",
    proposal.paymentTerms ? `Payment terms: ${getQuotePaymentTermsLabel(proposal.paymentTerms)}` : "",
    proposal.paymentTerms === "DEPOSIT_AND_BALANCE" && proposal.depositAmount
      ? `Deposit: ${formatQuoteCurrency(proposal.depositAmount)}`
      : "",
    proposal.paymentTerms === "DEPOSIT_AND_BALANCE" && proposal.balanceAmount
      ? `Balance: ${formatQuoteCurrency(proposal.balanceAmount)}`
      : "",
    request.quoteMessage || "",
  ].filter(Boolean);

  return {
    serial: request.quoteRef,
    docType: mode === "quotation" ? "QUOTATION" : "RECEIPT",
    customerName: request.customerName,
    customerPhone: request.customerPhone,
    customerEmail: request.customerEmail || "",
    deliveryAddress:
      request.customerLocation || [request.specificLocation, request.town, request.county].filter(Boolean).join(", "),
    customerType: "walk-in",
    paymentMethod,
    notes: noteLines.join("\n"),
    metadata: {
      source: "QUOTATION_CENTER",
      quoteRequestId: request.id,
      quoteRef: request.quoteRef,
      quoteStatus: request.status,
      quoteSource: request.source,
    },
    items: proposal.items.map((item) => ({
      title: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid quotation draft payload." }, { status: 400 });
  }

  const quoteRequest =
    guard.isElevatedActor && !request.nextUrl.searchParams.get("impersonateId")
      ? await getQuoteRequestById(id)
      : await getAssignedQuoteRequestById(id, guard.userId);
  if (!quoteRequest) {
    return NextResponse.json({ ok: false, error: "Quotation request not found." }, { status: 404 });
  }

  const proposal = parseStoredQuoteProposal(quoteRequest.quotationData);
  if (!proposal.items.length) {
    return NextResponse.json(
      { ok: false, error: "Add at least one quoted item before opening the receipts desk." },
      { status: 400 },
    );
  }

  const mode = parsed.data.mode ?? "quotation";
  const prefill = buildQuoteReceiptPrefill(quoteRequest, mode);
  const url = `/receipts?prefill=${encodeURIComponent(encodePrefill(prefill))}`;

  await recordQuotationEvent({
    quoteRequestId: quoteRequest.id,
    eventType: mode === "quotation" ? "QUOTATION_DRAFT_OPENED" : "RECEIPT_DRAFT_OPENED",
    eventLabel: mode === "quotation" ? "Opened quotation print draft" : "Opened receipt conversion draft",
    eventDetail: `Prepared ${mode === "quotation" ? "quotation" : "receipt"} draft in receipts desk.`,
    actorUserId: guard.userId,
    actorName: guard.name,
    metadata: {
      targetDocType: mode === "quotation" ? "QUOTATION" : "RECEIPT",
    },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    url,
    docType: prefill.docType,
    quoteRequest,
  });
}
