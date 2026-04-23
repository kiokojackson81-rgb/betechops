import type { Branding } from "@prisma/client";
import { getCategoryLabel } from "@/lib/getLandingPage";
import type { TradingPeriod } from "@/lib/tradingPeriod";
import type { PayrollRow } from "@/app/admin/payroll/types";

type BrandingLike = Pick<Branding, "letterheadUrl" | "logoUrl" | "brandColor"> & { siteTitle?: string | null };

type AttendantLike = {
  id: string;
  name?: string | null;
  email?: string | null;
  attendantCategory?: string | null;
  isActive: boolean;
};

export type PayslipPayload = {
  siteTitle: string;
  letterheadUrl: string | null;
  brandColor: string;
  payslipNo: string;
  generatedAt: Date;
  periodLabel: string;
  attendantName: string;
  attendantEmail: string;
  categoryLabel: string;
  statusLabel: string;
  workSummary: Array<{ label: string; value: string }>;
  earningsLines: Array<{ label: string; amount: number }>;
  deductionLines: Array<{ label: string; amount: number }>;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
};

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

export function sanitizeFilename(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

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

function payslipNumber(attendantId: string, periodKey: string) {
  return `PS-${periodKey.replace(/[^0-9A-Za-z]/g, "")}-${attendantId.slice(-6).toUpperCase()}`;
}

function buildCommissionLines(row: PayrollRow) {
  switch (row.attendantCategory) {
    case "DIRECT_SALES_OPS":
      return [{ label: "Direct sales commission", amount: row.commissionDirect || row.commissionTotal }];
    case "MARKETING_OPS":
      return [{ label: "Marketing commission", amount: row.commissionDirect || row.commissionTotal }];
    case "JUMIA_KILIMALL_OPS":
      return [
        { label: "Direct POS commission", amount: row.commissionDirect },
        { label: "Jumia commission", amount: row.commissionMarketplaceJumia },
        { label: "Kilimall commission", amount: row.commissionMarketplaceKilimall },
      ];
    case "SUPPORT_OPS":
      return [{ label: "Support commission", amount: row.commissionDirect || row.commissionTotal }];
    case "BETECH_OPS":
      return [
        { label: "Direct commission", amount: row.commissionDirect },
        { label: "Jumia commission", amount: row.commissionMarketplaceJumia },
        { label: "Kilimall commission", amount: row.commissionMarketplaceKilimall },
      ];
    default:
      return [{ label: "Commission", amount: row.commissionTotal }];
  }
}

function buildWorkSummary(row: PayrollRow) {
  switch (row.attendantCategory) {
    case "DIRECT_SALES_OPS":
      return [
        { label: "Sales", value: currency.format(row.totalSales) },
        { label: "Receipts", value: row.totalReceipts.toLocaleString("en-US") },
        { label: "Items sold", value: row.totalItems.toLocaleString("en-US") },
      ];
    case "MARKETING_OPS":
      return [
        { label: "Sales", value: currency.format(row.totalSales) },
        { label: "Receipts / rows", value: row.totalReceipts.toLocaleString("en-US") },
        { label: "Items handled", value: row.totalItems.toLocaleString("en-US") },
      ];
    case "JUMIA_KILIMALL_OPS":
      return [
        { label: "Sales", value: currency.format(row.totalSales) },
        { label: "POS receipts", value: row.totalReceipts.toLocaleString("en-US") },
        { label: "Items handled", value: row.totalItems.toLocaleString("en-US") },
      ];
    case "SUPPORT_OPS":
      return [
        { label: "Sales", value: currency.format(row.totalSales) },
        { label: "Receipts", value: row.totalReceipts.toLocaleString("en-US") },
        { label: "Items handled", value: row.totalItems.toLocaleString("en-US") },
      ];
    case "BETECH_OPS":
      return [
        { label: "Total sales", value: currency.format(row.totalSales) },
        { label: "Direct receipts", value: row.totalReceipts.toLocaleString("en-US") },
        { label: "Items handled", value: row.totalItems.toLocaleString("en-US") },
      ];
    default:
      return [
        { label: "Sales", value: currency.format(row.totalSales) },
        { label: "Records", value: row.totalReceipts.toLocaleString("en-US") },
        { label: "Items", value: row.totalItems.toLocaleString("en-US") },
      ];
  }
}

export function buildPayslipPayload(args: {
  attendant: AttendantLike;
  row: PayrollRow;
  period: TradingPeriod;
  branding: BrandingLike;
  generatedAt?: Date;
}): PayslipPayload {
  const generatedAt = args.generatedAt ?? new Date();
  const commissionLines = buildCommissionLines(args.row);

  return {
    siteTitle: args.branding.siteTitle || "BetechOps",
    letterheadUrl: typeof args.branding.letterheadUrl === "string" ? args.branding.letterheadUrl : null,
    brandColor: args.branding.brandColor || "#7A2020",
    payslipNo: payslipNumber(args.attendant.id, args.period.key),
    generatedAt,
    periodLabel: args.period.label,
    attendantName: args.attendant.name || args.attendant.email || args.attendant.id,
    attendantEmail: args.attendant.email || "-",
    categoryLabel: getCategoryLabel(args.attendant.attendantCategory),
    statusLabel: args.attendant.isActive ? "Active" : "Inactive",
    workSummary: buildWorkSummary(args.row),
    earningsLines: [
      { label: "Base salary", amount: args.row.baseSalary },
      { label: "Transport allowance", amount: args.row.transportAllowance },
      ...commissionLines,
      { label: "Bonus", amount: args.row.adjustmentBreakdown.bonus },
      { label: "Top-up", amount: args.row.adjustmentBreakdown.commissionTopUp },
    ],
    deductionLines: [
      { label: "Chama", amount: args.row.adjustmentBreakdown.chama },
      { label: "Lateness", amount: args.row.adjustmentBreakdown.lateness },
      { label: "Discipline", amount: args.row.adjustmentBreakdown.discipline },
      { label: "Other deductions", amount: args.row.adjustmentBreakdown.other },
      { label: "Penalties", amount: args.row.adjustmentBreakdown.penalties },
    ],
    totalEarnings: args.row.totalEarnings,
    totalDeductions: args.row.totalDeductions,
    netPay: args.row.netPay,
  };
}

export function renderPayslipDocumentHtml(args: { slips: PayslipPayload[]; documentTitle: string }) {
  const pagesHtml = args.slips
    .map((slip) => {
      const letterheadBlock = slip.letterheadUrl
        ? `<div class="letterhead"><img src="${escapeHtml(slip.letterheadUrl)}" alt="Letterhead" /></div>`
        : "";
      const workSummaryHtml = slip.workSummary
        .map(
          (line) => `
            <div class="metric">
              <div class="label">${escapeHtml(line.label)}</div>
              <div class="value">${escapeHtml(line.value)}</div>
            </div>`,
        )
        .join("");
      const earningsRows = slip.earningsLines
        .map(
          (line) => `
            <tr>
              <td>${escapeHtml(line.label)}</td>
              <td class="amount">${currency.format(line.amount)}</td>
            </tr>`,
        )
        .join("");
      const deductionRows = slip.deductionLines
        .map(
          (line) => `
            <tr>
              <td>${escapeHtml(line.label)}</td>
              <td class="amount">${currency.format(line.amount)}</td>
            </tr>`,
        )
        .join("");

      return `
        <section class="payslip-page">
          ${letterheadBlock}
          <div class="accent-bar" style="background:${escapeHtml(slip.brandColor)}"></div>
          <div class="topline">
            <div>
              <div class="eyebrow">Payroll payslip</div>
              <div class="title" style="color:${escapeHtml(slip.brandColor)}">${escapeHtml(slip.siteTitle)}</div>
              <div class="subtitle">${escapeHtml(slip.periodLabel)}</div>
            </div>
            <div style="text-align:right">
              <div class="badge" style="border-color:${escapeHtml(slip.brandColor)}33;background:${escapeHtml(slip.brandColor)}11;color:${escapeHtml(slip.brandColor)}">Payslip</div>
              <div class="subtitle" style="margin-top:8px">No: ${escapeHtml(slip.payslipNo)}</div>
              <div class="subtitle">Generated: ${escapeHtml(formatDate(slip.generatedAt))}</div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">Employee details</div>
            <div class="details">
              <div class="detail"><div class="label">Name</div><div class="value">${escapeHtml(slip.attendantName)}</div></div>
              <div class="detail"><div class="label">Email</div><div class="value">${escapeHtml(slip.attendantEmail)}</div></div>
              <div class="detail"><div class="label">Category</div><div class="value">${escapeHtml(slip.categoryLabel)}</div></div>
              <div class="detail"><div class="label">Status</div><div class="value">${escapeHtml(slip.statusLabel)}</div></div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">Work summary</div>
            <div class="metrics">${workSummaryHtml}</div>
          </div>

          <div class="split">
            <div class="panel">
              <div class="panel-title">Earnings</div>
              <table>
                <tbody>
                  ${earningsRows}
                  <tr class="total" style="color:${escapeHtml(slip.brandColor)}">
                    <td>Gross earnings</td>
                    <td class="amount">${currency.format(slip.totalEarnings)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="panel">
              <div class="panel-title">Deductions</div>
              <table>
                <tbody>
                  ${deductionRows}
                  <tr class="total" style="color:${escapeHtml(slip.brandColor)}">
                    <td>Total deductions</td>
                    <td class="amount">${currency.format(slip.totalDeductions)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="net" style="background:linear-gradient(135deg, ${escapeHtml(slip.brandColor)} 0%, #0f172a 100%)">
            <div>
              <div class="label">Net pay</div>
              <div style="font-size:13px; opacity:.85;">Amount payable for this payroll period</div>
            </div>
            <div class="value">${currency.format(slip.netPay)}</div>
          </div>

          <div class="footer">
            <div class="sign">Prepared by: ____________________</div>
            <div class="sign">Approved by: ____________________</div>
            <div class="sign">Employee sign: ____________________</div>
          </div>
        </section>`;
    })
    .join("");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(args.documentTitle)}</title>
        <style>
          @page { size: A5 portrait; margin: 7mm 7mm 8mm; }
          body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; background: #fff; }
          .payslip-page { page-break-after: always; break-after: page; padding: 0; }
          .payslip-page:last-child { page-break-after: auto; break-after: auto; }
          .letterhead { margin-bottom: 4mm; }
          .letterhead img { display: block; width: 100%; max-height: 34mm; object-fit: contain; object-position: left center; }
          .accent-bar { height: 2.2mm; border-radius: 999px; margin: 0 0 4mm; }
          .topline { display: flex; justify-content: space-between; gap: 8mm; margin-bottom: 4mm; align-items: flex-start; }
          .eyebrow { font-size: 8px; text-transform: uppercase; letter-spacing: .22em; color: #64748b; margin-bottom: 1mm; }
          .title { font-size: 17px; font-weight: 800; letter-spacing: 0.02em; line-height: 1.05; }
          .subtitle { font-size: 9px; color: #475569; line-height: 1.35; }
          .badge { display: inline-block; border: 1px solid; border-radius: 999px; padding: 4px 8px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; }
          .panel { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 9px; margin-bottom: 4mm; background: #ffffff; box-sizing: border-box; }
          .panel-title { font-size: 8px; text-transform: uppercase; letter-spacing: .18em; color: #64748b; margin-bottom: 6px; font-weight: 700; }
          .details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px; font-size: 9px; }
          .detail .label { color: #64748b; margin-bottom: 1px; }
          .detail .value { font-weight: 700; line-height: 1.3; }
          .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
          .metric { border-radius: 9px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 7px; box-sizing: border-box; }
          .metric .label { font-size: 7px; text-transform: uppercase; letter-spacing: .11em; color: #64748b; margin-bottom: 3px; line-height: 1.25; }
          .metric .value { font-size: 12px; font-weight: 800; color: #0f172a; line-height: 1.15; word-break: break-word; }
          .split { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          td { padding: 5px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          td.amount { text-align: right; font-weight: 700; }
          tr.total td { font-weight: 800; }
          .net { border-radius: 12px; padding: 10px 12px; color: #fff; display: flex; justify-content: space-between; align-items: center; margin-top: 2mm; }
          .net .label { font-size: 8px; text-transform: uppercase; letter-spacing: .18em; opacity: .8; }
          .net .value { font-size: 22px; font-weight: 900; line-height: 1; }
          .net-note { font-size: 8px; opacity: .85; line-height: 1.35; }
          .footer { margin-top: 4mm; font-size: 8px; color: #64748b; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
          .sign { border-top: 1px solid #cbd5e1; padding-top: 5px; margin-top: 8px; }
        </style>
      </head>
      <body>${pagesHtml}</body>
    </html>`;
}
