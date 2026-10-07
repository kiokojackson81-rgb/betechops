import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { createDocumentGrant, documentCookieName, resolveDocument } from "@/lib/documentAccess";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let guard;
  try {
    guard = await requireAttendant(request as unknown as Request);
  } catch (response) {
    return response instanceof NextResponse ? response : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = String(guard?.user?.role || "").toUpperCase();
  if (!['ADMIN', 'SUPERVISOR'].includes(role)) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({ where: { id }, select: { data: true } });
  const data = receipt?.data && typeof receipt.data === "object" && !Array.isArray(receipt.data) ? receipt.data as Record<string, unknown> : null;
  const token = typeof data?.publicReceiptToken === "string" ? data.publicReceiptToken.trim() : "";
  if (!token) return NextResponse.json({ error: "This receipt does not have a customer link yet." }, { status: 404 });
  const document = await resolveDocument("receipt", token);
  if (!document) return NextResponse.json({ error: "Customer receipt is unavailable." }, { status: 404 });
  const response = NextResponse.redirect(new URL(`/r/${encodeURIComponent(token)}/view`, request.url));
  response.cookies.set(documentCookieName(document), createDocumentGrant(document), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 86400 });
  return response;
}
