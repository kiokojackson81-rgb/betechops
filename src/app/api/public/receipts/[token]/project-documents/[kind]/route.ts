import { NextRequest, NextResponse } from "next/server";
import { canAccessDocument, resolveDocument } from "@/lib/documentAccess";
import { prisma } from "@/lib/prisma";
import { storedProjectDocument } from "@/lib/storedProjectDocument";
import { getWarrantyCertificate, warrantyPdfBytes } from "@/lib/warrantyCertificates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string; kind: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const { token, kind } = await params;
  if (!["completion", "warranty"].includes(kind)) return new NextResponse("Document unavailable", { status: 404 });
  const access = await resolveDocument("receipt", token);
  if (!access || !await canAccessDocument(access)) return NextResponse.json({ error: "Receipt access has expired. Please verify your phone number again." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const session = await prisma.commissioningSession.findUnique({
    where: { receiptId: access.receiptId },
    select: { status: true, certificateNo: true, completionPdfUrl: true, completionPdfSha256: true },
  });
  if (!session || session.status !== "ISSUED") return new NextResponse("Project documents are still being prepared.", { status: 409 });
  try {
    let bytes: Buffer | null;
    if (kind === "warranty") {
      const certificate = await getWarrantyCertificate(access.receiptId);
      if (!certificate) return new NextResponse("This document is still being prepared.", { status: 409 });
      bytes = await warrantyPdfBytes(certificate);
    } else {
      bytes = session.completionPdfUrl ? await storedProjectDocument(session.completionPdfUrl, session.completionPdfSha256) : null;
    }
    if (!bytes) return new NextResponse("This document is still being prepared.", { status: 409 });
    const filename = `Betech-${kind}-${(session.certificateNo || "project").replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
    return new NextResponse(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    } });
  } catch {
    return new NextResponse("Document temporarily unavailable. Please try again.", { status: 503 });
  }
}
