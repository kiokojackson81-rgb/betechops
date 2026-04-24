import type { Branding } from "@prisma/client";

import { getCategoryLabel } from "@/lib/getLandingPage";
import type { PayrollRow } from "@/app/admin/payroll/types";
import type { TradingPeriod } from "@/lib/tradingPeriod";

type BrandingLike = Pick<Branding, "letterheadUrl" | "brandColor"> & { siteTitle?: string | null };

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(value);
}

function buildAdjustmentSummary(row: PayrollRow, kind: "ADDITION" | "DEDUCTION") {
  const entries = (row.adjustmentEntries ?? []).filter((entry) => entry.kind === kind);
  if (!entries.length) return "—";
  return entries
    .map((entry) => `${entry.label || entry.adjustmentType}: ${currency.format(Math.abs(Number(entry.amount ?? 0)))}`)
    .join(" · ");
}

function summarizeTotals(rows: PayrollRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.sales += Number(row.totalSales ?? 0);
      acc.base += Number(row.baseSalary ?? 0);
      acc.allowance += Number(row.transportAllowance ?? 0);
      acc.commission += Number(row.commissionTotal ?? row.commission ?? 0);
      acc.additions += Number(row.bonusTotal ?? 0);
      acc.deductions += Number(row.deductionTotal ?? 0);
      acc.netPay += Number(row.netPay ?? 0);
      return acc;
    },
    { sales: 0, base: 0, allowance: 0, commission: 0, additions: 0, deductions: 0, netPay: 0 },
  );
}

