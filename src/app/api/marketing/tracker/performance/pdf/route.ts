import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { resolveTargetUserId } from "@/lib/resolveTargetUser";
import type { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { normalizePaymentMethod, normalizeReceiptNumber } from "@/lib/receiptKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReceiptRow = {
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
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatKes = (value: number) =>
  `KES ${Math.round(value).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const extractReceiptAmount = (row: ReceiptRow) => {
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
      <title>Performance report</title>
      <style>
        body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; }
        h1, h2 { margin: 0; }
        .muted { color: #475569; }
        .pill { display:inline-block; padding:4px 10px; border:1px solid #e2e8f0; border-radius:999px; font-size:12px; color:#334155; }
        .grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:10px; margin-top:14px; }
        .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; background: #ffffff; }
        .label { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color:#64748b; }
        .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
        table { width:100%; border-collapse: collapse; margin-top: 12px; }
        th, td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        th { text-align:left; background:#f8fafc; color:#0f172a; }
        .note { margin-top: 10px; font-size: 11px; color:#64748b; }
      </style>
    </head>
    <body>
      <div style="display:flex; justify-content: space-between; align-items: baseline; gap: 16px;">
        <div>
          <h1>Performance report</h1>
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
      </div>

      <h2 style="margin-top:16px;">Receipts</h2>
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
        Note: This PDF excludes profit, buying price, and selling price breakdowns. It shows only receipt totals and summary KPIs.
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

  const [user, posSummary, earnings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    summarizePosReceiptsForPeriod({ start: period.start, end: period.end, userId }),
    getEarningsSummaryForUser({ userId, asOf: period.start }),
  ]);

  const attendantName = user?.name ?? "Attendant";
  const attendantEmail = user?.email ?? "";

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
    take: 800,
  })) as ReceiptRow[];

  const rows: Array<{
    dateIso: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: "MPESA" | "CASH";
    status: string;
  }> = [];

  const seen = new Set<string>();
  for (const r of receipts) {
    const canonical =
      normalizeReceiptNumber(r.receiptNumber) ||
      normalizeReceiptNumber(r.order?.orderNumber) ||
      r.id;
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const date = r.generatedAt ?? r.createdAt;
    const dateIso = new Date(date).toISOString().slice(0, 10);
    const receiptNumber = r.receiptNumber || r.order?.orderNumber || canonical;
    const amount = extractReceiptAmount(r);
    const paymentMethod = normalizePaymentMethod(
      (r.data as any)?.paymentMethod ?? (r.totals as any)?.paymentMethod ?? "MPESA",
    );
    const status =
      (r.order?.paymentStatus || r.order?.status || "").toString().toUpperCase() || "UNKNOWN";

    rows.push({ dateIso, receiptNumber, amount, paymentMethod, status });
  }

  const html = renderHtml({
    attendantName,
    attendantEmail,
    periodLabel: period.label,
    periodStartIso: period.start.toISOString().slice(0, 10),
    periodEndIso: period.end.toISOString().slice(0, 10),
    totalSales: Number(posSummary.totalSales ?? 0),
    totalReceipts: Number(posSummary.totalReceipts ?? 0),
    totalItems: Number(posSummary.totalItems ?? 0),
    commission: Number((earnings as any)?.grossCommission ?? (earnings as any)?.commission ?? 0),
    rows,
  });

  let browser: any = null;
  try {
    // Prefer full puppeteer when available (dev/local). Fall back to serverless chromium.
    let puppeteer: any = null;
    try {
      const mod = await import("puppeteer").catch(() => null);
      puppeteer = mod && (mod as any).default ? (mod as any).default : mod;
    } catch {
      puppeteer = null;
    }

    if (puppeteer) {
      browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1200, height: 800 } });
    } else {
      browser = await launchChromiumBrowser();
    }
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "18px", bottom: "18px", left: "18px", right: "18px" } });
    await browser.close();

    const filenameSafe =
      `${attendantName || "attendant"}`
        .trim()
        .replaceAll(/[^a-z0-9]+/gi, "-")
        .replaceAll(/-+/g, "-")
        .replaceAll(/(^-|-$)/g, "") || "attendant";

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"performance-${filenameSafe}-${period.key}.pdf\"`,
        "Cache-Control": "no-store",
        "X-Receipt-Renderer": "pdf",
        "X-Receipt-Commit": process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
      },
    });
  } catch (err: any) {
    if (browser) await browser.close().catch(() => null);
    console.error("[marketing-performance-pdf] failed", err);
    return NextResponse.json(
      { error: "Failed to generate PDF", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
