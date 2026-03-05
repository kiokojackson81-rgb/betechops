import { NextRequest, NextResponse } from "next/server";
import { requireRoleOrBenjamin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canonicalNairobiWeekStartUtc, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { Platform, Prisma } from "@prisma/client";
import { isMarketplaceStatementDraftTableAvailable } from "@/lib/statementDraftTable";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGETS = [
  { key: "betech-store", label: "Betech Store", match: ["Betech Store"] },
  { key: "jude-collection", label: "Jude Collection", match: ["Jude Collection"] },
  { key: "hitech-power", label: "Hitech Power", match: ["Hitech Power"] },
  { key: "jm-latest", label: "JM Latest Collections", match: ["JM Latest Collections", "JM Collection", "JM Collections"] },
];

function money(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

async function resolveShopForAccount(account: { platform: Platform; displayName: string | null; jumiaShopSid: string | null }) {
  const apiKey = normalize(account.jumiaShopSid);
  const name = normalize(account.displayName);
  const shop =
    (apiKey
      ? await prisma.shop.findFirst({
          where: { platform: account.platform as any, apiConfig: { is: { apiKey } } as any },
          select: { id: true, name: true },
        })
      : null) ??
    (name
      ? await prisma.shop.findFirst({
          where: { platform: account.platform as any, name: { equals: name, mode: "insensitive" } as any },
          select: { id: true, name: true },
        })
      : null);
  return shop ? { id: shop.id, name: shop.name } : null;
}

async function getDividedData(weekStartRaw: string) {
  const parsed = parseDateOnlyUtc(weekStartRaw);
  if (!parsed) throw new Error("Invalid weekStart");
  const weekStart = canonicalNairobiWeekStartUtc(parsed);
  const { weekEnd } = mondayToSundayNairobiWindow(weekStart);

  const accounts = await prisma.marketplaceAccount.findMany({
    where: {
      isActive: true,
      platform: "JUMIA",
      OR: TARGETS.flatMap((t) => t.match.map((m) => ({ displayName: { contains: m, mode: "insensitive" } as any }))),
    },
    select: { id: true, displayName: true, platform: true, jumiaShopSid: true },
  });

  const chosen: Array<{
    key: string;
    label: string;
    accountId: string;
    displayName: string;
    shopId: string | null;
    shopName: string | null;
  }> = [];

  for (const t of TARGETS) {
    const a =
      accounts.find((x) => t.match.some((m) => (x.displayName ?? "").toLowerCase().includes(m.toLowerCase()))) ?? null;
    if (!a) {
      chosen.push({ key: t.key, label: t.label, accountId: "", displayName: t.label, shopId: null, shopName: null });
      continue;
    }
    const shop = await resolveShopForAccount(a as any);
    chosen.push({
      key: t.key,
      label: t.label,
      accountId: a.id,
      displayName: a.displayName ?? t.label,
      shopId: shop?.id ?? null,
      shopName: shop?.name ?? null,
    });
  }

  const shopIds = chosen.map((c) => c.shopId).filter(Boolean) as string[];
  const accountIds = chosen.map((c) => c.accountId).filter(Boolean) as string[];

  const weeklySales = shopIds.length
    ? await prisma.weeklySale.findMany({
        where: { platform: "JUMIA", shopId: { in: shopIds }, weekStart, weekEnd },
        select: { shopId: true, amount: true },
      })
    : [];
  const salesByShopId = new Map(weeklySales.map((r) => [String(r.shopId), money(r.amount)]));

  const profitRows = accountIds.length
    ? await (prisma as any).marketplaceProfitEntry.findMany({
        where: { platform: "JUMIA", accountId: { in: accountIds }, weekStart, weekEnd },
        select: { accountId: true, netPayout: true, buyingPrice: true, profit: true },
        take: 5000,
      })
    : [];
  const profitAggByAccountId = new Map<string, { net: number; buying: number; profit: number }>();
  for (const row of profitRows as any[]) {
    const id = String(row.accountId);
    const acc = profitAggByAccountId.get(id) ?? { net: 0, buying: 0, profit: 0 };
    acc.net += money(row.netPayout);
    acc.buying += money(row.buyingPrice);
    acc.profit += money(row.profit);
    profitAggByAccountId.set(id, acc);
  }

  const draftTableAvailable = await isMarketplaceStatementDraftTableAvailable();
  const returnsByShopId = new Map<string, number>();
  if (draftTableAvailable && shopIds.length) {
    const drafts = await prisma.marketplaceStatementDraft.findMany({
      where: { platform: "JUMIA", weekStart, weekEnd, shopId: { in: shopIds } },
      orderBy: { updatedAt: "desc" },
      select: { shopId: true, rows: true },
      take: 50,
    });
    for (const d of drafts) {
      const sid = String(d.shopId);
      if (returnsByShopId.has(sid)) continue;
      const rows = Array.isArray(d.rows) ? (d.rows as any[]) : [];
      const returns = rows.reduce((sum, r) => {
        const net = money((r as any)?.netPayout);
        return net < 0 ? sum + Math.abs(net) : sum;
      }, 0);
      returnsByShopId.set(sid, returns);
    }
  }

  const accountsOut = chosen.map((c) => {
    const sales = c.shopId ? salesByShopId.get(c.shopId) ?? 0 : 0;
    const prof = c.accountId ? profitAggByAccountId.get(c.accountId) ?? { net: 0, buying: 0, profit: 0 } : { net: 0, buying: 0, profit: 0 };
    const returns = c.shopId ? returnsByShopId.get(c.shopId) ?? 0 : 0;
    return {
      key: c.key,
      label: c.label,
      salesNetPayout: sales,
      returns,
      grossProfit: prof.profit + returns,
      profit: prof.profit,
      buyingTotal: prof.buying,
    };
  });

  const totals = accountsOut.reduce(
    (acc, r) => {
      acc.sales += r.salesNetPayout;
      acc.returns += r.returns;
      acc.grossProfit += r.grossProfit;
      acc.profit += r.profit;
      return acc;
    },
    { sales: 0, returns: 0, grossProfit: 0, profit: 0 },
  );

  return { weekStart, weekEnd, accounts: accountsOut, totals, draftTableAvailable };
}

function renderHtml(input: {
  weekStartInput: string;
  weekEnd: Date;
  accounts: any[];
  totals: any;
  deductions: { expenses: number; lowSellerScore: number; dividendRatePct: number; coopLoan: number; otherDeduction: number; mpesaTo0722: number };
  letterheadDataUrl: string | null;
}) {
  const fmt = (n: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
  const d = input.deductions;
  const baseProfit = input.totals.profit - d.expenses - d.lowSellerScore;
  const dividend = Math.max(0, (baseProfit * d.dividendRatePct) / 100);
  const balance = baseProfit - dividend - d.coopLoan - d.otherDeduction;
  const hitech = input.accounts.find((a) => a.key === "hitech-power") ?? null;
  const hitechPayout = hitech ? Number(hitech.salesNetPayout ?? 0) : 0;
  const equity = hitechPayout - dividend - d.mpesaTo0722 - d.coopLoan - d.otherDeduction;

  const rows = input.accounts
    .map(
      (a) => `
      <tr>
        <td>${a.label}</td>
        <td style="text-align:right">${fmt(Number(a.salesNetPayout ?? 0))}</td>
        <td style="text-align:right">${fmt(Number(a.returns ?? 0))}</td>
        <td style="text-align:right">${fmt(Number(a.grossProfit ?? 0))}</td>
        <td style="text-align:right">${fmt(Number(a.profit ?? 0))}</td>
      </tr>`,
    )
    .join("\n");

  const title = `Divided summary (${input.weekStartInput})`;
  const weekEndInput = new Date(input.weekEnd.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #0f172a; }
        .page { padding: 18px 18px 24px; }
        .letterhead { width: 100%; margin-bottom: 10px; }
        h1 { font-size: 18px; margin: 10px 0 4px; }
        .muted { color: #475569; font-size: 12px; }
        table { width:100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        th { text-align:left; background:#f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color:#64748b; }
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
        .card { border:1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
        .k { color:#475569; font-size: 11px; }
        .v { font-weight:700; }
        .row { display:flex; justify-content:space-between; gap:10px; padding: 4px 0; font-size:12px; }
        .neg { color: #be123c; font-weight:700; }
        .pos { color: #047857; font-weight:700; }
      </style>
    </head>
    <body>
      <div class="page">
        ${input.letterheadDataUrl ? `<img class="letterhead" src="${input.letterheadDataUrl}" />` : ""}
        <h1>Divided summary</h1>
        <div class="muted">Week: ${input.weekStartInput} - ${weekEndInput}</div>

        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th style="text-align:right">Sales</th>
              <th style="text-align:right">Returns</th>
              <th style="text-align:right">Gross Profit</th>
              <th style="text-align:right">Profit</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr>
              <td style="font-weight:700">Totals</td>
              <td style="text-align:right;font-weight:700">${fmt(input.totals.sales)}</td>
              <td style="text-align:right">${fmt(input.totals.returns)}</td>
              <td style="text-align:right">${fmt(input.totals.grossProfit)}</td>
              <td style="text-align:right;font-weight:700">${fmt(input.totals.profit)}</td>
            </tr>
          </tfoot>
        </table>

        <div class="grid">
          <div class="card">
            <div class="k">Divided</div>
            <div class="row"><span>Expenses</span><span>${fmt(d.expenses)}</span></div>
            <div class="row"><span>Low seller score</span><span>${fmt(d.lowSellerScore)}</span></div>
            <div class="row"><span>Base profit</span><span class="v">${fmt(baseProfit)}</span></div>
            <div class="row"><span>Divided (${d.dividendRatePct}%)</span><span class="pos">${fmt(dividend)}</span></div>
            <div class="row"><span>Coop loan</span><span>${fmt(d.coopLoan)}</span></div>
            <div class="row"><span>Other deduction</span><span>${fmt(d.otherDeduction)}</span></div>
            <div class="row" style="border-top:1px solid #e2e8f0;margin-top:6px;padding-top:8px">
              <span class="v">Balance</span><span class="v">${fmt(balance)}</span>
            </div>
          </div>
          <div class="card">
            <div class="k">Hitech payout instruction</div>
            <div class="row"><span>Hitech payout</span><span class="v">${fmt(hitechPayout)}</span></div>
            <div class="row"><span>Less divided</span><span class="neg">- ${fmt(dividend)}</span></div>
            <div class="row"><span>Send to 0722151083</span><span class="neg">- ${fmt(d.mpesaTo0722)}</span></div>
            <div class="row"><span>Less other deductions</span><span class="neg">- ${fmt(d.coopLoan + d.otherDeduction)}</span></div>
            <div class="row" style="border-top:1px solid #e2e8f0;margin-top:6px;padding-top:8px">
              <span class="v">Send to Equity</span><span class="pos">${fmt(equity)}</span>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

export async function GET(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const weekStartRaw = normalize(searchParams.get("weekStart"));
  const rawD = normalize(searchParams.get("d"));
  if (!weekStartRaw) return NextResponse.json({ error: "weekStart is required" }, { status: 400 });

  let deductions = {
    expenses: 25000,
    lowSellerScore: 10000,
    dividendRatePct: 7,
    coopLoan: 0,
    otherDeduction: 0,
    mpesaTo0722: 35000,
  };
  if (rawD) {
    try {
      const parsed = JSON.parse(decodeURIComponent(rawD)) as any;
      deductions = {
        expenses: money(parsed?.expenses ?? 25000),
        lowSellerScore: money(parsed?.lowSellerScore ?? 10000),
        dividendRatePct: money(parsed?.dividendRatePct ?? 7),
        coopLoan: money(parsed?.coopLoan ?? 0),
        otherDeduction: money(parsed?.otherDeduction ?? 0),
        mpesaTo0722: money(parsed?.mpesaTo0722 ?? 35000),
      };
    } catch {
      // ignore
    }
  }

  try {
    const parsed = parseDateOnlyUtc(weekStartRaw);
    if (!parsed) return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
    const weekStart = canonicalNairobiWeekStartUtc(parsed);
    const { weekEnd } = mondayToSundayNairobiWindow(weekStart);

    const data = await getDividedData(weekStartRaw);

    let letterheadDataUrl: string | null = null;
    try {
      const filePath = path.join(process.cwd(), "public", "letterhead.jpg");
      const buf = await readFile(filePath);
      letterheadDataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {
      letterheadDataUrl = null;
    }

    const html = renderHtml({
      weekStartInput: weekStartRaw,
      weekEnd,
      accounts: data.accounts,
      totals: data.totals,
      deductions,
      letterheadDataUrl,
    });

    // On Vercel/serverless, full `puppeteer` often installs without a Chromium binary.
    // Prefer puppeteer-core + @sparticuz/chromium there. Locally, prefer full puppeteer.
    const isServerless = Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

    let browser: any = null;
    if (isServerless) {
      try {
        const pcoreName = "puppeteer-" + "core";
        const chromiumName = "@sparticuz/" + "chromium";
        const chromium = await (Function("m", "return import(m)"))(chromiumName);
        const pcore = await (Function("m", "return import(m)"))(pcoreName);

        const execPath = chromium && chromium.executablePath ? await chromium.executablePath() : undefined;
        if (!execPath) {
          return NextResponse.json({ error: "PDF export not available: Chromium executable path not found." }, { status: 501 });
        }
        const args = (chromium && chromium.args) || ["--no-sandbox", "--disable-setuid-sandbox"];

        browser = await pcore.launch({
          args,
          defaultViewport: { width: 1200, height: 800 },
          executablePath: execPath,
          headless: "new",
        });
      } catch (e) {
        return NextResponse.json(
          { error: "PDF export not available: missing serverless browser deps (puppeteer-core + @sparticuz/chromium)." },
          { status: 501 },
        );
      }
    } else {
      try {
        const puppeteer = await import("puppeteer");
        browser = await puppeteer.launch({ headless: "new", defaultViewport: { width: 1200, height: 800 } });
      } catch (e) {
        return NextResponse.json({ error: "PDF export not available: missing local browser deps (puppeteer)." }, { status: 501 });
      }
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    const fileName = `divided-${weekStartRaw}.pdf`;
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Divided PDF export failed", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
