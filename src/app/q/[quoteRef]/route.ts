import { NextRequest, NextResponse } from "next/server";
import { getShopBaseUrl } from "@/lib/runtimeUrls";
import { getQuoteRequestByRef } from "@/lib/quoteRequests";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ quoteRef: string }> }) {
  const { quoteRef } = await context.params;
  const normalizedRef = String(quoteRef || "").trim();

  if (!normalizedRef) {
    return NextResponse.json({ ok: false, error: "Missing quotation reference." }, { status: 400 });
  }

  const quotation = await getQuoteRequestByRef(normalizedRef);
  if (!quotation) {
    return NextResponse.json({ ok: false, error: "Quotation not found." }, { status: 404 });
  }

  const pdfUrl = `${getShopBaseUrl().replace(/\/$/, "")}/api/quotations/${encodeURIComponent(quotation.id)}/pdf`;
  return NextResponse.redirect(pdfUrl, { status: 307 });
}
