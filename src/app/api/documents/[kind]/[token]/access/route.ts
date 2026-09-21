import { NextRequest, NextResponse } from "next/server";
import { canAccessDocument, createDocumentGrant, documentCookieName, documentReturnPath, issueDocumentOtp, resolveDocument, verifyDocumentOtp } from "@/lib/documentAccess";
import { sendOtpSms } from "@/lib/africasTalking";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: Promise<{ kind: string; token: string }> }) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { kind, token } = await params;
  const doc = await resolveDocument(kind, token);
  if (!doc) return NextResponse.json({ error: "Document unavailable." }, { status: 404 });
  const body = await req.json().catch(() => null);
  const next = documentReturnPath(doc.kind, token);
  if (await canAccessDocument(doc)) return NextResponse.json({ ok: true, next });
  if (body?.action === "send") {
    try {
      const code = await issueDocumentOtp(doc);
      await sendOtpSms(doc.phone!, code);
      return NextResponse.json({ ok: true, message: "A code was sent to the customer phone saved on this receipt." }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send a code. Please try again.";
      return NextResponse.json({ error: message.startsWith("Please wait") || message.startsWith("No customer") ? message : "Unable to send a code. Please try again or contact Customer Care." }, { status: 429 });
    }
  }
  if (body?.action !== "verify" || !await verifyDocumentOtp(doc, String(body?.code || ""))) return NextResponse.json({ error: "Incorrect or expired code. Request another code if needed." }, { status: 400 });
  const response = NextResponse.json({ ok: true, next }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(documentCookieName(doc), createDocumentGrant(doc), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 86400 });
  return response;
}
