import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAttendant(request, ["ADMIN", "SUPERVISOR", "ATTENDANT", "TECHNICAL_TEAM"]);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({ where: { id }, select: { id: true, commissioningSession: { select: { status: true } }, warrantyCertificates: { where: { status: "ISSUED" }, take: 1, select: { id: true } } } });
  if (!receipt) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const base = `/api/receipts/${encodeURIComponent(id)}`;
  return NextResponse.json({ documents: [{ label: "Receipt", url: `${base}/pdf?download=1` }, ...(receipt.commissioningSession?.status === "ISSUED" ? [{ label: "Certificate of Completion", url: `${base}/commissioning/certificate` }] : []), ...(receipt.warrantyCertificates.length ? [{ label: "Warranty Certificate", url: `${base}/warranty/download` }] : [])] }, { headers: { "Cache-Control": "private, no-store" } });
}
