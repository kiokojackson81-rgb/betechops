import { NextRequest, NextResponse } from "next/server";
import { requireRoleOrBenjamin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canonicalNairobiWeekStartUtc, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { Platform } from "@prisma/client";
import { isMarketplaceStatementDraftTableAvailable } from "@/lib/statementDraftTable";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGETS = [
  { key: "betech-store", label: "Betech Store", primary: "Betech Store", fallback: ["Betech"] },
  { key: "jude-collection", label: "Jude Collection", primary: "Jude Collection", fallback: ["Jude"] },
  { key: "hitech-power", label: "Hitech Power", primary: "Hitech Power", fallback: ["Hitech"] },
  { key: "jm-latest", label: "JM Latest Collections", primary: "JM Latest Collections", fallback: ["JM Collection", "JM Collections"] },
];

type AccountCandidate = {
  id: string;
  displayName: string | null;
  platform: Platform;
  jumiaShopSid: string | null;
};

type TargetResolved = {
  key: string;
  label: string;
  accountIds: string[];
  shopIds: string[];
};

function money(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNameForMatch(value: unknown): string {
  return normalize(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsNormalized(haystack: unknown, needle: unknown): boolean {
  const h = normalizeNameForMatch(haystack);
  const n = normalizeNameForMatch(needle);
  return Boolean(h && n && h.includes(n));
}

async function resolveShopForAccount(account: { platform: Platform; displayName: string | null; jumiaShopSid: string | null }) {
  const sid = normalize(account.jumiaShopSid);
  const name = normalize(account.displayName);
  const normalizedAccountName = normalizeNameForMatch(name);
  const shop =
    (sid
      ? await prisma.shop.findFirst({
          where: { platform: account.platform as any, jumiaShopSid: sid },
          select: { id: true, name: true },
        })
      : null) ??
    (sid
      ? await prisma.shop.findFirst({
          where: { platform: account.platform as any, apiConfig: { is: { apiKey: sid } } as any },
          select: { id: true, name: true },
        })
      : null) ??
    (name
      ? await prisma.shop.findFirst({
          where: { platform: account.platform as any, name: { equals: name, mode: "insensitive" } as any },
          select: { id: true, name: true },
        })
      : null);
  if (shop) return { id: shop.id, name: shop.name };

  if (!normalizedAccountName) return null;
  const allJumiaShops = await prisma.shop.findMany({
    where: { platform: account.platform as any },
    select: { id: true, name: true },
    take: 200,
  });
  const fallback =
    allJumiaShops.find((s) => normalizeNameForMatch(s.name) === normalizedAccountName) ??
    allJumiaShops.find((s) => {
      const n = normalizeNameForMatch(s.name);
      return n.includes(normalizedAccountName) || normalizedAccountName.includes(n);
    }) ??
    null;

  return fallback ? { id: fallback.id, name: fallback.name } : null;
}

function draftTxn(row: any): string {
  const direct = normalize(
    row?.itemCreditTxn ??
      row?.txn ??
      row?.transactionNumber ??
      row?.uniqueTxn ??
      row?.uniqueNumber ??
      row?.itemCreditTransaction,
  ).toLowerCase();
  if (direct) return direct;
  const fallback = [
    normalize(row?.orderNo ?? row?.orderId),
    normalize(row?.orderItemNo ?? row?.orderItemId),
    normalize(row?.dateUtc ?? row?.date),
    String(money(row?.netPayout)),
    normalize(row?.details ?? row?.productName),
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
  return fallback;
}

function summarizeDraftRows(rows: any[]): { dedupNet: number; returns: number; duplicateCount: number } {
  let dedupNet = 0;
  let returns = 0;
  let duplicateCount = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const net = money((row as any)?.netPayout);
    const txn = draftTxn(row);
    if (txn) {
      if (seen.has(txn)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(txn);
    }
    dedupNet += net;
    if (net < 0) returns += Math.abs(net);
  }
  return { dedupNet, returns, duplicateCount };
}

function summarizeProfitRows(rows: Array<{ itemCreditTxn: string; netPayout: number; buyingPrice: number; profit: number }>) {
  let net = 0;
  let buying = 0;
  let profit = 0;
  let duplicateCount = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const txn = normalize(row.itemCreditTxn).toLowerCase();
    if (txn) {
      if (seen.has(txn)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(txn);
    }
    net += money(row.netPayout);
    buying += money(row.buyingPrice);
    profit += money(row.profit);
  }
  return { net, buying, profit, duplicateCount };
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
      OR: TARGETS.flatMap((t) => [
        { displayName: { contains: t.primary, mode: "insensitive" } as any },
        ...t.fallback.map((m) => ({ displayName: { contains: m, mode: "insensitive" } as any })),
      ]),
    },
    select: { id: true, displayName: true, platform: true, jumiaShopSid: true },
  });
  const shops = await prisma.shop.findMany({
    where: { platform: "JUMIA" as any },
    select: { id: true, name: true },
    take: 400,
  });

  const targetResolved: TargetResolved[] = [];
  for (const t of TARGETS) {
    const primaryCandidates: AccountCandidate[] = accounts.filter((x) => containsNormalized(x.displayName, t.primary));
    const fallbackCandidates: AccountCandidate[] =
      primaryCandidates.length > 0
        ? primaryCandidates
        : accounts.filter((x) => t.fallback.some((m) => containsNormalized(x.displayName, m)));
    const candidates = fallbackCandidates;
    const accountIds = [...new Set(candidates.map((c) => c.id))];
    const shopIdsSet = new Set<string>();
    for (const candidate of candidates) {
      const shop = await resolveShopForAccount(candidate);
      if (shop?.id) shopIdsSet.add(shop.id);
    }
    const primaryShops = shops.filter((s) => containsNormalized(s.name, t.primary));
    const fallbackShops = primaryShops.length > 0 ? primaryShops : shops.filter((s) => t.fallback.some((m) => containsNormalized(s.name, m)));
    for (const s of fallbackShops) shopIdsSet.add(s.id);
    targetResolved.push({
      key: t.key,
      label: t.label,
      accountIds,
      shopIds: [...shopIdsSet],
    });
  }

  const allAccountIds = [...new Set(targetResolved.flatMap((t) => t.accountIds))];
  const allShopIds = [...new Set(targetResolved.flatMap((t) => t.shopIds))];

  const profitRows = allAccountIds.length
    ? await (prisma as any).marketplaceProfitEntry.findMany({
        where: { platform: "JUMIA", accountId: { in: allAccountIds }, weekStart, weekEnd },
        select: { accountId: true, itemCreditTxn: true, netPayout: true, buyingPrice: true, profit: true },
        take: 15000,
      })
    : [];
  const profitRowsByAccountId = new Map<string, Array<{ itemCreditTxn: string; netPayout: number; buyingPrice: number; profit: number }>>();
  for (const row of profitRows as any[]) {
    const key = String(row.accountId);
    if (!profitRowsByAccountId.has(key)) profitRowsByAccountId.set(key, []);
    profitRowsByAccountId.get(key)!.push({
      itemCreditTxn: String(row.itemCreditTxn ?? ""),
      netPayout: money(row.netPayout),
      buyingPrice: money(row.buyingPrice),
      profit: money(row.profit),
    });
  }

  const draftTableAvailable = await isMarketplaceStatementDraftTableAvailable();
  const draftMetricsByShopId = new Map<string, { dedupNet: number; returns: number; duplicateCount: number }>();
  if (draftTableAvailable && allShopIds.length) {
    const drafts = await prisma.marketplaceStatementDraft.findMany({
      where: { platform: "JUMIA", weekStart, weekEnd, shopId: { in: allShopIds } },
      orderBy: { updatedAt: "desc" },
      select: { shopId: true, rows: true },
      take: 200,
    });
    for (const d of drafts) {
      const sid = String(d.shopId);
      if (draftMetricsByShopId.has(sid)) continue;
      const rows = Array.isArray(d.rows) ? (d.rows as any[]) : [];
      draftMetricsByShopId.set(sid, summarizeDraftRows(rows));
    }
  }

  const accountsOut = targetResolved.map((target) => {
    const allProfitRowsForTarget = target.accountIds.flatMap((id) => profitRowsByAccountId.get(id) ?? []);
    const profitSummary = summarizeProfitRows(allProfitRowsForTarget);
    const draftCandidates = target.shopIds
      .map((sid) => draftMetricsByShopId.get(sid))
      .filter(Boolean) as Array<{ dedupNet: number; returns: number; duplicateCount: number }>;
    const draftSummary = draftCandidates.reduce(
      (acc, cur) => {
        acc.dedupNet += cur.dedupNet;
        acc.returns += cur.returns;
        acc.duplicateCount += cur.duplicateCount;
        return acc;
      },
      { dedupNet: 0, returns: 0, duplicateCount: 0 },
    );
    const hasDraft = draftCandidates.length > 0;
    const sales = hasDraft ? draftSummary.dedupNet : profitSummary.net;
    const returns = hasDraft ? draftSummary.returns : 0;
    const duplicates = (hasDraft ? draftSummary.duplicateCount : 0) + profitSummary.duplicateCount;
    return {
      key: target.key,
      label: target.label,
      salesNetPayout: sales,
      returns,
      duplicateCount: duplicates,
      grossProfit: profitSummary.profit + returns,
      profit: profitSummary.profit,
      buyingTotal: profitSummary.buying,
    };
  });

  const totals = accountsOut.reduce(
    (acc, r) => {
      acc.sales += r.salesNetPayout;
      acc.returns += r.returns;
      acc.grossProfit += r.grossProfit;
      acc.profit += r.profit;
      (acc as any).duplicates += Number(r.duplicateCount ?? 0);
      return acc;
    },
    { sales: 0, returns: 0, grossProfit: 0, profit: 0, duplicates: 0 },
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

function formatKes(n: number) {
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(Math.round(n));
}

async function buildPdf(opts: {
  weekStartInput: string;
  weekEnd: Date;
  accounts: any[];
  totals: any;
  deductions: { expenses: number; lowSellerScore: number; dividendRatePct: number; coopLoan: number; otherDeduction: number; mpesaTo0722: number };
  letterheadJpg: Uint8Array | null;
}) {
  const d = opts.deductions;
  const baseProfit = opts.totals.profit - d.expenses - d.lowSellerScore;
  const dividend = Math.max(0, (baseProfit * d.dividendRatePct) / 100);
  const balance = baseProfit - dividend - d.coopLoan - d.otherDeduction;
  const hitech = opts.accounts.find((a) => a.key === "hitech-power") ?? null;
  const hitechPayout = hitech ? Number(hitech.salesNetPayout ?? 0) : 0;
  const equity = hitechPayout - dividend - d.mpesaTo0722 - d.coopLoan - d.otherDeduction;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let cursorY = height - 28;
  const marginX = 36;

  if (opts.letterheadJpg) {
    try {
      const img = await pdf.embedJpg(opts.letterheadJpg);
      const targetW = width - marginX * 2;
      const scale = targetW / img.width;
      const targetH = img.height * scale;
      page.drawImage(img, { x: marginX, y: cursorY - targetH, width: targetW, height: targetH });
      cursorY = cursorY - targetH - 16;
    } catch {
      // ignore
    }
  }

  const weekEndInput = new Date(opts.weekEnd.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  page.drawText("Divided summary", { x: marginX, y: cursorY, size: 16, font: fontBold, color: rgb(0.05, 0.09, 0.17) });
  cursorY -= 18;
  page.drawText(`Week: ${opts.weekStartInput} - ${weekEndInput}`, {
    x: marginX,
    y: cursorY,
    size: 10,
    font,
    color: rgb(0.29, 0.35, 0.45),
  });
  cursorY -= 18;

  // Table
  const col = {
    account: marginX,
    sales: width - marginX - 220,
    returns: width - marginX - 160,
    gross: width - marginX - 100,
    profit: width - marginX - 40,
  };

  const headerY = cursorY;
  page.drawLine({ start: { x: marginX, y: headerY - 6 }, end: { x: width - marginX, y: headerY - 6 }, thickness: 1, color: rgb(0.88, 0.91, 0.94) });
  page.drawText("Account", { x: col.account, y: headerY, size: 9, font: fontBold, color: rgb(0.39, 0.45, 0.55) });
  page.drawText("Sales", { x: col.sales, y: headerY, size: 9, font: fontBold, color: rgb(0.39, 0.45, 0.55) });
  page.drawText("Returns", { x: col.returns, y: headerY, size: 9, font: fontBold, color: rgb(0.39, 0.45, 0.55) });
  page.drawText("Gross", { x: col.gross, y: headerY, size: 9, font: fontBold, color: rgb(0.39, 0.45, 0.55) });
  page.drawText("Profit", { x: col.profit, y: headerY, size: 9, font: fontBold, color: rgb(0.39, 0.45, 0.55) });
  cursorY -= 20;

  const rowH = 16;
  for (const a of opts.accounts) {
    page.drawText(String(a.label ?? ""), { x: col.account, y: cursorY, size: 10, font: fontBold, color: rgb(0.05, 0.09, 0.17) });
    page.drawText(formatKes(Number(a.salesNetPayout ?? 0)), { x: col.sales, y: cursorY, size: 10, font, color: rgb(0.05, 0.45, 0.34) });
    page.drawText(formatKes(Number(a.returns ?? 0)), { x: col.returns, y: cursorY, size: 10, font, color: rgb(0.05, 0.09, 0.17) });
    page.drawText(formatKes(Number(a.grossProfit ?? 0)), { x: col.gross, y: cursorY, size: 10, font, color: rgb(0.05, 0.09, 0.17) });
    page.drawText(formatKes(Number(a.profit ?? 0)), { x: col.profit, y: cursorY, size: 10, font, color: rgb(0.05, 0.09, 0.17) });
    cursorY -= rowH;
  }

  cursorY -= 4;
  page.drawLine({ start: { x: marginX, y: cursorY + 10 }, end: { x: width - marginX, y: cursorY + 10 }, thickness: 1, color: rgb(0.88, 0.91, 0.94) });
  page.drawText("Totals", { x: col.account, y: cursorY, size: 10, font: fontBold, color: rgb(0.05, 0.09, 0.17) });
  page.drawText(formatKes(Number(opts.totals.sales ?? 0)), { x: col.sales, y: cursorY, size: 10, font: fontBold, color: rgb(0.05, 0.45, 0.34) });
  page.drawText(formatKes(Number(opts.totals.returns ?? 0)), { x: col.returns, y: cursorY, size: 10, font, color: rgb(0.05, 0.09, 0.17) });
  page.drawText(formatKes(Number(opts.totals.grossProfit ?? 0)), { x: col.gross, y: cursorY, size: 10, font, color: rgb(0.05, 0.09, 0.17) });
  page.drawText(formatKes(Number(opts.totals.profit ?? 0)), { x: col.profit, y: cursorY, size: 10, font: fontBold, color: rgb(0.05, 0.09, 0.17) });
  cursorY -= 28;

  // Cards
  const cardW = (width - marginX * 2 - 12) / 2;
  const cardH = 160;
  const cardY = cursorY - cardH;

  const drawCard = (x: number, title: string, lines: Array<[string, string, "pos" | "neg" | "normal"]>) => {
    page.drawRectangle({ x, y: cardY, width: cardW, height: cardH, borderColor: rgb(0.88, 0.91, 0.94), borderWidth: 1 });
    page.drawText(title, { x: x + 10, y: cardY + cardH - 18, size: 10, font: fontBold, color: rgb(0.39, 0.45, 0.55) });
    let y = cardY + cardH - 36;
    for (const [k, v, tone] of lines) {
      page.drawText(k, { x: x + 10, y, size: 10, font, color: rgb(0.29, 0.35, 0.45) });
      const c = tone === "pos" ? rgb(0.05, 0.45, 0.34) : tone === "neg" ? rgb(0.74, 0.07, 0.23) : rgb(0.05, 0.09, 0.17);
      page.drawText(v, { x: x + cardW - 10 - font.widthOfTextAtSize(v, 10), y, size: 10, font: tone === "pos" ? fontBold : font, color: c });
      y -= 16;
    }
  };

  drawCard(marginX, "Divided", [
    ["Expenses", formatKes(d.expenses), "normal"],
    ["Low seller score", formatKes(d.lowSellerScore), "normal"],
    ["Base profit", formatKes(baseProfit), "normal"],
    [`Divided (${d.dividendRatePct}%)`, formatKes(dividend), "pos"],
    ["Coop loan", formatKes(d.coopLoan), "normal"],
    ["Other deduction", formatKes(d.otherDeduction), "normal"],
    ["Balance", formatKes(balance), "normal"],
  ]);

  drawCard(marginX + cardW + 12, "Hitech payout instruction", [
    ["Hitech payout", formatKes(hitechPayout), "normal"],
    ["Less divided", `- ${formatKes(dividend)}`, "neg"],
    ["Send to 0722151083", `- ${formatKes(d.mpesaTo0722)}`, "neg"],
    ["Less other deductions", `- ${formatKes(d.coopLoan + d.otherDeduction)}`, "neg"],
    ["Send to Equity", formatKes(equity), "pos"],
  ]);

  return pdf.save();
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

    let letterheadBuf: Uint8Array | null = null;
    try {
      const filePath = path.join(process.cwd(), "public", "letterhead.jpg");
      const buf = await readFile(filePath);
      letterheadBuf = new Uint8Array(buf);
    } catch {
      letterheadBuf = null;
    }

    const pdfBytes = await buildPdf({
      weekStartInput: weekStartRaw,
      weekEnd,
      accounts: data.accounts,
      totals: data.totals,
      deductions,
      letterheadJpg: letterheadBuf,
    });

    const fileName = `divided-${weekStartRaw}.pdf`;
    return new Response(Buffer.from(pdfBytes), {
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
