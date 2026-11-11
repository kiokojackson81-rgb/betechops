import { NextRequest, NextResponse } from "next/server";
import { findAccessibleCommissioningSession } from "@/lib/commissioning";
import { buildReceiptPdfResponse } from "@/lib/receiptPdfResponse";
import { getWarrantyCertificate, warrantyPdfBytes } from "@/lib/warrantyCertificates";
import { storedProjectDocument } from "@/lib/storedProjectDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string; kind: string }> }) {
  const { token, kind } = await context.params;
  if (!(["receipt", "completion", "warranty"] as string[]).includes(kind)) return new NextResponse("Document unavailable", { status: 404 });
  const session = await findAccessibleCommissioningSession(token);
  if (!session || session.status !== "ISSUED") return new NextResponse("Project documents are available once commissioning is completed.", { status: 409 });
  try {
    if (kind === "receipt") return buildReceiptPdfResponse(session.receiptId, { asDownload: true, allowCached: false, fileNamePrefix: `project-receipt-${session.certificateNo || session.receipt.receiptNumber || "betech"}` });
    const bytes = kind === "warranty"
      ? await (async () => { const certificate = await getWarrantyCertificate(session.receiptId); return certificate ? warrantyPdfBytes(certificate) : null; })()
      : session.completionPdfUrl ? await storedProjectDocument(session.completionPdfUrl, session.completionPdfSha256) : null;
    if (!bytes) return new NextResponse("This document is still being prepared.", { status: 409 });
    const filename = `Betech-${kind}-${(session.certificateNo || "project").replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" } });
  } catch {
    return new NextResponse("Document temporarily unavailable. Please try again.", { status: 503 });
  }
}
