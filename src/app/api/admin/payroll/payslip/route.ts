import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { getBranding } from "@/lib/branding";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { parseTradingPeriodKey, getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { getCategoryLabel } from "@/lib/getLandingPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

function sanitizeFilename(value: string) {
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

function buildCommissionLines(row: Awaited<ReturnType<typeof buildPayrollRow>>) {
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

function buildWorkSummary(row: Awaited<ReturnType<typeof buildPayrollRow>>) {
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

function renderPayslipHtml(args: {
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
}) {
  const letterheadBlock = args.letterheadUrl
    ? `<div class="letterhead"><img src="${escapeHtml(args.letterheadUrl)}" alt="Letterhead" /></div>`
    : "";

  const workSummaryHtml = args.workSummary
    .map(
      (line) => `
        <div class="metric">
          <div class="label">${escapeHtml(line.label)}</div>
          <div class="value">${escapeHtml(line.value)}</div>
        </div>`,
    )
    .join("");

  const earningsRows = args.earningsLines
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.label)}</td>
          <td class="amount">${currency.format(line.amount)}</td>
        </tr>`,
    )
    .join("");

  const deductionRows = args.deductionLines
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.label)}</td>
          <td class="amount">${currency.format(line.amount)}</td>
        </tr>`,
    )
    .join("");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(`${args.attendantName} Payslip ${args.periodLabel}`)}</title>
        <style>
          @page { size: A4; margin: 16mm 14mm 16mm; }
          body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #0f172a; }
          .letterhead { margin-bottom: 12px; }
          .letterhead img { width: 100%; max-height: 124px; object-fit: contain; object-position: left center; }
          .topline { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
          .title { font-size: 26px; font-weight: 800; color: ${escapeHtml(args.brandColor)}; letter-spacing: 0.03em; }
          .subtitle { font-size: 12px; color: #475569; }
          .badge { display: inline-block; border: 1px solid ${escapeHtml(args.brandColor)}33; background: ${escapeHtml(args.brandColor)}11; color: ${escapeHtml(args.brandColor)}; border-radius: 999px; padding: 6px 10px; font-size: 11px; font-weight: 700; }
          .panel { border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; margin-bottom: 14px; background: #ffffff; }
          .panel-title { font-size: 11px; text-transform: uppercase; letter-spacing: .18em; color: #64748b; margin-bottom: 10px; font-weight: 700; }
          .details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; font-size: 12px; }
          .detail .label { color: #64748b; margin-bottom: 2px; }
          .detail .value { font-weight: 700; }
          .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
          .metric { border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; }
          .metric .label { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #64748b; margin-bottom: 4px; }
          .metric .value { font-size: 18px; font-weight: 800; color: #0f172a; }
          .split { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          td { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          td.amount { text-align: right; font-weight: 700; }
          tr.total td { font-weight: 800; color: ${escapeHtml(args.brandColor)}; }
          .net { border-radius: 18px; padding: 18px; background: linear-gradient(135deg, ${escapeHtml(args.brandColor)} 0%, #0f172a 100%); color: #fff; display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
          .net .label { font-size: 11px; text-transform: uppercase; letter-spacing: .2em; opacity: .8; }
          .net .value { font-size: 34px; font-weight: 900; }
          .footer { margin-top: 16px; font-size: 11px; color: #64748b; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
          .sign { border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 26px; }
        </style>
      </head>
      <body>
        ${letterheadBlock}
        <div class="topline">
          <div>
            <div class="title">${escapeHtml(args.siteTitle)}</div>
            <div class="subtitle">Payroll payslip for ${escapeHtml(args.periodLabel)}</div>
          </div>
          <div style="text-align:right">
            <div class="badge">Payslip</div>
            <div class="subtitle" style="margin-top:8px">No: ${escapeHtml(args.payslipNo)}</div>
            <div class="subtitle">Generated: ${escapeHtml(formatDate(args.generatedAt))}</div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Employee details</div>
          <div class="details">
            <div class="detail"><div class="label">Name</div><div class="value">${escapeHtml(args.attendantName)}</div></div>
            <div class="detail"><div class="label">Email</div><div class="value">${escapeHtml(args.attendantEmail)}</div></div>
            <div class="detail"><div class="label">Category</div><div class="value">${escapeHtml(args.categoryLabel)}</div></div>
            <div class="detail"><div class="label">Status</div><div class="value">${escapeHtml(args.statusLabel)}</div></div>
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
                <tr class="total">
                  <td>Gross earnings</td>
                  <td class="amount">${currency.format(args.totalEarnings)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="panel">
            <div class="panel-title">Deductions</div>
            <table>
              <tbody>
                ${deductionRows}
                <tr class="total">
                  <td>Total deductions</td>
                  <td class="amount">${currency.format(args.totalDeductions)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="net">
          <div>
            <div class="label">Net pay</div>
            <div style="font-size:13px; opacity:.85;">Amount payable for this payroll period</div>
          </div>
          <div class="value">${currency.format(args.netPay)}</div>
        </div>

        <div class="footer">
          <div class="sign">Prepared by: ____________________</div>
          <div class="sign">Approved by: ____________________</div>
          <div class="sign">Employee sign: ____________________</div>
        </div>
      </body>
    </html>
  `;
}

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const attendantId = (url.searchParams.get("attendantId") || "").trim();
  const periodKey = (url.searchParams.get("periodKey") || "").trim();
  if (!attendantId) {
    return NextResponse.json({ error: "Missing attendantId" }, { status: 400 });
  }

  const period = parseTradingPeriodKey(periodKey) ?? getTradingPeriodFor(new Date());
  const attendant = await prisma.user.findUnique({
    where: { id: attendantId },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });

  if (!attendant) {
    return NextResponse.json({ error: "Attendant not found" }, { status: 404 });
  }

  const row = await buildPayrollRow(
    {
      id: attendant.id,
      name: attendant.name,
      email: attendant.email,
      attendantCategory: attendant.attendantCategory,
      isActive: attendant.isActive,
    },
    period,
  );

  const branding = await getBranding();
  const commissionLines = buildCommissionLines(row);
  const earningsLines = [
    { label: "Base salary", amount: row.baseSalary },
    { label: "Transport allowance", amount: row.transportAllowance },
    ...commissionLines,
    { label: "Bonus", amount: row.adjustmentBreakdown.bonus },
    { label: "Top-up", amount: row.adjustmentBreakdown.commissionTopUp },
  ];
  const deductionLines = [
    { label: "Chama", amount: row.adjustmentBreakdown.chama },
    { label: "Lateness", amount: row.adjustmentBreakdown.lateness },
    { label: "Discipline", amount: row.adjustmentBreakdown.discipline },
    { label: "Other deductions", amount: row.adjustmentBreakdown.other },
    { label: "Penalties", amount: row.adjustmentBreakdown.penalties },
  ];

  const html = renderPayslipHtml({
    siteTitle: branding.siteTitle || "BetechOps",
    letterheadUrl: typeof branding.letterheadUrl === "string" ? branding.letterheadUrl : null,
    brandColor: branding.brandColor || "#7A2020",
    payslipNo: payslipNumber(attendant.id, period.key),
    generatedAt: new Date(),
    periodLabel: period.label,
    attendantName: attendant.name || attendant.email || attendant.id,
    attendantEmail: attendant.email || "-",
    categoryLabel: getCategoryLabel(attendant.attendantCategory),
    statusLabel: attendant.isActive ? "Active" : "Inactive",
    workSummary: buildWorkSummary(row),
    earningsLines,
    deductionLines,
    totalEarnings: row.totalEarnings,
    totalDeductions: row.totalDeductions,
    netPay: row.netPay,
  });

  const browser = await launchChromiumBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    const safeName = sanitizeFilename(`${attendant.name || attendant.email || attendant.id} payslip ${period.key}.pdf`);
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
        "X-Receipt-Renderer": "pdf",
      },
    });
  } finally {
    await browser.close();
  }
}
