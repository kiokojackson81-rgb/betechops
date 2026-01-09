"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const marketingReport_1 = require("@/lib/marketingReport");
const api_1 = require("@/lib/api");
// This route will attempt to dynamically import a headless chrome launcher
// (chrome-aws-lambda + puppeteer-core) at runtime. If those packages are not
// installed the route returns a 501 with instructions. This lets the repo
// build without the heavy browser deps while enabling a straightforward
// integration when you install them.
function renderHtml(report) {
    const period = report.aggregates.period;
    const title = `Marketing report: ${period.name || period.key} (${new Date(period.start).toISOString().slice(0, 10)} - ${new Date(period.end).toISOString().slice(0, 10)})`;
    const rows = report.entries
        .map((e) => `
      <tr>
        <td>${new Date(e.date).toISOString().slice(0, 10)}</td>
        <td style="text-align:right">${e.totalSales.toFixed(2)}</td>
        <td style="text-align:right">${e.totalProfit.toFixed(2)}</td>
        <td style="text-align:right">${(e.receipts ? e.receipts.reduce((s, r) => s + (r.items?.length || 0), 0) : (e.sales || []).reduce((s, x) => s + (x.itemsCount || 1), 0)).toString()}</td>
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
async function GET(req) {
    const authz = await (0, api_1.requireRole)("ADMIN");
    if (!authz.ok)
        return authz.res;
    try {
        const url = new URL(req.url);
        const tradingPeriodKey = url.searchParams.get("tradingPeriodKey") || undefined;
        const report = await (0, marketingReport_1.getMarketingReport)({ tradingPeriodKey });
        // Prefer the full `puppeteer` package for local/dev use (it includes
        // a Chromium binary). If it's not available, fall back to the serverless
        // combo `chrome-aws-lambda` + `puppeteer-core`.
        let puppeteer = null;
        let chromium = null;
        let browser = null;
        const html = renderHtml(report);
        // try puppeteer first (local dev). Use a guarded dynamic import so the
        // route still builds when the package is not installed.
        try {
            // prefer full puppeteer (includes a Chromium binary)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            puppeteer = await Promise.resolve().then(() => __importStar(require("puppeteer")));
        }
        catch (e) {
            puppeteer = null;
        }
        if (puppeteer) {
            browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1200, height: 800 } });
        }
        else {
            // fallback to chrome-aws-lambda + puppeteer-core for serverless
            try {
                // Build the module names dynamically to avoid bundlers statically
                // resolving the optional packages during build time. This prevents
                // Turbopack from failing when the optional serverless chrome libs
                // are not present in the environment.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                // e.g. import("chrome-aws-lambda") -> import("chrome-" + "aws" + "-lambda")
                const chromeModuleName = "chrome-" + "aws" + "-lambda";
                const puppeteerCoreName = "puppeteer-" + "core";
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                chromium = await (Function("m", "return import(m)"))(chromeModuleName);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const pcore = await (Function("m", "return import(m)"))(puppeteerCoreName);
                // chrome-aws-lambda exposes an async executablePath() function and
                // an args array. Guard access safely.
                const executablePathFn = chromium && chromium.executablePath ? chromium.executablePath : undefined;
                const args = (chromium && chromium.args) || ["--no-sandbox", "--disable-setuid-sandbox"];
                const execPath = executablePathFn ? await executablePathFn() : undefined;
                browser = await pcore.launch({
                    args,
                    defaultViewport: { width: 1200, height: 800 },
                    executablePath: execPath,
                    headless: true,
                });
            }
            catch (e) {
                // Optional runtime packages are missing — return 501 with guidance
                return server_1.NextResponse.json({ error: "PDF export not available: missing optional browser dependencies (puppeteer or chrome-aws-lambda)." }, { status: 501 });
            }
        }
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
        await browser.close();
        const res = new Response(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="marketing-report-${tradingPeriodKey || "period"}.pdf"`,
                "Cache-Control": "no-store",
                "X-Receipt-Renderer": "pdf",
                "X-Receipt-Commit": process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
            },
        });
        return res;
    }
    catch (err) {
        console.error("PDF export failed", err);
        return server_1.NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
    }
}
