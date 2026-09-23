import { getAttendantCommissionSummary } from "@/lib/attendantCommission";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { getBranding } from "@/lib/branding";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

function sanitizeFilename(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function parseDateParam(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function renderHtml(opts: {
  title: string;
  attendantName: string;
  attendantEmail: string | null;
  startIso: string;
  endIso: string;
  letterheadUrl: string | null;
  totalSales: number;
  recordedSales: number;
  receiptCount: number;
  commissionKes: number;
  rows: Array<{
    receiptNumber: string;
    createdAt: string;
    customerName: string;
    total: number;
    paymentMethod: string;
    docType: string;
    reason: string; profit: number; commission: number;
  }>;
}) {
  const letterheadBlock = opts.letterheadUrl
    ? `<div class="letterhead"><img src="${opts.letterheadUrl}" alt="Letterhead" /></div>`
    : "";

  const rowsHtml = opts.rows
    .map(
      (r) => `
      <tr>
        <td>${r.createdAt}</td>
        <td>${escapeHtml(r.receiptNumber)}</td>
        <td>${r.docType}<br/>${r.reason}</td>
        <td>${escapeHtml(r.customerName)}</td>
        <td>${r.paymentMethod}</td>
        <td style="text-align:right">${currency.format(r.total)}</td>
        <td>${currency.format(r.profit)}</td><td>${currency.format(r.commission)}</td>
      </tr>`,
    )
    .join("\n");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(opts.title)}</title>
      <style>
        @page { size: A4; margin: 22mm 14mm; }
        body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #0f172a; }
        h1 { font-size: 18px; margin: 10px 0 6px; }
        .muted { color: #475569; font-size: 12px; }
        .summary { margin-top: 10px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 14px; }
        th, td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        th { text-align: left; background: #f1f5f9; color: #334155; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; }
        .letterhead { margin-bottom: 10px; }
        .letterhead img { width: 100%; max-height: 120px; object-fit: contain; }
      </style>
    </head>
    <body>
      ${letterheadBlock}
      <div class="muted">Generated: ${new Date().toISOString()}</div>
      <h1>${escapeHtml(opts.title)}</h1>
      <div class="muted">Direct sales (POS receipts)</div>
      <div class="muted">Range: ${opts.startIso} – ${opts.endIso}</div>

      <div class="summary">
        <div class="summary-grid">
          <div><strong>Attendant:</strong> ${escapeHtml(opts.attendantName)}</div>
          <div><strong>Email:</strong> ${escapeHtml(opts.attendantEmail ?? "-")}</div>
          <div><strong>Recorded receipt value (excluding cancellations):</strong> ${currency.format(opts.recordedSales)}</div>
          <div><strong>Eligible receipts:</strong> ${opts.receiptCount}</div>
          <div><strong>Commission-eligible sales:</strong> ${currency.format(opts.totalSales)}</div>
          <div><strong>Commission (KES):</strong> ${currency.format(opts.commissionKes)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 110px">Date</th>
            <th style="width: 170px">Receipt</th>
            <th style="width: 90px">Doc</th>
            <th>Customer</th>
            <th style="width: 80px">Pay</th>
            <th style="width: 120px; text-align:right">Amount</th>
            <th>Profit</th><th>Direct commission contribution</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="8" class="muted">No POS receipts found for this range.</td></tr>`}
        </tbody>
      </table>
      <p class="muted">Direct commission contributions follow reporting-date order and configured period rules. Pending receipts contribute zero. Other commission channels and payroll adjustments are shown in the employee performance report.</p>
    </body>
  </html>
  `;
}

export async function GET(req: Request) {
  const authz = await requireRole("ADMIN");
  if (!authz.ok) return authz.res;

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1" || url.searchParams.get("debug") === "true";
  const attendantId = (url.searchParams.get("attendantId") || "").trim();
  const rawStart = url.searchParams.get("start");
  const rawEnd = url.searchParams.get("end");
  const startParam = parseDateParam(rawStart && /^\d{4}-\d{2}-\d{2}$/.test(rawStart) ? `${rawStart}T00:00:00+03:00` : rawStart);
  const endParam = parseDateParam(rawEnd && /^\d{4}-\d{2}-\d{2}$/.test(rawEnd) ? `${rawEnd}T23:59:59.999+03:00` : rawEnd);
  const docTypeParam = (url.searchParams.get("docType") || "").trim();
  const docType = docTypeParam ? docTypeParam.toUpperCase() : null;

  if (!attendantId) {
    return NextResponse.json({ error: "Missing attendantId" }, { status: 400 });
  }
  if (!startParam || !endParam) {
    return NextResponse.json({ error: "Missing start/end" }, { status: 400 });
  }

  const attendant = await prisma.user.findUnique({
    where: { id: attendantId },
    select: { id: true, name: true, email: true, attendantCategory: true },
  });
  const attendantName = (attendant?.name ?? attendant?.email ?? attendantId).toString();
  const attendantEmail = attendant?.email ?? null;

  const summary = await getAttendantCommissionSummary({ attendantId, start: startParam, end: endParam });
  const breakdown = summary.receiptBreakdown.filter(row => !docType || row.docType === docType);
  const totalSales = breakdown.reduce((sum, row) => sum + row.eligibleSales, 0);
  const receiptCount = breakdown.filter(row => row.eligible).length;
  const commissionKes = breakdown.reduce((sum, row) => sum + (row.commission ?? 0), 0);
  const rows = breakdown.map(row => ({ receiptNumber: row.receiptKey,
    createdAt: (row.salesDate ?? row.createdAt)?.toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" }) ?? "Pending",
    customerName: row.customerName, total: row.sales, paymentMethod: row.paymentMethod,
    docType: row.docType, reason: row.reason, profit: row.profit, commission: row.commission ?? 0 }));
  if (debug) return NextResponse.json({ attendant: { id: attendantId, name: attendantName },
    totalSales, recordedSales: breakdown.reduce((sum, row) => sum + row.sales, 0), receiptCount, commissionKes, rows,
    commissionBasis: "Incremental period commission in reporting-date order" }, { headers: { "Cache-Control": "no-store" } });

  const branding = await getBranding();
  const rawLetterhead = (branding as any)?.letterheadUrl ?? null;
  const letterheadUrl =
    rawLetterhead && typeof rawLetterhead === "string"
      ? rawLetterhead.startsWith("http")
        ? rawLetterhead
        : new URL(rawLetterhead, url).toString()
      : null;

  const title = `${attendantName} POS direct sales report`;
  const startIso = (rawStart && rawStart.length >= 10 ? rawStart.slice(0, 10) : startParam.toISOString().slice(0, 10));
  const endIso = (rawEnd && rawEnd.length >= 10 ? rawEnd.slice(0, 10) : endParam.toISOString().slice(0, 10));
  const html = renderHtml({
    title,
    attendantName,
    attendantEmail,
    startIso,
    endIso,
    letterheadUrl,
    totalSales,
    recordedSales: breakdown.filter(row => row.reason !== "Cancelled").reduce((sum, row) => sum + row.sales, 0),
    receiptCount,
    commissionKes,
    rows,
  });

  const browser = await launchChromiumBrowser();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();

  const filename = sanitizeFilename(`${attendantName} POS direct sales ${startIso} to ${endIso}.pdf`);
  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
