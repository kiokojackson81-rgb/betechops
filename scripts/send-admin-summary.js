process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || "tsconfig.node.json";
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const { runAdminSummaryJob } = require("../src/lib/adminSummaryJob");
const { pushInternalDailySummary } = require("../src/lib/chatraceInternalFixed");

async function main() {
  const result = await runAdminSummaryJob();
  console.log('[send-admin-summary] summaryText=');
  console.log(result.payload.summaryText);

  try {
    const { summary, start, payload } = result;
    const summaryDate = start.toISOString().slice(0, 10);
    const chatrace = await pushInternalDailySummary({
      requestId: `cli-daily-${summaryDate}`,
      dateLabel: summaryDate,
      totalReceipts: String(summary.receiptsCount),
      totalSales: String(summary.totalSales),
      totalProfit: String(summary.totalProfit),
      totalMpesa: String(summary.paymentTotals.mpesa.totalSales),
      totalCash: String(summary.paymentTotals.cash.totalSales),
    });
    console.log('[send-admin-summary] chatrace result=', chatrace && chatrace.debug ? chatrace.debug : chatrace);
  } catch (e) {
    console.error('[send-admin-summary] pushInternalDailySummary failed', e instanceof Error ? e.message : e);
  }
}

main().catch((error) => {
  console.error("Failed to send admin summary", error);
  process.exit(1);
});
