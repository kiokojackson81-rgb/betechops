import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { runAdminSummaryJob } from "@/lib/adminSummaryJob";
import { pushInternalDailySummary } from "@/lib/chatraceInternalFixed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const result = await runAdminSummaryJob({
    sendWhatsApp: false,
    advanceCutoff: false,
    useCutoff: true,
  });
  
  try {
    const { summary, start } = result;
    const summaryDate = start.toISOString().slice(0, 10);
    console.log('[adminSummary][manual] summaryDate=', summaryDate);
    console.log('[adminSummary][manual] payloadText=', result.payload.summaryText);
    const chatrace = await pushInternalDailySummary({
      requestId: `manual-${summaryDate}`,
      dateLabel: summaryDate,
      totalReceipts: String(summary.receiptsCount),
      totalSales: String(summary.totalSales),
      totalProfit: String(summary.totalProfit),
      totalMpesa: String(summary.paymentTotals.mpesa.totalSales),
      totalCash: String(summary.paymentTotals.cash.totalSales),
    });
    console.log('[adminSummary][manual] chatrace result=', chatrace && chatrace.debug ? chatrace.debug : chatrace);
    return NextResponse.json({ ok: true, payload: result.payload, chatrace });
  } catch (e) {
    console.error('[adminSummary][manual] pushInternalDailySummary failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: String(e), payload: result.payload });
  }
}
