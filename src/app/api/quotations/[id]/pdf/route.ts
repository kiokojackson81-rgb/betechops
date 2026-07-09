import { NextRequest, NextResponse } from "next/server";
import { parseStoredQuoteProposal } from "@/lib/quoteProposal";
import { buildQuoteProposalPdfBuffer } from "@/lib/quoteProposalPdf";
import { getQuoteRequestById } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing quotation id." }, { status: 400 });
  }

  try {
    const quoteRequest = await getQuoteRequestById(id);
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
      discountAmount: proposal.discountAmount,
      paymentMethod: proposal.paymentMethod,
      paymentTerms: proposal.paymentTerms,
      deliveryMode: proposal.deliveryMode,
      installationMode: proposal.installationMode,
      depositAmount: proposal.depositAmount,
      balanceAmount: proposal.balanceAmount,
      quoteMessage: quoteRequest.quoteMessage,
      warrantyMode: proposal.warrantyMode,
      fullSystemWarranty: proposal.fullSystemWarranty,
      customWarranty: proposal.customWarranty,
      warrantyGeneralNotes: proposal.warrantyGeneralNotes,
      aiWarrantySummary: proposal.aiWarrantySummary,
      proposalSections: proposal.proposalSections,
      proposalVisibility: proposal.proposalVisibility,
      preparedBy: {
        team:
          quoteRequest.assignedAttendant?.name ||
          quoteRequest.assignedAttendant?.email ||
          "Quotation attendant",
        leadTechnicianName: "Jackson",
        leadTechnicianPhone: "0705663175",
        salesDesk: "0722 151 083",
      },
    });

    return new NextResponse(quotationPdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${quoteRequest.quoteRef}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[api/quotations/[id]/pdf] error", {
      quotationId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "Failed to render quotation PDF." }, { status: 500 });
  }
}
