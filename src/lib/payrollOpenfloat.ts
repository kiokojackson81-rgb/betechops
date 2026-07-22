import * as XLSX from "xlsx";

import { prisma } from "@/lib/prisma";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import { payrollEligibleUserWhere } from "@/lib/payrollEligibility";
import type { TradingPeriod } from "@/lib/tradingPeriod";
import {
  OPENFLOAT_ALLOWED_TYPES,
  OPENFLOAT_HEADERS,
  buildOpenfloatReviewRow,
  type OpenfloatReviewRow,
} from "@/lib/payrollOpenfloatShared";

export async function buildOpenfloatReviewRows(period: TradingPeriod) {
  const attendants = await prisma.user.findMany({
    where: payrollEligibleUserWhere(),
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      attendantCategory: true,
      isActive: true,
      bankName: true,
      bankAccountNumber: true,
      payoutMethod: true,
      payoutAccountName: true,
      mobileMoneyPhoneNumber: true,
      tillPaybillNumber: true,
      tillPaybillBusinessName: true,
      paybillAccountNumber: true,
      notificationPhoneNumber: true,
    },
  });

  const rows = await Promise.all(
    attendants.map(async (attendant) => {
      const payrollRow = await applyCanonicalPayrollOverrides(await buildPayrollRow(attendant, period), period);
      return buildOpenfloatReviewRow(attendant, payrollRow.netPay, period);
    }),
  );

  return rows;
}

export function buildOpenfloatWorkbook(rows: OpenfloatReviewRow[]) {
  const workbook = XLSX.utils.book_new();
  const accountRows = [
    [...OPENFLOAT_HEADERS],
    ...rows.map((row) => [
      row.accountType,
      row.accountName,
      row.accountNumber,
      row.tillOrPaybillNumber,
      row.tillOrPaybillBusinessName,
      row.notificationPhoneNumber,
      row.amount,
      row.remark,
    ]),
  ];
  const accountsSheet = XLSX.utils.aoa_to_sheet(accountRows);
  const typesSheet = XLSX.utils.aoa_to_sheet(OPENFLOAT_ALLOWED_TYPES.map((value) => [value]));
  XLSX.utils.book_append_sheet(workbook, accountsSheet, "Accounts");
  XLSX.utils.book_append_sheet(workbook, typesSheet, "Allowed Types");
  return workbook;
}

export function workbookToBuffer(workbook: XLSX.WorkBook) {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function renderOpenfloatReviewHtml(input: { period: TradingPeriod; rows: OpenfloatReviewRow[] }) {
  const { period, rows } = input;
  const totals = rows.reduce(
    (acc, row) => {
      acc.totalAmount += row.amount;
      acc.validCount += row.isValid ? 1 : 0;
      acc.invalidCount += row.isValid ? 0 : 1;
      return acc;
    },
    { totalAmount: 0, validCount: 0, invalidCount: 0 },
  );

  const bodyRows = rows
    .map((row) => {
      const issues = row.validationErrors.length ? row.validationErrors.join("; ") : "Ready";
      return `
        <tr class="${row.isValid ? "ok" : "bad"}">
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.accountType || "Missing")}</td>
          <td>${escapeHtml(row.accountName)}</td>
          <td>${escapeHtml(row.accountNumber)}</td>
          <td>${escapeHtml(row.tillOrPaybillNumber)}</td>
          <td>${escapeHtml(row.tillOrPaybillBusinessName)}</td>
          <td>${escapeHtml(row.notificationPhoneNumber)}</td>
          <td class="num">${formatAmount(row.amount)}</td>
          <td>${escapeHtml(issues)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Openfloat payout review ${escapeHtml(period.key)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
        h1 { margin: 0 0 8px; font-size: 24px; }
        p { margin: 0 0 8px; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
        .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; background: #f8fafc; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; text-align: left; }
        th { background: #e2e8f0; }
        .num { text-align: right; }
        .ok { background: #f0fdf4; }
        .bad { background: #fff1f2; }
      </style>
    </head>
    <body>
      <h1>Openfloat payroll payout review</h1>
      <p>Period: ${escapeHtml(period.label)}</p>
      <div class="summary">
        <div class="card"><strong>Total amount</strong><br />KES ${formatAmount(totals.totalAmount)}</div>
        <div class="card"><strong>Ready rows</strong><br />${totals.validCount}</div>
        <div class="card"><strong>Rows with issues</strong><br />${totals.invalidCount}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Type</th>
            <th>Account name</th>
            <th>Account no.</th>
            <th>Till / Paybill no.</th>
            <th>Business name</th>
            <th>Notification phone</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </body>
  </html>`;
}

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
