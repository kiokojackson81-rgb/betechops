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
