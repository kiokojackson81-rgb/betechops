import { NextResponse } from "next/server";
import { getMarketingReport } from "@/lib/marketingReport";
import { requireRole } from "@/lib/api";

// This route will attempt to dynamically import a headless chrome launcher
// (chrome-aws-lambda + puppeteer-core) at runtime. If those packages are not
// installed the route returns a 501 with instructions. This lets the repo
// build without the heavy browser deps while enabling a straightforward
// integration when you install them.

function renderHtml(report: any) {
  const period = report.aggregates.period;
  const title = `Marketing report: ${period.name || period.key} (${new Date(period.start).toISOString().slice(0,10)} - ${new Date(period.end).toISOString().slice(0,10)})`;
  const rows = report.entries
    .map((e: any) => `
      <tr>
        <td>${new Date(e.date).toISOString().slice(0,10)}</td>
        <td style="text-align:right">${e.totalSales.toFixed(2)}</td>
        <td style="text-align:right">${e.totalProfit.toFixed(2)}</td>
        <td style="text-align:right">${(e.receipts? e.receipts.reduce((s:any,r:any)=>s+(r.items?.length||0),0) : (e.sales||[]).reduce((s:any, x:any)=>s+((x as any).itemsCount||1),0)).toString()}</td>
      </tr>`)
    .join('\n');

  return `
  <html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #111827; }
      table { width:100%; border-collapse: collapse; }
      th, td { padding: 8px 6px; border-bottom: 1px solid #e5e7eb; }
      th { text-align:left; background:#f8fafc; }
      .summary { margin-top: 16px; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <div class="summary">
      <strong>Total sales:</strong> ${report.aggregates.totalSales.toFixed(2)}<br/>
      <strong>Total profit:</strong> ${report.aggregates.totalProfit.toFixed(2)}<br/>
      <strong>Total items:</strong> ${report.aggregates.totalItems}
    </div>
    <h2 style="margin-top:18px">Daily rows</h2>
    <table>
      <thead>
        <tr><th>Date</th><th style="text-align:right">Sales</th><th style="text-align:right">Profit</th><th style="text-align:right">Items</th></tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </body>
  </html>
  `;
}

export async function GET(req: Request) {
  const authz = await requireRole("ADMIN");
  if (!authz.ok) return authz.res;

  try {
    const url = new URL(req.url);
    const tradingPeriodKey = url.searchParams.get("tradingPeriodKey") || undefined;

    const report = await getMarketingReport({ tradingPeriodKey });

    // Prefer the full `puppeteer` package for local/dev use (it includes
    // a Chromium binary). If it's not available, fall back to the serverless
    // combo `chrome-aws-lambda` + `puppeteer-core`.
    let puppeteer: any = null;
    let chromium: any = null;
    let browser: any = null;
    const html = renderHtml(report);

    // try puppeteer first (local dev). Use a guarded dynamic import so the
    // route still builds when the package is not installed.
    try {
      // prefer full puppeteer (includes a Chromium binary)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      puppeteer = await import("puppeteer");
    } catch (e) {
      puppeteer = null;
    }

    if (puppeteer) {
      browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1200, height: 800 } });
    } else {
      // fallback to chrome-aws-lambda + puppeteer-core for serverless
      try {
        // fallback to chrome-aws-lambda + puppeteer-core for serverless
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        chromium = await import("chrome-aws-lambda");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const pcore = await import("puppeteer-core");
        const executablePath = (chromium && (await chromium.executablePath)) || undefined;
        const args = (chromium && chromium.args) || ["--no-sandbox", "--disable-setuid-sandbox"];
        browser = await pcore.launch({
          args,
          defaultViewport: { width: 1200, height: 800 },
          executablePath: await (executablePath ? executablePath() : Promise.resolve(undefined)),
          headless: true,
        });
      } catch (e) {
        // Optional runtime packages are missing — return 501 with guidance
        return NextResponse.json(
          { error: "PDF export not available: missing optional browser dependencies (puppeteer or chrome-aws-lambda)." },
          { status: 501 }
        );
      }
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="marketing-report-${tradingPeriodKey || "period"}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("PDF export failed", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
