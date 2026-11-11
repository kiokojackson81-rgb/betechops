import { NextResponse } from "next/server";
import { canAccessDocument, resolveDocument } from "@/lib/documentAccess";
import { prisma } from "@/lib/prisma";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const document = await resolveDocument("receipt", token);
  if (!document || !await canAccessDocument(document)) return NextResponse.json({ error: "This receipt link is not authorised." }, { status: 403 });
  const receipt = await prisma.receipt.findUnique({ where: { id: document.receiptId }, select: { data: true, order: { select: { totalAmount: true, paidAmount: true } } } });
  if (!receipt?.order || !readReceiptProjectFlow((receipt.data as Record<string, unknown> | null)?.projectFlow)) return NextResponse.json({ error: "Project payment record was not found." }, { status: 404 });
  const balance = Math.max(0, Number(receipt.order.totalAmount) - Number(receipt.order.paidAmount));
  return NextResponse.json({ balance: Math.round(balance * 100) / 100, paid: Number(receipt.order.paidAmount) }, { headers: { "Cache-Control": "no-store" } });
}
