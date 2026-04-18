import { AdminReceiptSummary } from "./adminReceiptsSummary";

const formatShortDate = (value: Date) =>
  value.toLocaleDateString("en-KE", { day: "numeric", month: "short" });

export function buildAdminSummaryMessage(opts: {
  summary: AdminReceiptSummary;
  start: Date;
  end: Date;
}) {
  const { summary, start, end } = opts;
  const rangeLabel = `${formatShortDate(start)} - ${formatShortDate(end)}`;
  const formatNumber = (value: number | undefined) =>
    Number(value ?? 0).toLocaleString("en-KE");

  const slot1 = `Daily receipts snapshot (${rangeLabel})`;
  const slot2 = `KES ${formatNumber(summary.totalSales)}`;
  const slot3 = `KES ${formatNumber(summary.totalProfit)}`;
  const slot4 = `${summary.receiptsCount} receipts`;
  const slot5 = `${summary.itemsCount} products sold`;
  const slot6 = `${summary.posReceiptsCount} POS receipts`;
  const slot7 = `KES ${formatNumber(summary.posTotalSales)}`;
  const summaryText = `Hello Admin,

Here is the daily receipts summary from the Betech Ops System.

Range: ${rangeLabel}
Total sales: ${slot2}
Total profit: ${slot3}
${slot4}
${slot5}
POS receipts: ${slot6}
POS amount: ${slot7}

This is an automated internal notification from Betech Ops.`;

  return {
    rangeLabel,
    slot1,
    slot2,
    slot3,
    slot4,
    slot5,
    slot6,
    slot7,
    summaryText,
  };
}