export function renderPayrollPrintHtml(args: {
  period: TradingPeriod;
  rows: PayrollRow[];
  branding: BrandingLike;
  generatedAt?: Date;
}) {
  const generatedAt = args.generatedAt ?? new Date();
  const totals = summarizeTotals(args.rows);
  const letterheadBlock = args.branding.letterheadUrl
    ? `<div class="letterhead"><img src="${escapeHtml(args.branding.letterheadUrl)}" alt="Letterhead" /></div>`
    : "";

  const tableRows = args.rows
    .map((row, index) => {
      const additions = buildAdjustmentSummary(row, "ADDITION");
      const deductions = buildAdjustmentSummary(row, "DEDUCTION");
      return `
        <tr>
          <td class="index">${index + 1}</td>
          <td>
            <div class="primary">${escapeHtml(row.name || row.email || "Unassigned")}</div>
            <div class="secondary">${escapeHtml(row.email || "—")}</div>
          </td>
          <td>
            <div class="primary">${escapeHtml(getCategoryLabel(row.attendantCategory))}</div>
            <div class="secondary">${row.isActive ? "Active" : "Inactive"}</div>
          </td>
          <td class="numeric">${escapeHtml(currency.format(Number(row.totalSales ?? 0)))}</td>
          <td class="numeric">${escapeHtml(currency.format(Number(row.baseSalary ?? 0)))}</td>
          <td class="numeric">${escapeHtml(currency.format(Number(row.transportAllowance ?? 0)))}</td>
          <td>
            <div class="primary numeric">${escapeHtml(currency.format(Number(row.commissionTotal ?? row.commission ?? 0)))}</div>
            <div class="secondary">
              POS ${escapeHtml(currency.format(Number(row.commissionDirect ?? 0)))} ·
              Jumia ${escapeHtml(currency.format(Number(row.commissionMarketplaceJumia ?? 0)))} ·
              Kilimall ${escapeHtml(currency.format(Number(row.commissionMarketplaceKilimall ?? 0)))}
            </div>
          </td>
          <td>
            <div class="primary numeric">${escapeHtml(currency.format(Number(row.bonusTotal ?? 0)))}</div>
            <div class="secondary">${escapeHtml(additions)}</div>
          </td>
          <td>
            <div class="primary numeric">${escapeHtml(currency.format(Number(row.deductionTotal ?? 0)))}</div>
            <div class="secondary">${escapeHtml(deductions)}</div>
          </td>
          <td class="numeric strong">${escapeHtml(currency.format(Number(row.netPay ?? 0)))}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(`${args.branding.siteTitle || "BetechOps"} payroll ${args.period.label}`)}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { margin: 0; font-family: Inter, system-ui, -apple-system, sans-serif; color: #0f172a; background: #fff; }
          .page { padding: 0; }
          .letterhead { margin-bottom: 10px; }
          .letterhead img { width: 100%; max-height: 120px; object-fit: contain; object-position: left center; display: block; }
          .topbar { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 14px; }
          .eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: .24em; color: #64748b; margin-bottom: 4px; }
          .title { font-size: 28px; font-weight: 800; color: ${escapeHtml(args.branding.brandColor || "#7A2020")}; line-height: 1.05; }
          .subtitle { font-size: 13px; color: #475569; }
          .meta { text-align: right; font-size: 12px; color: #475569; }
          .summary-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin: 14px 0 16px; }
          .summary-card { border: 1px solid #dbe4ee; border-radius: 14px; padding: 10px 12px; background: #f8fafc; }
          .summary-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: .16em; color: #64748b; margin-bottom: 4px; }
          .summary-card .value { font-size: 18px; font-weight: 800; color: #0f172a; }
          .table-wrap { border: 1px solid #dbe4ee; border-radius: 16px; overflow: hidden; }
          table { width: 100%; border-collapse: collapse; }
          thead { background: #eef2f7; }
          th { padding: 10px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .15em; color: #475569; text-align: left; }
          td { padding: 9px 8px; border-top: 1px solid #e2e8f0; font-size: 12px; vertical-align: top; }
          .index { width: 28px; color: #64748b; }
          .primary { font-weight: 700; color: #0f172a; }
          .secondary { margin-top: 4px; font-size: 10px; line-height: 1.35; color: #64748b; }
          .numeric { text-align: right; white-space: nowrap; }
          .strong { font-weight: 800; color: #0f172a; }
          tfoot td { background: #f8fafc; font-weight: 800; }
          .footer-note { margin-top: 12px; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <main class="page">
          ${letterheadBlock}
          <section class="topbar">
            <div>
              <div class="eyebrow">Payroll summary</div>
              <div class="title">${escapeHtml(args.branding.siteTitle || "BetechOps")}</div>
              <div class="subtitle">${escapeHtml(args.period.label)}</div>
            </div>
            <div class="meta">
              <div><strong>Generated:</strong> ${escapeHtml(formatDate(generatedAt))}</div>
              <div><strong>Staff count:</strong> ${args.rows.length}</div>
            </div>
          </section>

          <section class="summary-grid">
            <div class="summary-card"><div class="label">Sales</div><div class="value">${escapeHtml(currency.format(totals.sales))}</div></div>
            <div class="summary-card"><div class="label">Base salary</div><div class="value">${escapeHtml(currency.format(totals.base))}</div></div>
            <div class="summary-card"><div class="label">Allowance</div><div class="value">${escapeHtml(currency.format(totals.allowance))}</div></div>
            <div class="summary-card"><div class="label">Commission</div><div class="value">${escapeHtml(currency.format(totals.commission))}</div></div>
            <div class="summary-card"><div class="label">Deductions</div><div class="value">${escapeHtml(currency.format(totals.deductions))}</div></div>
            <div class="summary-card"><div class="label">Net pay</div><div class="value">${escapeHtml(currency.format(totals.netPay))}</div></div>
          </section>

          <section class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th class="numeric">Sales</th>
                  <th class="numeric">Salary</th>
                  <th class="numeric">Allowance</th>
                  <th>Commission</th>
                  <th>Additionals / Bonuses</th>
                  <th>Deductions</th>
                  <th class="numeric">Net pay</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
              <tfoot>
                <tr>
                  <td colspan="3">Totals</td>
                  <td class="numeric">${escapeHtml(currency.format(totals.sales))}</td>
                  <td class="numeric">${escapeHtml(currency.format(totals.base))}</td>
                  <td class="numeric">${escapeHtml(currency.format(totals.allowance))}</td>
                  <td class="numeric">${escapeHtml(currency.format(totals.commission))}</td>
                  <td class="numeric">${escapeHtml(currency.format(totals.additions))}</td>
                  <td class="numeric">${escapeHtml(currency.format(totals.deductions))}</td>
                  <td class="numeric">${escapeHtml(currency.format(totals.netPay))}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <div class="footer-note">
            Management overview only. Use the attendant payroll page for detailed appraisal, adjustments, and individual payslip review.
          </div>
        </main>
      </body>
    </html>
  `;
}
