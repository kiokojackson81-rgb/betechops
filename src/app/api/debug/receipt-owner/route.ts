import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReceiptKey } from "@/lib/receiptKey";
import findReceiptOwner from "@/lib/receipts/findReceiptOwner";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const receiptNumber = url.searchParams.get("receiptNumber") || url.searchParams.get("receipt") || "";
    if (!receiptNumber) return NextResponse.json({ error: "receiptNumber query param required" }, { status: 400 });

    const receiptKey = buildReceiptKey(receiptNumber);
    if (!receiptKey) return NextResponse.json({ error: "invalid receiptNumber" }, { status: 400 });

    // query all matching rows
    const rows: any = { pos: [], marketing: [], support: [] };

    // POS: try orders + receipts
    try {
      if ((prisma as any).order) {
        const orders = await (prisma as any).order.findMany({ where: { orderNumber: receiptKey }, include: { receipt: true } });
        for (const o of orders) {
          rows.pos.push({ id: o.id, orderNumber: o.orderNumber, receipt: o.receipt ?? null, attendantId: o.attendantId ?? null, createdAt: o.createdAt });
        }
      }
    } catch (err) {
      // ignore
    }

    // Marketing receipts
    try {
      if ((prisma as any).marketingReceipt) {
        const m = await (prisma as any).marketingReceipt.findMany({ where: { OR: [{ receiptKey }, { receiptNumber: receiptKey }] }, include: { dailyEntry: true } });
        for (const r of m) rows.marketing.push({ id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, sellingTotal: r.sellingTotal, paymentMethod: r.paymentMethod, createdAt: r.createdAt, submittedById: r.dailyEntry?.submittedById ?? null, dailyEntryId: r.dailyEntryId });
      }
    } catch (err) {}

    // Support receipts
    try {
      if ((prisma as any).supportReceipt) {
        const s = await (prisma as any).supportReceipt.findMany({ where: { OR: [{ receiptKey }, { receiptNumber: receiptKey }] }, include: { dailyEntry: true } });
        for (const r of s) rows.support.push({ id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, sellingTotal: r.sellingTotal, paymentMethod: r.paymentMethod, createdAt: r.createdAt, submittedById: r.dailyEntry?.submittedById ?? null, dailyEntryId: r.dailyEntryId });
      }
    } catch (err) {}

    const owner = await findReceiptOwner(prisma, receiptKey);

    return NextResponse.json({ receiptNumber, receiptKey, owner, rows }, { status: 200 });
  } catch (err) {
    console.error("[debug/receipt-owner]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
