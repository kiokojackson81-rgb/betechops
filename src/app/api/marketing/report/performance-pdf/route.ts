import { NextResponse } from "next/server";
import { requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { getCurrentTradingPeriodFor } from "@/lib/marketingPeriod";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { nowInNairobi } from "@/lib/timezone";
import { getUserCommissionConfigLike } from "@/lib/userCommissionConfig";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import {
  computeJenifferProratedCommission,
  computeSalesCommissionFromTiers,
  getOrCreateCommissionPeriod,
} from "@/lib/commission";
import { computeBrendahDirectCommission } from "@/lib/onlineCommission";
import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";

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
    .slice(0, 120);
}

function renderHtml(opts: {
  title: string;
  generatedAtIso: string;
  periodLabel: string;
  periodStartIso: string;
  periodEndIso: string;
  letterheadUrl: string | null;
  attendantName: string;
  attendantEmail: string;
  totals: {
    totalSales: number;
    totalProfit: number;
    totalReceipts: number;
    totalItems: number;
    mpesaSales: number;
    cashSales: number;
    commission: number;
  };
  config: { posTotalsMode: string; salesCommissionMode: string };
}) {
  const letterheadBlock = opts.letterheadUrl
    ? `<div class="letterhead"><img src="${opts.letterheadUrl}" alt="Letterhead" /></div>`
    : "";

  const t = opts.totals;

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${opts.title}</title>
      <style>
        @page { size: A4; margin: 20mm 14mm; }
        body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #0f172a; }
        h1 { font-size: 20px; margin: 8px 0 6px; }
        h2 { font-size: 14px; margin: 18px 0 8px; }
        .muted { color: #475569; font-size: 12px; }
        .summary { margin-top: 12px; padding: 12px 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .kv { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; background: #ffffff; }
        .kv .k { font-size: 11px; letter-spacing: .04em; color: #64748b; text-transform: uppercase; }
        .kv .v { margin-top: 4px; font-size: 16px; font-weight: 700; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        th { text-align: left; background: #f1f5f9; color: #334155; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
        .letterhead { margin-bottom: 10px; }
        .letterhead img { width: 100%; max-height: 120px; object-fit: contain; }
        .right { text-align: right; }
      </style>
    </head>
    <body>
      ${letterheadBlock}
      <div class="muted">Generated: ${opts.generatedAtIso}</div>
      <h1>${opts.title}</h1>
      <div class="muted">Trading period: ${opts.periodLabel} (${opts.periodStartIso} – ${opts.periodEndIso})</div>

      <div class="summary">
        <div><strong>Attendant:</strong> ${opts.attendantName}</div>
        <div><strong>Email:</strong> ${opts.attendantEmail}</div>
        <div style="margin-top:6px" class="muted">
          POS totals mode: <strong>${opts.config.posTotalsMode}</strong> • Commission mode: <strong>${opts.config.salesCommissionMode}</strong>
        </div>
      </div>

      <div class="grid">
        <div class="kv">
          <div class="k">Sales</div>
          <div class="v">${currency.format(t.totalSales)}</div>
        </div>
        <div class="kv">
          <div class="k">Commission</div>
          <div class="v">${currency.format(t.commission)}</div>
        </div>
        <div class="kv">
          <div class="k">Receipts</div>
          <div class="v">${Number(t.totalReceipts).toLocaleString("en-KE")}</div>
        </div>
        <div class="kv">
          <div class="k">Products / Items</div>
          <div class="v">${Number(t.totalItems).toLocaleString("en-KE")}</div>
        </div>
      </div>

      <h2>Payment split</h2>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>MPESA</td>
            <td class="right">${currency.format(t.mpesaSales)}</td>
          </tr>
          <tr>
            <td>Cash</td>
            <td class="right">${currency.format(t.cashSales)}</td>
          </tr>
        </tbody>
      </table>

      <h2>Profit</h2>
      <table>
        <thead>
          <tr>
            <th>Total profit</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Profit</td>
            <td class="right">${currency.format(t.totalProfit)}</td>
          </tr>
        </tbody>
      </table>
    </body>
  </html>
  `;
}

async function launchBrowser() {
  try {
    const mod = await import("puppeteer").catch(() => null);
    const puppeteer = mod && (mod as any).default ? (mod as any).default : mod;
    if (puppeteer) {
      return await puppeteer.launch({
        headless: true,
        defaultViewport: { width: 1200, height: 800 },
      });
    }
  } catch (err) {
    console.warn("[performance-pdf] puppeteer launch failed; falling back", err);
  }

  try {
    return await launchChromiumBrowser();
  } catch (err) {
    console.error("[performance-pdf] chromium launch failed", err);
    return null;
  }
}

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  try {
    const url = new URL(req.url);
    const impersonateId = url.searchParams.get("impersonateId");
    const actorId = await getActorId();
    const targetUserId = impersonateId && auth.role === "ADMIN" ? impersonateId : actorId;
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const periodKeyParam = url.searchParams.get("periodKey") || url.searchParams.get("period") || undefined;
    const requestedPeriod = parseTradingPeriodKey(periodKeyParam);

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, attendantCategory: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const commissionConfig = await getUserCommissionConfigLike(targetUserId);
    const usePosTotals = commissionConfig.posTotalsMode !== "NONE";
    const isBrendah = commissionConfig.salesCommissionMode === "BRENDAH_DIRECT";
    const isJeniffer = commissionConfig.salesCommissionMode === "JENIFFER_PRORATED";

    const today = nowInNairobi();
    const { tiers } = await getOrCreateCommissionPeriod(today);
    const current = await getCurrentTradingPeriodFor(today);

    let period: { start: Date; end: Date; key: string; label: string } = requestedPeriod
      ? {
          start: requestedPeriod.start,
          end: requestedPeriod.end,
          key: requestedPeriod.key,
          label: requestedPeriod.label,
        }
      : {
          start: current.startDate,
          end: current.endDate,
          key: current.key,
          label: current.label,
        };

    if (!requestedPeriod && !(today >= period.start && today <= period.end)) {
      const fallback = getTradingPeriodFor(today);
      period = { start: fallback.start, end: fallback.end, key: fallback.key, label: fallback.label };
    }

    const [marketingSummary, supportSummary] = await Promise.all([
      summarizeMarketingReportsForPeriod({
        userId: targetUserId,
        userEmail: (user.email ?? "").toLowerCase().trim() || null,
        period,
      }),
      getSupportPeriodAggregates({ userId: targetUserId, period }),
    ]);

    const marketingPer = (marketingSummary as any)?.perReceipts ?? {};
    const supportPer = (supportSummary as any)?.perReceipts ?? {};

    const merged = new Map<string, { sales: number; profit: number; items: number; mpesa: number; cash: number }>();
    for (const [k, v] of Object.entries(marketingPer) as [string, any][]) {
      merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
    }
    for (const [k, v] of Object.entries(supportPer) as [string, any][]) {
      const supportObj = { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 };
      if (merged.has(k)) {
        const existing = merged.get(k)!;
        if ((existing.profit ?? 0) <= 0 && (supportObj.profit ?? 0) > 0) {
          merged.set(k, supportObj);
        }
        continue;
      }
      merged.set(k, supportObj);
    }

    let mergedSales = 0;
    let mergedProfit = 0;
    let mergedItems = 0;
    const mergedStats = { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 };
    for (const [, v] of merged) {
      mergedSales += v.sales;
      mergedProfit += v.profit;
      mergedItems += v.items;
      mergedStats.totalSalesMpesa += v.mpesa;
      mergedStats.totalSalesCash += v.cash;
      if (v.mpesa > 0) mergedStats.countMpesaReceipts += 1;
      if (v.cash > 0) mergedStats.countCashReceipts += 1;
    }
    const mergedReceipts = merged.size;

    let totalSales = mergedSales;
    let totalProfit = mergedProfit;
    let totalItems = mergedItems;
    let totalReceipts = mergedReceipts;
    let paymentStats = mergedStats;

    let posSummary: Awaited<ReturnType<typeof summarizePosReceiptsForPeriod>> | null = null;
    if (usePosTotals) {
      const posUserId = commissionConfig.posTotalsMode === "GLOBAL" ? null : targetUserId;
      posSummary = await summarizePosReceiptsForPeriod({
        start: period.start,
        end: period.end,
        userId: posUserId,
      });

      totalSales = posSummary.totalSales;
      totalProfit = posSummary.totalProfit;
      totalItems = posSummary.totalItems;
      totalReceipts = posSummary.totalReceipts;
      paymentStats = posSummary.paymentStats as any;
    }

    let commission = 0;
    if (usePosTotals && posSummary) {
      if (isBrendah) {
        commission = computeBrendahDirectCommission(posSummary.totalSales, posSummary.totalProfit).amount;
      } else if (isJeniffer) {
        const res = computeJenifferProratedCommission(
          posSummary.totalSales,
          tiers.map((t: any) => ({
            minSales: Number(t.minSales),
            maxSales: t.maxSales == null ? null : Number(t.maxSales),
            payoutFlat: Number(t.payoutFlat),
          })),
        );
        commission = Math.round(Number(res.commission ?? 0));
      } else {
        const fallbackPercent = posSummary.totalProfit > 0 ? 0.05 : 0;
        commission = Math.round(computeSalesCommissionFromTiers(posSummary.totalSales, posSummary.totalProfit, tiers as any, fallbackPercent));
      }
    } else if (totalSales > 0) {
      commission = isBrendah
        ? computeBrendahDirectCommission(totalSales, totalProfit).amount
        : Math.round(computeSalesCommissionFromTiers(totalSales, totalProfit, tiers as any));
    }

    try {
      if (!usePosTotals && user.email) {
        const unpriced = await getUnpricedDailySalesForCurrentPeriod();
        const hasUnpricedForUser = unpriced.some(
          (s) => (s.attendantEmail ?? "").toLowerCase() === user.email!.toLowerCase(),
        );
        if (hasUnpricedForUser) {
          commission = 0;
        }
      }
    } catch {
      // ignore
    }

    const branding = await getBranding();
    const rawLetterhead = (branding as any)?.letterheadUrl ?? null;
    const letterheadUrl =
      rawLetterhead && typeof rawLetterhead === "string"
        ? rawLetterhead.startsWith("http")
          ? rawLetterhead
          : new URL(rawLetterhead, url).toString()
        : null;

    const title = "Performance report";
    const attendantName = (user.name ?? user.email ?? user.id).toString();
    const attendantEmail = (user.email ?? "").toString();

    const html = renderHtml({
      title,
      generatedAtIso: new Date().toISOString(),
      periodLabel: period.label,
      periodStartIso: period.start.toISOString().slice(0, 10),
      periodEndIso: period.end.toISOString().slice(0, 10),
      letterheadUrl,
      attendantName,
      attendantEmail,
      totals: {
        totalSales: Math.round(Number(totalSales ?? 0)),
        totalProfit: Math.round(Number(totalProfit ?? 0)),
        totalReceipts: Math.round(Number(totalReceipts ?? 0)),
        totalItems: Math.round(Number(totalItems ?? 0)),
        mpesaSales: Math.round(Number((paymentStats as any)?.totalSalesMpesa ?? 0)),
        cashSales: Math.round(Number((paymentStats as any)?.totalSalesCash ?? 0)),
        commission: Math.round(Number(commission ?? 0)),
      },
      config: {
        posTotalsMode: String(commissionConfig.posTotalsMode),
        salesCommissionMode: String(commissionConfig.salesCommissionMode),
      },
    });

    const browser = await launchBrowser();
    if (!browser) {
      return NextResponse.json(
        { error: "PDF export not available: missing optional browser dependencies (puppeteer or chromium)." },
        { status: 501 },
      );
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    const filename = sanitizeFilename(`performance-${attendantName}-${period.key || "period"}.pdf`);
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[api/marketing/report/performance-pdf] error", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

