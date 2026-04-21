import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canDownloadOnlineSummaryIndividual } from "@/lib/onlineSummaryIndividuals";
import type { TradingPeriod } from "@/lib/tradingPeriod";
import { getOnlineOpsWindowForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { resolveShopIdsForMarketplaceAccount } from "@/lib/marketplaceAccountShopResolve";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";

const money = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const formatKes = (value: number) =>
  `KES ${Math.round(value).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function renderHtml(args: {
  attendantName: string;
  attendantEmail: string;
  tradingPeriodLabel: string;
  fullWeeksLabel: string;
  fullWeeksKey: string;
  accountCount: number;
  weekCount: number;
  totalAmount: number;
  rows: Array<{
    platform: string;
    accountName: string;
    weekLabel: string;
    weekStart: string;
    manualAmount: number;
    profitAmount: number;
    usedAmount: number;
    source: string;
  }>;
  accountTotals: Array<{
    platform: string;
    accountName: string;
    total: number;
  }>;
}) {
  const weeklyRows = args.rows
    .map((row) => {
      return `
        <tr>
          <td>${escapeHtml(row.platform)}</td>
          <td>${escapeHtml(row.accountName)}</td>
          <td>${escapeHtml(row.weekLabel)}</td>
          <td>${escapeHtml(row.weekStart)}</td>
          <td class="num">${escapeHtml(formatKes(row.manualAmount))}</td>
          <td class="num">${escapeHtml(formatKes(row.profitAmount))}</td>
          <td class="num strong">${escapeHtml(formatKes(row.usedAmount))}</td>
          <td>${escapeHtml(row.source)}</td>
        </tr>
      `;
    })
    .join("\n");

  const accountTotalRows = args.accountTotals
    .map((row) => {
      return `
        <tr>
          <td>${escapeHtml(row.platform)}</td>
          <td>${escapeHtml(row.accountName)}</td>
          <td class="num strong">${escapeHtml(formatKes(row.total))}</td>
        </tr>
      `;
    })
    .join("\n");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Online performance report</title>
        <style>
          body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 24px; }
          h1, h2, h3, p { margin: 0; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
          .muted { color: #475569; }
          .pill { display: inline-block; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 999px; font-size: 12px; color: #334155; }
          .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
          .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; background: #f8fafc; }
          .label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; }
          .value { font-size: 22px; font-weight: 700; margin-top: 6px; }
          .section { margin-top: 22px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; font-size: 12px; vertical-align: top; }
          th { text-align: left; background: #f8fafc; }
          .num { text-align: right; white-space: nowrap; }
          .strong { font-weight: 700; }
          .note { margin-top: 12px; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Online performance report</h1>
            <p class="muted" style="margin-top: 4px;">${escapeHtml(args.attendantName)} • ${escapeHtml(args.attendantEmail)}</p>
            <p class="muted" style="margin-top: 4px;">Trading period: ${escapeHtml(args.tradingPeriodLabel)}</p>
            <p class="muted" style="margin-top: 4px;">Full weeks shown: ${escapeHtml(args.fullWeeksLabel)}</p>
          </div>
          <div class="pill">${escapeHtml(args.fullWeeksKey)}</div>
        </div>

        <div class="cards">
          <div class="card">
            <div class="label">Accounts</div>
            <div class="value">${escapeHtml(args.accountCount)}</div>
          </div>
          <div class="card">
            <div class="label">Weeks</div>
            <div class="value">${escapeHtml(args.weekCount)}</div>
          </div>
          <div class="card">
            <div class="label">Total Amount</div>
            <div class="value">${escapeHtml(formatKes(args.totalAmount))}</div>
          </div>
        </div>

        <div class="section">
          <h2>Account totals</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 110px;">Platform</th>
                <th>Account</th>
                <th class="num" style="width: 150px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${accountTotalRows || `<tr><td colspan="3" class="muted">No assigned accounts found in this period.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Weekly performance</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 110px;">Platform</th>
                <th>Account</th>
                <th>Week</th>
                <th style="width: 90px;">Start</th>
                <th class="num" style="width: 130px;">Manual</th>
                <th class="num" style="width: 140px;">Net payout</th>
                <th class="num" style="width: 130px;">Used</th>
                <th style="width: 130px;">Source</th>
              </tr>
            </thead>
            <tbody>
              ${weeklyRows || `<tr><td colspan="8" class="muted">No weekly performance rows found for this period.</td></tr>`}
            </tbody>
          </table>
        </div>

        <p class="note">
          This report includes only the last 4 full marketplace weeks inside the trading period. Used amount prefers manual weekly sale when present for a week; otherwise it falls back to marketplace account net payout.
        </p>
      </body>
    </html>
  `;
}

export async function generateOnlinePerformancePdfResponse(opts: {
  userId: string;
  period: TradingPeriod;
  enforceEligibleIndividual?: boolean;
}) {
  const { userId, period, enforceEligibleIndividual = false } = opts;
  const fullWeeksWindow = getOnlineOpsWindowForTradingPeriod(period, period.end, 4);
  const weeks = fullWeeksWindow.weeks;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (enforceEligibleIndividual && !canDownloadOnlineSummaryIndividual(user.email)) {
    return NextResponse.json({ error: "This export is only available for eligible individual attendants" }, { status: 403 });
  }

  const assignments = await prisma.marketplaceAccountAssignment.findMany({
    where: {
      attendantId: user.id,
      startsAt: { lte: period.end },
      OR: [{ endsAt: null }, { endsAt: { gte: period.start } }],
      account: { isActive: true },
    },
    select: {
      accountId: true,
      account: {
        select: {
          id: true,
          displayName: true,
          platform: true,
        },
      },
    },
    orderBy: [{ account: { platform: "asc" } }, { account: { displayName: "asc" } }],
  });

  const uniqueAccounts = Array.from(
    new Map(
      assignments
        .filter((assignment) => assignment.account)
        .map((assignment) => [
          assignment.accountId,
          {
            id: assignment.account!.id,
            displayName: assignment.account!.displayName ?? assignment.account!.id,
            platform: String(assignment.account!.platform),
          },
        ]),
    ).values(),
  );

  const accountShopPairs = await Promise.all(
    uniqueAccounts.map(async (account) => ({
      accountId: account.id,
      shopIds: await resolveShopIdsForMarketplaceAccount(account.id),
    })),
  );

  const shopToAccountId = new Map<string, string>();
  const allShopIds = new Set<string>();
  for (const pair of accountShopPairs) {
    for (const shopId of pair.shopIds) {
      shopToAccountId.set(shopId, pair.accountId);
      allShopIds.add(shopId);
    }
  }

  const [manualRows, profitRows] = await Promise.all([
    allShopIds.size
      ? prisma.weeklySale.groupBy({
          by: ["weekStart", "shopId"],
          _sum: { amount: true },
          where: {
            userId: user.id,
            shopId: { in: Array.from(allShopIds) },
            weekStart: { in: weeks.map((week) => week.weekStart) },
            status: { not: "REJECTED" },
          },
        })
      : Promise.resolve([]),
    uniqueAccounts.length
      ? prisma.marketplaceProfitEntry.groupBy({
          by: ["weekStart", "accountId"],
          _sum: { netPayout: true },
          where: {
            periodKey: period.key,
            accountId: { in: uniqueAccounts.map((account) => account.id) },
            weekStart: { in: weeks.map((week) => week.weekStart) },
          },
        })
      : Promise.resolve([]),
  ]);

  const manualByAccountWeek = new Map<string, number>();
  for (const row of manualRows) {
    const shopId = row.shopId ? String(row.shopId) : "";
    const accountId = shopToAccountId.get(shopId);
    if (!accountId) continue;
    const key = `${accountId}|${new Date(row.weekStart).toISOString()}`;
    manualByAccountWeek.set(key, (manualByAccountWeek.get(key) ?? 0) + money(row._sum?.amount));
  }

  const profitByAccountWeek = new Map<string, number>();
  for (const row of profitRows) {
    const key = `${String(row.accountId)}|${new Date(row.weekStart).toISOString()}`;
    profitByAccountWeek.set(key, money(row._sum?.netPayout));
  }

  const weeklyRows: Array<{
    platform: string;
    accountName: string;
    weekLabel: string;
    weekStart: string;
    manualAmount: number;
    profitAmount: number;
    usedAmount: number;
    source: string;
  }> = [];
  const accountTotals: Array<{ platform: string; accountName: string; total: number }> = [];
  let totalAmount = 0;

  for (const account of uniqueAccounts) {
    let accountTotal = 0;
    for (const week of weeks) {
      const weekIso = week.weekStart.toISOString();
      const lookupKey = `${account.id}|${weekIso}`;
      const manualAmount = manualByAccountWeek.get(lookupKey) ?? 0;
      const profitAmount = profitByAccountWeek.get(lookupKey) ?? 0;
      const usedAmount = manualAmount !== 0 ? manualAmount : profitAmount;
      const source = manualAmount !== 0 ? "Manual weekly sale" : profitAmount !== 0 ? "Account net payout" : "No data";

      accountTotal += usedAmount;
      weeklyRows.push({
        platform: account.platform,
        accountName: account.displayName,
        weekLabel: week.label,
        weekStart: week.startInput,
        manualAmount,
        profitAmount,
        usedAmount,
        source,
      });
    }
    accountTotals.push({
      platform: account.platform,
      accountName: account.displayName,
      total: accountTotal,
    });
    totalAmount += accountTotal;
  }

  const html = renderHtml({
    attendantName: user.name ?? user.email ?? user.id,
    attendantEmail: user.email ?? "",
    tradingPeriodLabel: period.label,
    fullWeeksLabel: fullWeeksWindow.label,
    fullWeeksKey: fullWeeksWindow.key,
    accountCount: uniqueAccounts.length,
    weekCount: weeks.length,
    totalAmount,
    rows: weeklyRows,
    accountTotals,
  });

  let browser: Awaited<ReturnType<typeof launchChromiumBrowser>> | null = null;
  try {
    let puppeteer: (typeof import("puppeteer")) | null = null;
    try {
      const mod = await import("puppeteer").catch(() => null);
      puppeteer = mod?.default ?? mod;
    } catch {
      puppeteer = null;
    }

    if (puppeteer) {
      try {
        browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1400, height: 900 } });
      } catch (puppeteerErr: unknown) {
        const msg = puppeteerErr instanceof Error ? puppeteerErr.message : String(puppeteerErr);
        const missingBrowser =
          /no executable was found/i.test(msg) ||
          /configured path/i.test(msg) ||
          /could not find chrome/i.test(msg);
        if (!missingBrowser) throw puppeteerErr;
        browser = await launchChromiumBrowser();
      }
    } else {
      browser = await launchChromiumBrowser();
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "18px", bottom: "18px", left: "18px", right: "18px" },
    });
    await browser.close();

    const safeName =
      `${user.name ?? user.email ?? user.id}`
        .trim()
        .replaceAll(/[^a-z0-9]+/gi, "-")
        .replaceAll(/-+/g, "-")
        .replaceAll(/(^-|-$)/g, "") || "individual";

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${safeName}-online-performance-${period.key}.pdf\"`,
        "Cache-Control": "no-store",
        "X-Receipt-Renderer": "pdf",
        "X-Receipt-Commit": process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
      },
    });
  } catch (err: unknown) {
    if (browser) await browser.close().catch(() => null);
    console.error("[online-summary-individual-export] failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to generate PDF", detail },
      { status: 500 },
    );
  }
}
