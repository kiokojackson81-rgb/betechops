import { NextResponse } from "next/server";

import { pushInternalDailySummary } from "@/lib/chatraceInternalFixed";
import { runAdminSummaryJob } from "@/lib/adminSummaryJob";

export async function GET() {
  const result = await runAdminSummaryJob();
  const { summary, start, payload } = result;
  const summaryDate = start.toISOString().slice(0, 10);

  console.log('[adminSummary][cron] summaryDate=', summaryDate);
  console.log('[adminSummary][cron] payloadText=', payload.summaryText);

  let chatrace: any = null;
  try {
    chatrace = await pushInternalDailySummary({
    requestId: `daily-${summaryDate}`,
    dateLabel: summaryDate,
    totalReceipts: String(summary.receiptsCount),
    totalSales: String(summary.totalSales),
    totalProfit: String(summary.totalProfit),
    totalMpesa: String(summary.paymentTotals.mpesa.totalSales),
    totalCash: String(summary.paymentTotals.cash.totalSales),
  });
  } catch (e) {
    console.error('[adminSummary][cron] pushInternalDailySummary failed', e instanceof Error ? e.message : e);
  }

  console.log('[adminSummary][cron] chatrace result=', chatrace && chatrace.debug ? chatrace.debug : chatrace);

  return NextResponse.json({
    ok: true,
    summaryDate,
    summary,
    payload,
    chatrace,
  });
}
