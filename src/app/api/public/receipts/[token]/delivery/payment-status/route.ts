import { NextResponse } from "next/server";
import { canAccessDocument, resolveDocument } from "@/lib/documentAccess";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const document = await resolveDocument("receipt", token);
  if (!document || !await canAccessDocument(document)) return NextResponse.json({ error: "This receipt link is not authorised." }, { status: 403 });
  const receipt = await prisma.receipt.findUnique({ where: { id: document.receiptId }, select: { data: true, order: { select: { totalAmount: true, paidAmount: true } } } });
  const data = receipt?.data && typeof receipt.data === "object" && !Array.isArray(receipt.data) ? receipt.data as Record<string, unknown> : {};
  if (!receipt?.order || String(data.customerType || "").toLowerCase() !== "delivery") return NextResponse.json({ error: "Delivery payment record was not found." }, { status: 404 });
  const balance = Math.max(0, Number(receipt.order.totalAmount) - Number(receipt.order.paidAmount));
  return NextResponse.json({ balance: Math.round(balance * 100) / 100, paid: Number(receipt.order.paidAmount) }, { headers: { "Cache-Control": "no-store" } });
}
