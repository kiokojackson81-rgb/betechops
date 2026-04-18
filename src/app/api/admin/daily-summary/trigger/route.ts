import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { getNairobiSummaryDateLabel, runAdminSummaryJob } from "@/lib/adminSummaryJob";
import { pushInternalDailySummary } from "@/lib/chatraceInternalFixed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const result = await runAdminSummaryJob({
    sendWhatsApp: false,
    advanceCutoff: false,
    useCutoff: false,
    rangeMode: "today",
  });
  
  try {
    const { summary, end } = result;
    const summaryDate = getNairobiSummaryDateLabel(end);
    console.log('[adminSummary][manual] summaryDate=', summaryDate);
    console.log('[adminSummary][manual] payloadText=', result.payload.summaryText);
    const chatrace = await pushInternalDailySummary({
      requestId: `manual-${summaryDate}`,
      dateLabel: summaryDate,
      totalReceipts: summary.receiptsCount,
      totalSales: summary.totalSales,
      totalProfit: summary.totalProfit,
      totalMpesa: summary.paymentTotals.mpesa.totalSales,
      totalCash: summary.paymentTotals.cash.totalSales,
      totalItems: summary.itemsCount,
      awaitingPricingCount: summary.awaitingPricingCount,
      mpesaReceipts: summary.paymentTotals.mpesa.count,
      cashReceipts: summary.paymentTotals.cash.count,
      posReceipts: summary.posReceiptsCount,
      posSales: summary.posTotalSales,
    });
    console.log('[adminSummary][manual] chatrace result=', chatrace && chatrace.debug ? chatrace.debug : chatrace);
    return NextResponse.json({
      ok: true,
      payload: result.payload,
      chatrace,
      slot2: result.payload.slot2,
      slot3: result.payload.slot3,
      slot4: result.payload.slot4,
    });
  } catch (e) {
    console.error('[adminSummary][manual] pushInternalDailySummary failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: String(e), payload: result.payload });
  }
}
