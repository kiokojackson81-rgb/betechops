import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { resolveTargetUserId } from "@/lib/resolveTargetUser";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { normalizePaymentMethod, normalizeReceiptNumber } from "@/lib/receiptKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PosReceiptRow = {
  id: string;
  receiptNumber: string | null;
  generatedAt: Date | null;
  createdAt: Date;
  totals: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  order: {
    orderNumber: string | null;
    status: string | null;
    paymentStatus: string | null;
    totalAmount: number | null;
  } | null;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toNumber = (value: unknown): number => {
  if (value === null || typeof value === "undefined") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatKes = (value: number) =>
  `KES ${Math.round(value).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const extractReceiptAmount = (row: PosReceiptRow) => {
  const totals = row.totals ?? {};
  const data = row.data ?? {};
  return (
    toNumber((totals as any).sellingTotal) ||
    toNumber((totals as any).grandTotal) ||
    toNumber((totals as any).total) ||
    toNumber((totals as any).amount) ||
    toNumber((totals as any).subtotal) ||
    toNumber((data as any).total) ||
    toNumber((data as any).amount) ||
    toNumber(row.order?.totalAmount) ||
    0
  );
};

function renderHtml(args: {
  attendantName: string;
  attendantEmail: string;
  periodLabel: string;
  periodStartIso: string;
  periodEndIso: string;
  totalSales: number;
  totalReceipts: number;
  totalItems: number;
  commission: number;
  totalNewProducts: number;
  totalEditedProducts: number;
  totalCopiedProducts: number;
  walkInsServed: number;
  walkInsPurchased: number;
  rows: Array<{
    dateIso: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: "MPESA" | "CASH";
    status: string;
  }>;
}) {
  const rowsHtml = args.rows
    .map((r) => {
      return `
      <tr>
        <td>${escapeHtml(r.dateIso)}</td>
        <td>${escapeHtml(r.receiptNumber)}</td>
        <td style="text-align:right">${escapeHtml(formatKes(r.amount))}</td>
        <td>${escapeHtml(r.paymentMethod)}</td>
        <td>${escapeHtml(r.status)}</td>
      </tr>
    `;
    })
    .join("\n");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Performance receipt</title>
      <style>
        body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#0f172a; padding: 8px; }
        h1, h2, h3 { margin: 0; }
        .muted { color:#475569; }
        .pill { display:inline-block; padding:4px 10px; border:1px solid #e2e8f0; border-radius:999px; font-size:12px; color:#334155; }
        .grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:10px; margin-top:14px; }
        .card { border:1px solid #e2e8f0; border-radius:12px; padding:10px 12px; background:#ffffff; }
        .label { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#64748b; }
        .value { font-size:18px; font-weight:700; margin-top:4px; }
        table { width:100%; border-collapse:collapse; margin-top: 12px; }
        th, td { padding:8px 6px; border-bottom:1px solid #e2e8f0; font-size:12px; }
        th { text-align:left; background:#f8fafc; color:#0f172a; }
        .note { margin-top:10px; font-size:11px; color:#64748b; }
      </style>
    </head>
    <body>
      <div style="display:flex; justify-content:space-between; align-items:baseline; gap:16px;">
        <div>
          <h1>Performance receipt</h1>
          <div class="muted" style="margin-top:4px;">
            ${escapeHtml(args.attendantName)} &nbsp;•&nbsp; ${escapeHtml(args.attendantEmail)}
          </div>
        </div>
        <div class="pill">${escapeHtml(args.periodLabel)}</div>
      </div>

      <div class="muted" style="margin-top:6px;">
        Period: ${escapeHtml(args.periodStartIso)} to ${escapeHtml(args.periodEndIso)}
      </div>

      <div class="grid">
        <div class="card">
          <div class="label">Sales</div>
          <div class="value">${escapeHtml(formatKes(args.totalSales))}</div>
        </div>
        <div class="card">
          <div class="label">Receipts</div>
          <div class="value">${escapeHtml(args.totalReceipts)}</div>
        </div>
        <div class="card">
          <div class="label">Items</div>
          <div class="value">${escapeHtml(args.totalItems)}</div>
        </div>
        <div class="card">
          <div class="label">Commission</div>
          <div class="value">${escapeHtml(formatKes(args.commission))}</div>
        </div>
        <div class="card">
          <div class="label">New products</div>
          <div class="value">${escapeHtml(args.totalNewProducts)}</div>
        </div>
        <div class="card">
          <div class="label">Edited products</div>
          <div class="value">${escapeHtml(args.totalEditedProducts)}</div>
        </div>
        <div class="card">
          <div class="label">Copied products</div>
          <div class="value">${escapeHtml(args.totalCopiedProducts)}</div>
        </div>
        <div class="card">
          <div class="label">Walk-ins served/purchased</div>
          <div class="value">${escapeHtml(`${args.walkInsServed}/${args.walkInsPurchased}`)}</div>
        </div>
      </div>

      <h2 style="margin-top:16px;">Receipts list</h2>
      <table>
        <thead>
          <tr>
            <th style="width:110px;">Date</th>
            <th>Receipt #</th>
            <th style="text-align:right; width:130px;">Amount</th>
            <th style="width:80px;">Method</th>
            <th style="width:110px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="5" class="muted">No receipts found in this period.</td></tr>`}
        </tbody>
      </table>

      <div class="note">
        This report intentionally excludes profit and buying price values.
      </div>
    </body>
  </html>
  `;
}

export async function GET(req: Request) {
  const identity = await resolveTargetUserId(req, { allowedImpersonationRoles: ["ADMIN" as Role] });
  const userId = identity.resolvedUserId;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const periodKeyParam = url.searchParams.get("periodKey") || url.searchParams.get("tradingPeriodKey");
  const period = parseTradingPeriodKey(periodKeyParam ?? undefined) ?? getTradingPeriodFor(new Date());

  const [user, earnings, reportAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    getEarningsSummaryForUser({ userId, asOf: period.start }),
    prisma.dailyReport.aggregate({
      where: { userId, date: { gte: period.start, lte: period.end } },
      _sum: {
        newProducts: true,
        productsEdited: true,
        copiesUploaded: true,
        walkInServed: true,
        purchasesMade: true,
      },
    }),
  ]);

  const ownerOr = [
    { issuedById: userId },
    { order: { attendantId: userId } },
    { data: { path: ["attendantId"], equals: userId } },
  ];

  const receipts = (await prisma.receipt.findMany({
    where: {
      AND: [
        {
          OR: [
            { generatedAt: { gte: period.start, lte: period.end } },
            { createdAt: { gte: period.start, lte: period.end } },
          ],
        },
        { OR: ownerOr },
        {
          OR: [
            { data: { path: ["podDelivery"], equals: Prisma.JsonNull } },
            { NOT: { data: { path: ["podDelivery", "status"], equals: "pending" } } },
          ],
        },
      ],
    },
    select: {
      id: true,
      receiptNumber: true,
      generatedAt: true,
      createdAt: true,
      totals: true,
      data: true,
      order: {
        select: {
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 1200,
  })) as PosReceiptRow[];

  const rows: Array<{
    dateIso: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: "MPESA" | "CASH";
    status: string;
  }> = [];
  const seen = new Set<string>();

  for (const row of receipts) {
    const canonical =
      normalizeReceiptNumber(row.receiptNumber) ||
      normalizeReceiptNumber(row.order?.orderNumber) ||
      row.id;
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const date = row.generatedAt ?? row.createdAt;
    const dateIso = new Date(date).toISOString().slice(0, 10);
    const receiptNumber = row.receiptNumber || row.order?.orderNumber || canonical;
    const amount = extractReceiptAmount(row);
    const paymentMethod = normalizePaymentMethod(
      (row.data as any)?.paymentMethod ?? (row.totals as any)?.paymentMethod ?? "MPESA",
    );
    const status =
      (row.order?.paymentStatus || row.order?.status || "").toString().toUpperCase() || "UNKNOWN";

    rows.push({ dateIso, receiptNumber, amount, paymentMethod, status });
  }

  if (rows.length === 0) {
    // Fallback for periods where data is only in daily-report sales rows.
    const salesRows = await prisma.dailySale.findMany({
      where: { dailyReport: { userId, date: { gte: period.start, lte: period.end } } },
      select: { receiptNumber: true, price: true, paymentMethod: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1200,
    });
    const perReceipt = new Map<string, { amount: number; method: "MPESA" | "CASH"; dateIso: string }>();
    for (const sale of salesRows) {
      const key = normalizeReceiptNumber(sale.receiptNumber) || `sale-${sale.createdAt.toISOString()}`;
      const existing = perReceipt.get(key);
      const nextAmount = Number(sale.price ?? 0);
      if (existing) {
        existing.amount += nextAmount;
        continue;
      }
      perReceipt.set(key, {
        amount: nextAmount,
        method: normalizePaymentMethod(sale.paymentMethod ?? "MPESA"),
        dateIso: sale.createdAt.toISOString().slice(0, 10),
      });
    }
    for (const [receiptNumber, value] of perReceipt) {
      rows.push({
        dateIso: value.dateIso,
        receiptNumber,
        amount: value.amount,
        paymentMethod: value.method,
        status: "SUBMITTED",
      });
    }
  }

  const html = renderHtml({
    attendantName: user?.name ?? "Attendant",
    attendantEmail: user?.email ?? "",
    periodLabel: period.label,
    periodStartIso: period.start.toISOString().slice(0, 10),
    periodEndIso: period.end.toISOString().slice(0, 10),
    totalSales: Number(earnings.totalSales ?? 0),
    totalReceipts: Number(earnings.totalReceipts ?? 0),
    totalItems: Number(earnings.totalItems ?? 0),
    commission: Number((earnings as any).grossCommission ?? (earnings as any).commission ?? 0),
    totalNewProducts: Number(reportAgg._sum.newProducts ?? 0),
    totalEditedProducts: Number(reportAgg._sum.productsEdited ?? 0),
    totalCopiedProducts: Number(reportAgg._sum.copiesUploaded ?? 0),
    walkInsServed: Number(reportAgg._sum.walkInServed ?? 0),
    walkInsPurchased: Number(reportAgg._sum.purchasesMade ?? 0),
    rows,
  });

  let browser: any = null;
  try {
    let puppeteer: any = null;
    try {
      const mod = await import("puppeteer").catch(() => null);
      puppeteer = mod && (mod as any).default ? (mod as any).default : mod;
    } catch {
      puppeteer = null;
    }

    if (puppeteer) {
      browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
    } else {
      browser = await launchChromiumBrowser();
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16px", right: "16px", bottom: "16px", left: "16px" },
    });
    await browser.close();

    const fileSafeName =
      `${user?.name || "attendant"}`
        .trim()
        .replaceAll(/[^a-z0-9]+/gi, "-")
        .replaceAll(/-+/g, "-")
        .replaceAll(/(^-|-$)/g, "") || "attendant";

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"performance-receipt-${fileSafeName}-${period.key}.pdf\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    if (browser) await browser.close().catch(() => null);
    console.error("[daily-report-performance-receipt-pdf] failed", err);
    return NextResponse.json(
      { error: "Failed to generate PDF", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
