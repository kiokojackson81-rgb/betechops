import { documentAccessAllowed, documentVerificationPath } from "@/lib/documentAccess";
import { NextRequest, NextResponse } from "next/server";
import { findCustomerCertificateSession } from "@/lib/commissioning";
import { getWarrantyCertificate, warrantyPdfBytes } from "@/lib/warrantyCertificates";
import { storedProjectDocument } from "@/lib/storedProjectDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string; kind: string }> }) {
  const { token, kind } = await params;
  if (!["receipt", "completion", "warranty"].includes(kind)) return new NextResponse("Document unavailable", { status: 404 });
  if (!await documentAccessAllowed("certificate", token)) return NextResponse.json({ error: "Phone verification required.", verificationUrl: documentVerificationPath("certificate", token) }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const session = await findCustomerCertificateSession(token);
  if (!session) return new NextResponse("Document unavailable", { status: 404 });
  try {
    let bytes: Buffer;
    if (kind === "warranty") {
      const warranty = await getWarrantyCertificate(session.receiptId);
      if (!warranty) return new NextResponse("This document is still being prepared.", { status: 409 });
      bytes = await warrantyPdfBytes(warranty);
    } else {
      const url = kind === "receipt" ? session.projectReceiptPdfUrl : session.completionPdfUrl;
      const hash = kind === "receipt" ? session.projectReceiptPdfSha256 : session.completionPdfSha256;
      if (!url) return new NextResponse("This document is still being prepared.", { status: 409 });
      bytes = await storedProjectDocument(url, hash);
    }
    const filename = `Betech-${kind}-${(session.certificateNo || "project").replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${filename}"`, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" } });
  } catch { return new NextResponse("Document temporarily unavailable. Please try again.", { status: 503 }); }
}
