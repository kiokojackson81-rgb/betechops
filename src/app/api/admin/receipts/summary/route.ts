import { NextRequest, NextResponse } from "next/server";
import { computeAdminReceiptSummary, normalizePaymentMethod } from "@/lib/adminReceiptsSummary";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { parseDateParam } from "@/lib/dateRange";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const attendantId = url.searchParams.get("attendantId") || undefined;
  const period = getTradingPeriodFor(new Date());
  const start = parseDateParam(url.searchParams.get("start"), period.start);
  const end = parseDateParam(url.searchParams.get("end"), period.end, true);
  const paymentMethod = normalizePaymentMethod(url.searchParams.get("paymentMethod"));

  try {
    const summary = await computeAdminReceiptSummary({ start, end, attendantId, paymentMethod });
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[admin/receipts/summary] failed to load summary", error);
    return NextResponse.json({ error: "Failed to compute receipt summary" }, { status: 500 });
  }
}
