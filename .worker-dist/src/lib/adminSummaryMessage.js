"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAdminSummaryMessage = buildAdminSummaryMessage;
const formatShortDate = (value) => value.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
function buildAdminSummaryMessage(opts) {
    const { summary, start, end } = opts;
    const rangeLabel = `${formatShortDate(start)} - ${formatShortDate(end)}`;
    const formatNumber = (value) => Number(value ?? 0).toLocaleString("en-KE");
    const slot1 = `Daily receipts snapshot (${rangeLabel})`;
    const slot2 = `KES ${formatNumber(summary.totalSales)}`;
    const slot3 = `KES ${formatNumber(summary.totalProfit)}`;
    const slot4 = `${summary.receiptsCount} receipts`;
    const slot5 = `${summary.itemsCount} products sold`;
    const summaryText = `Hello Admin,

Here is the daily receipts summary from the Betech Ops System.

Range: ${rangeLabel}
Total sales: ${slot2}
Total profit: ${slot3}
${slot4}
${slot5}

This is an automated internal notification from Betech Ops.`;
    return {
        rangeLabel,
        slot1,
        slot2,
        slot3,
        slot4,
        slot5,
        summaryText,
    };
}
