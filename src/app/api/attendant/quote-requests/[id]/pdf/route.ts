import { NextRequest, NextResponse } from "next/server";
import {
  getAssignedQuoteRequestById,
  getQuoteRequestById,
  requireQuoteRequestsStaffActor,
} from "@/lib/quoteRequests";
import { parseStoredQuoteProposal } from "@/lib/quoteProposal";
import { buildQuoteProposalPdfBuffer } from "@/lib/quoteProposalPdf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireQuoteRequestsStaffActor({
    impersonateId: request.nextUrl.searchParams.get("impersonateId"),
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const quoteRequest =
    guard.isElevatedActor && !request.nextUrl.searchParams.get("impersonateId")
      ? await getQuoteRequestById(id)
      : await getAssignedQuoteRequestById(id, guard.userId);
  if (!quoteRequest) {
    return NextResponse.json({ ok: false, error: "Quotation request not found." }, { status: 404 });
  }

  const proposal = parseStoredQuoteProposal(quoteRequest.quotationData);
  const quotationPdf = await buildQuoteProposalPdfBuffer({
    quoteRef: quoteRequest.quoteRef,
    quoteTitle: quoteRequest.quoteTitle || "Betech Solar quotation",
    customerName: quoteRequest.customerName,
    customerPhone: quoteRequest.customerPhone,
    customerEmail: quoteRequest.customerEmail,
    customerLocation:
      quoteRequest.customerLocation ||
      [quoteRequest.town, quoteRequest.county].filter(Boolean).join(", ") ||
      null,
    issuedAtLabel: new Date().toLocaleString("en-KE"),
    items: proposal.items,
    subtotal: proposal.subtotal,
    total: proposal.total,
    paymentMethod: proposal.paymentMethod,
    paymentTerms: proposal.paymentTerms,
    depositAmount: proposal.depositAmount,
    balanceAmount: proposal.balanceAmount,
    quoteMessage: quoteRequest.quoteMessage,
  });

  return new NextResponse(quotationPdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${quoteRequest.quoteRef}.pdf\"`,
      "Cache-Control": "no-store",
    },
  });
}
