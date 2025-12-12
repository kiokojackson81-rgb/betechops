import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Debugging route for admin receipts summary discrepancies.
// Query params: start=ISO, end=ISO, attendantId (optional)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const attendantId = url.searchParams.get("attendantId");

    if (!start || !end) {
      return NextResponse.json({ error: "start and end query parameters are required" }, { status: 400 });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // receipts captured in main receipts table
    const receipts = await prisma.receipt.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(attendantId ? { attendantId } : {}),
      },
      orderBy: { createdAt: "asc" },
    });

    // marketing receipts (if present in schema)
    let marketing: any[] = [];
    try {
      // some deployments may not have marketingReceipt model; guard
      // @ts-ignore
      marketing = await prisma.marketingReceipt.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          ...(attendantId ? { attendantId } : {}),
        },
      });
    } catch (err) {
      marketing = [];
    }

    // support receipts (if present)
    let support: any[] = [];
    try {
      // @ts-ignore
      support = await prisma.supportReceipt.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          ...(attendantId ? { attendantId } : {}),
        },
      });
    } catch (err) {
      support = [];
    }

    // combine and dedupe by receiptNumber like the admin summary does
    const combined = [...marketing, ...support];
    const seen = new Set<string>();
    const dedupedCombined = combined.filter((r) => {
      const key = String(r.receiptNumber ?? r.receipt_number ?? r.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const receiptTotal = receipts.reduce(
      (s, r) => s + Number((r as any)?.totals?.total ?? (r as any)?.order?.totalAmount ?? 0),
      0,
    );
    const dedupedTotal = dedupedCombined.reduce((s, r) => s + Number(r.sellingTotal ?? r.total ?? 0), 0);

    return NextResponse.json({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      attendantId: attendantId ?? null,
      receiptsCount: receipts.length,
      receiptsTotal: receiptTotal,
      receipts: receipts.map((r) => ({
        id: r.id,
        receiptNumber: (r as any)?.order?.orderNumber ?? r.orderId,
        sellingTotal: (r as any)?.totals?.total ?? (r as any)?.order?.totalAmount ?? 0,
        createdAt: r.createdAt,
      })),
      marketingCount: marketing.length,
      supportCount: support.length,
      dedupedCombinedCount: dedupedCombined.length,
      dedupedCombinedTotal: dedupedTotal,
      dedupedCombined: dedupedCombined.map((r) => ({ id: r.id, receiptNumber: r.receiptNumber ?? r.receipt_number, sellingTotal: r.sellingTotal ?? r.total, createdAt: r.createdAt })),
    });
  } catch (err) {
    console.error("[admin/receipts/summary/debug] error", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
