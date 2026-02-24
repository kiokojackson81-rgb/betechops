import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";

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
  periodLabel: string;
  periodStartIso: string;
  periodEndIso: string;
  letterheadUrl: string | null;
  totalsByShop: Array<{ platform: string; shopName: string; total: number }>;
  weeklyRows: Array<{ weekLabel: string; platform: string; shopName: string; amount: number; status: string }>;
  grandTotal: number;
  generatedAtIso: string;
}) {
  const letterheadBlock = opts.letterheadUrl
    ? `<div class="letterhead"><img src="${opts.letterheadUrl}" alt="Letterhead" /></div>`
    : "";

  const shopRows = opts.totalsByShop
    .map(
      (r) => `
      <tr>
        <td>${r.platform}</td>
        <td>${r.shopName}</td>
        <td style="text-align:right">${currency.format(r.total)}</td>
      </tr>`,
    )
    .join("\n");

  const weeklyRows = opts.weeklyRows
    .map(
      (r) => `
      <tr>
        <td>${r.weekLabel}</td>
        <td>${r.platform}</td>
        <td>${r.shopName}</td>
        <td style="text-align:right">${currency.format(r.amount)}</td>
        <td>${r.status}</td>
      </tr>`,
    )
    .join("\n");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${opts.title}</title>
      <style>
        @page { size: A4; margin: 22mm 14mm; }
        body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #0f172a; }
        h1 { font-size: 20px; margin: 10px 0 6px; }
        h2 { font-size: 14px; margin: 18px 0 8px; }
        .muted { color: #475569; font-size: 12px; }
        .summary { margin-top: 10px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
        .summary strong { color: #0f172a; }
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
        <div><strong>Grand total (manual weekly sales):</strong> ${currency.format(opts.grandTotal)}</div>
      </div>

      <h2>Totals by shop</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 90px">Platform</th>
            <th>Shop</th>
            <th class="right" style="width: 140px">Total</th>
          </tr>
        </thead>
        <tbody>
          ${shopRows || `<tr><td colspan="3" class="muted">No manual weekly sales found for this period.</td></tr>`}
        </tbody>
      </table>

      <h2>Weekly rows</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 180px">Week</th>
            <th style="width: 90px">Platform</th>
            <th>Shop</th>
            <th class="right" style="width: 140px">Amount</th>
            <th style="width: 110px">Status</th>
          </tr>
        </thead>
        <tbody>
          ${weeklyRows || `<tr><td colspan="5" class="muted">No weekly rows found for this period.</td></tr>`}
        </tbody>
      </table>
    </body>
  </html>
  `;
}

async function launchBrowser() {
  // Prefer full puppeteer (local/dev). If unavailable, attempt serverless
  // chrome-aws-lambda + puppeteer-core.
  let puppeteer: any = null;
  try {
    puppeteer = await import("puppeteer");
  } catch {
    puppeteer = null;
  }

  if (puppeteer) {
    return puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1200, height: 800 },
    });
  }

  try {
    const chromeModuleName = "chrome-" + "aws" + "-lambda";
    const puppeteerCoreName = "puppeteer-" + "core";
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const chromium = await (Function("m", "return import(m)"))(chromeModuleName);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pcore = await (Function("m", "return import(m)"))(puppeteerCoreName);

    const executablePathFn = chromium && chromium.executablePath ? chromium.executablePath : undefined;
    const args = (chromium && chromium.args) || ["--no-sandbox", "--disable-setuid-sandbox"];
    const execPath = executablePathFn ? await executablePathFn() : undefined;

    return pcore.launch({
      args,
      defaultViewport: { width: 1200, height: 800 },
      executablePath: execPath,
      headless: true,
    });
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const authz = await requireRole("ADMIN");
  if (!authz.ok) return authz.res;

  try {
    const url = new URL(req.url);
    const attendantId = (url.searchParams.get("attendantId") || "").trim();
    const periodKey = url.searchParams.get("periodKey") || undefined;
    if (!attendantId) {
      return NextResponse.json({ error: "Missing attendantId" }, { status: 400 });
    }

    const period = parseTradingPeriodKey(periodKey) ?? getTradingPeriodFor(new Date());
    const startIso = period.start.toISOString().slice(0, 10);
    const endIso = period.end.toISOString().slice(0, 10);

    const attendant = await prisma.user.findUnique({
      where: { id: attendantId },
      select: { id: true, name: true, email: true },
    });
    const attendantName = (attendant?.name ?? attendant?.email ?? attendantId).toString();

    const rows = await prisma.weeklySale.findMany({
      where: {
        userId: attendantId,
        source: "MANUAL",
        status: { not: "REJECTED" },
        AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
      },
      include: { shop: { select: { id: true, name: true } } },
      orderBy: [{ weekStart: "asc" }, { platform: "asc" }, { shopId: "asc" }],
    });

    const totalsByShopMap = new Map<string, { platform: string; shopName: string; total: number }>();
    const weeklyRows = rows.map((r) => {
      const shopName = (r.shop?.name ?? r.shopId ?? "Unassigned").toString();
      const platform = String(r.platform);
      const weekLabel = `${new Date(r.weekStart).toISOString().slice(0, 10)} – ${new Date(r.weekEnd).toISOString().slice(0, 10)}`;
      const amount = Number(r.amount ?? 0);
      const status = String(r.status ?? "");

      const shopKey = `${platform}|${shopName}`;
      if (!totalsByShopMap.has(shopKey)) {
        totalsByShopMap.set(shopKey, { platform, shopName, total: 0 });
      }
      totalsByShopMap.get(shopKey)!.total += amount;

      return { weekLabel, platform, shopName, amount, status };
    });

    const totalsByShop = Array.from(totalsByShopMap.values()).sort((a, b) => {
      if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
      return a.shopName.localeCompare(b.shopName);
    });
    const grandTotal = totalsByShop.reduce((sum, r) => sum + r.total, 0);

    const branding = await getBranding();
    const rawLetterhead = (branding as any)?.letterheadUrl ?? null;
    const letterheadUrl =
      rawLetterhead && typeof rawLetterhead === "string"
        ? rawLetterhead.startsWith("http")
          ? rawLetterhead
          : new URL(rawLetterhead, url).toString()
        : null;

    const title = `${attendantName} performance`;
    const html = renderHtml({
      title,
      periodLabel: period.label,
      periodStartIso: startIso,
      periodEndIso: endIso,
      letterheadUrl,
      totalsByShop,
      weeklyRows,
      grandTotal,
      generatedAtIso: new Date().toISOString(),
    });

    const browser = await launchBrowser();
    if (!browser) {
      return NextResponse.json(
        { error: "PDF export not available: missing optional browser dependencies (puppeteer or chrome-aws-lambda)." },
        { status: 501 },
      );
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    const filename = sanitizeFilename(`${attendantName} performance ${startIso} to ${endIso}.pdf`);
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[api/admin/online/attendant-performance-pdf] error", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

