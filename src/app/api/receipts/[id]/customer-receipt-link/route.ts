import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getPublicReceiptDocumentsUrl } from "@/lib/publicReceiptLinks";

export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ id: string }> };

/** Returns the same customer-facing receipt URL included in SMS and WhatsApp updates. */
export async function POST(_request: Request, { params }: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const receiptId = String(id || "").trim();
  if (!receiptId) return NextResponse.json({ error: "missing_receipt_id" }, { status: 400 });

  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    select: { id: true },
  });
  if (!receipt) return NextResponse.json({ error: "receipt_not_found" }, { status: 404 });

  const url = await getPublicReceiptDocumentsUrl(receipt.id);
  return NextResponse.json({ ok: true, url });
}
