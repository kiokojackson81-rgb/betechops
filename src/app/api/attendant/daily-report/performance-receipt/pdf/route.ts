import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { resolveTargetUserId } from "@/lib/resolveTargetUser";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import getAttendantCommissionSummary from "@/lib/attendantCommission";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { normalizePaymentMethod, normalizeReceiptNumber } from "@/lib/receiptKey";
import {
  computeJenifferProratedCommission,
  computeSalesCommissionFromTiers,
  getOrCreateCommissionPeriod,
} from "@/lib/commission";
import {
  computeBrendahDirectCommission,
  computeDirectProfitShareCommission,
  resolveDirectCommissionMode,
  resolveOnlinePosOwnershipMode,
} from "@/lib/onlineCommission";
import { getAssignedMarketplaceSalesForPeriod, getOnlineEarningsSummary } from "@/lib/onlineOps";
import { getOnlineOpsWindowForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { getUserCommissionConfigLike } from "@/lib/userCommissionConfig";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import {
  getReleasedPosCommissionEffectiveAt,
  isPosProductCommissionEntry,
} from "@/lib/posProductCommission";

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
    items?: Array<{
      quantity?: number | null;
      sellingPrice?: number | null;
      orderCosts?: Array<{ unitCost?: unknown } | null> | null;
      profitSnapshots?: Array<{ profit?: unknown; unitCost?: unknown; qty?: unknown } | null> | null;
      product?: { lastBuyingPrice?: unknown } | null;
    }>;
  } | null;
};

type LedgerReceiptRow = {
  id: string;
  createdAt: Date;
  receiptNumber: string | null;
  receiptKey?: string | null;
  sellingTotal: number;
  buyingTotal?: number | null;
  paymentMethod: "MPESA" | "CASH";
  items?: Array<{ buyingPrice: number | null }>;
};

type PerformanceReceiptRow = {
  dateIso: string;
  sortAt: string;
  receiptNumber: string;
  amount: number;
  itemCount: number;
  profit: number;
  paymentMethod: "MPESA" | "CASH";
  status: string;
  commissionImpact: number;
  productCommission: number;
};

type PosProductCommissionRow = {
  id: string;
  amount: unknown;
  basis?: string | null;
  calcDetail?: unknown;
  createdAt?: Date | null;
  orderItem?: {
    quantity?: number | null;
    sellingPrice?: number | null;
    product?: { name?: string | null; sku?: string | null } | null;
    order?: {
      orderNumber?: string | null;
      totalAmount?: number | null;
      createdAt?: Date | null;
      receipt?: { receiptNumber?: string | null; generatedAt?: Date | null; createdAt?: Date | null } | null;
    } | null;
  } | null;
};

type PerformanceSummaryLine = {
  label: string;
  sales: number;
  commission: number;
  note: string;
};

type PosReceiptPeriodSummary = Awaited<ReturnType<typeof summarizePosReceiptsForPeriod>>;

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

async function resolveLetterheadDataUri(): Promise<string | null> {
  const candidates = [
    path.join(process.cwd(), "public", "letterhead.jpg"),
    path.join(process.cwd(), "letterhead.jpg"),
    path.join(process.cwd(), "public", "letterhead.jpeg"),
    path.join(process.cwd(), "letterhead.jpeg"),
    path.join(process.cwd(), "public", "letterhead.png"),
    path.join(process.cwd(), "letterhead.png"),
  ];

  for (const absPath of candidates) {
    try {
      const buf = await fs.readFile(absPath);
      const ext = path.extname(absPath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : "image/jpeg";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      // try next
    }
  }
  return null;
}

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

const extractReceiptProfit = (row: PosReceiptRow, sales: number) => {
  const totals = row.totals ?? {};
  const data = row.data ?? {};
  const explicitProfit = toNumber((totals as any).profit) || toNumber((data as any).profit);
  if (explicitProfit !== 0) return explicitProfit;

  const buyingTotal = toNumber((totals as any).buyingTotal) || toNumber((data as any).buyingTotal);
  if (buyingTotal > 0) return sales - buyingTotal;

  const items = row.order?.items ?? [];
  if (items.length > 0) {
    const snapshotProfit = items.reduce((sum, item) => {
      const latest = Array.isArray(item?.profitSnapshots) ? item.profitSnapshots[0] : null;
      return sum + toNumber(latest?.profit);
    }, 0);
    if (snapshotProfit !== 0) return snapshotProfit;

    const itemBuyingTotal = items.reduce((sum, item) => {
      const qty = Math.max(1, Math.trunc(toNumber(item?.quantity) || 1));
      const costs = Array.isArray(item?.orderCosts) ? item.orderCosts : [];
      const explicitUnitCost = costs.reduce((costSum, cost) => costSum + toNumber(cost?.unitCost), 0);
      const latest = Array.isArray(item?.profitSnapshots) ? item.profitSnapshots[0] : null;
      const snapshotUnitCost = toNumber(latest?.unitCost);
      const productLastBuying = toNumber(item?.product?.lastBuyingPrice);
      const unitCost =
        explicitUnitCost > 0 ? explicitUnitCost : snapshotUnitCost > 0 ? snapshotUnitCost : productLastBuying;
      return sum + unitCost * qty;
    }, 0);
    if (itemBuyingTotal > 0) return sales - itemBuyingTotal;
  }

  return 0;
};

const resolveLedgerReceiptProfit = (entry: LedgerReceiptRow) => {
  const sellingTotal = Number(entry.sellingTotal ?? 0);
  const aggregateBuying = Number(entry.buyingTotal ?? 0);
  const itemBuying = Array.isArray(entry.items)
    ? entry.items.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0)
    : 0;
  const buyingTotal = aggregateBuying > 0 ? aggregateBuying : itemBuying;
  if (buyingTotal <= 0) return 0;
  return sellingTotal - buyingTotal;
};

const applyProfitFallback = (row: PerformanceReceiptRow, profit: number) => {
  if (profit > 0 || row.profit <= 0) {
    row.profit = profit;
  }
};

async function getReceiptProfitFallbacks(args: {
  userId: string;
  start: Date;
  end: Date;
  receiptNumbers: string[];
}) {
  const variants = Array.from(
    new Set(
      args.receiptNumbers
        .flatMap((value) => [value, normalizeReceiptNumber(value)])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
  const profitByReceipt = new Map<string, number>();
  if (variants.length === 0) return profitByReceipt;

  const addProfit = (receiptNumber: string | null | undefined, profit: number) => {
    const canonical = normalizeReceiptNumber(receiptNumber);
    if (!canonical || !Number.isFinite(profit) || profit <= 0) return;
    profitByReceipt.set(canonical, Math.max(profitByReceipt.get(canonical) ?? 0, profit));
  };

  const [marketingSales, supportSales, marketingReceipts, supportReceipts] = await Promise.all([
    prisma.marketingSale.findMany({
      where: {
        receiptNumber: { in: variants },
        entry: { submittedById: args.userId, date: { gte: args.start, lte: args.end } },
      },
      select: { receiptNumber: true, sellingPrice: true, buyingPrice: true },
    }),
    prisma.supportSale.findMany({
      where: {
        receiptNumber: { in: variants },
        entry: { submittedById: args.userId, date: { gte: args.start, lte: args.end } },
      },
      select: { receiptNumber: true, sellingPrice: true, buyingPrice: true },
    }),
    prisma.marketingReceipt.findMany({
      where: {
        OR: [{ receiptNumber: { in: variants } }, { receiptKey: { in: variants } }],
        dailyEntry: { submittedById: args.userId, date: { gte: args.start, lte: args.end } },
      },
      select: {
        receiptNumber: true,
        receiptKey: true,
        sellingTotal: true,
        buyingTotal: true,
        items: { select: { buyingPrice: true } },
      },
    }),
    prisma.supportReceipt.findMany({
      where: {
        OR: [{ receiptNumber: { in: variants } }, { receiptKey: { in: variants } }],
        dailyEntry: { submittedById: args.userId, date: { gte: args.start, lte: args.end } },
      },
      select: {
        receiptNumber: true,
        receiptKey: true,
        sellingTotal: true,
        buyingTotal: true,
        items: { select: { buyingPrice: true } },
      },
    }),
  ]);

  const salesProfitByReceipt = new Map<string, number>();
  for (const sale of [...marketingSales, ...supportSales]) {
    const canonical = normalizeReceiptNumber(sale.receiptNumber);
    const buying = Number(sale.buyingPrice ?? 0);
    if (!canonical || buying <= 0) continue;
    salesProfitByReceipt.set(
      canonical,
      (salesProfitByReceipt.get(canonical) ?? 0) + (Number(sale.sellingPrice ?? 0) - buying),
    );
  }
  for (const [receiptNumber, profit] of salesProfitByReceipt.entries()) {
    addProfit(receiptNumber, profit);
  }

  for (const receipt of [...marketingReceipts, ...supportReceipts]) {
    const aggregateBuying = Number(receipt.buyingTotal ?? 0);
    const itemBuying = receipt.items.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0);
    const buyingTotal = aggregateBuying > 0 ? aggregateBuying : itemBuying;
    if (buyingTotal <= 0) continue;
    const profit = Number(receipt.sellingTotal ?? 0) - buyingTotal;
    addProfit(receipt.receiptNumber, profit);
    addProfit(receipt.receiptKey, profit);
  }

  return profitByReceipt;
}

function computeReceiptCommissionForTotals(args: {
  attendantEmail?: string | null;
  salesCommissionMode: string;
  totalSales: number;
  totalProfit: number;
  tiers: { minSales: number; maxSales: number; payoutFlat: number }[];
}) {
  const directMode = resolveDirectCommissionMode(args.attendantEmail);
  if (directMode === "PROFIT_10") {
    return computeDirectProfitShareCommission(args.totalSales, args.totalProfit, 0.1).amount;
  }
  if (directMode === "BRENDAH" || args.salesCommissionMode === "BRENDAH_DIRECT") {
    return computeBrendahDirectCommission(args.totalSales, args.totalProfit).amount;
  }
  if (args.salesCommissionMode === "JENIFFER_PRORATED") {
    return Math.round(computeJenifferProratedCommission(args.totalSales, args.tiers).commission);
  }
  return Math.round(
    computeSalesCommissionFromTiers(
      args.totalSales,
      args.totalProfit,
      args.tiers,
      args.totalProfit > 0 ? 0.05 : 0,
    ),
  );
}

function attachReceiptCommissionImpact(args: {
  rows: PerformanceReceiptRow[];
  attendantEmail?: string | null;
  salesCommissionMode: string;
  tiers: { minSales: number; maxSales: number; payoutFlat: number }[];
}) {
  if (args.salesCommissionMode === "POS_PROFIT_10") {
    return args.rows.map((row) => ({
      ...row,
      commissionImpact: Math.round(Math.max(0, Number(row.profit ?? 0)) * 0.1),
    }));
  }

  const chronological = [...args.rows].sort((a, b) => {
    const dateCompare = a.sortAt.localeCompare(b.sortAt);
    if (dateCompare !== 0) return dateCompare;
    return a.receiptNumber.localeCompare(b.receiptNumber);
  });

  let cumulativeSales = 0;
  let cumulativeProfit = 0;
  let previousCommission = 0;
  const impactByKey = new Map<string, number>();

  for (const row of chronological) {
    cumulativeSales += Math.max(0, Number(row.amount ?? 0));
    cumulativeProfit += Number(row.profit ?? 0);
    const nextCommission = computeReceiptCommissionForTotals({
      attendantEmail: args.attendantEmail,
      salesCommissionMode: args.salesCommissionMode,
      totalSales: cumulativeSales,
      totalProfit: cumulativeProfit,
      tiers: args.tiers,
    });
    const impact = Math.max(0, nextCommission - previousCommission);
    previousCommission = nextCommission;
    impactByKey.set(`${row.sortAt}|${row.receiptNumber}|${row.paymentMethod}`, impact);
  }

  return args.rows.map((row) => ({
    ...row,
    commissionImpact: impactByKey.get(`${row.sortAt}|${row.receiptNumber}|${row.paymentMethod}`) ?? 0,
  }));
}

const releasedProductCommissionStatuses = ["RELEASED", "APPROVED"];

async function getPosProductCommissionsForPdf(args: {
  userId: string;
  start: Date;
  end: Date;
}) {
  const rows = (await prisma.commissionEarning.findMany({
    where: {
      staffId: args.userId,
      status: { in: releasedProductCommissionStatuses },
      basis: "product_flat",
    },
    include: {
      orderItem: {
        include: {
          product: { select: { name: true, sku: true } },
          order: {
            select: {
              orderNumber: true,
              totalAmount: true,
              createdAt: true,
              receipt: { select: { receiptNumber: true, generatedAt: true, createdAt: true } },
            },
          },
        },
      },
    },
  })) as PosProductCommissionRow[];

  const byReceipt = new Map<
    string,
    {
      receiptNumber: string;
      sortAt: string;
      dateIso: string;
      amount: number;
      orderTotal: number;
      products: string[];
    }
  >();

  for (const row of rows) {
    if (!isPosProductCommissionEntry(row)) continue;
    const effectiveAt = getReleasedPosCommissionEffectiveAt(row);
    if (!effectiveAt) continue;
    const effectiveTime = effectiveAt.getTime();
    if (effectiveTime < args.start.getTime() || effectiveTime > args.end.getTime()) continue;

    const order = row.orderItem?.order;
    const receiptNumber = order?.receipt?.receiptNumber || order?.orderNumber || "";
    const canonical = normalizeReceiptNumber(receiptNumber);
    if (!canonical) continue;

    const sortDate = order?.receipt?.generatedAt ?? order?.receipt?.createdAt ?? order?.createdAt ?? effectiveAt;
    const productName = row.orderItem?.product?.name || row.orderItem?.product?.sku || "POS product";
    const amount = Number(row.amount ?? 0);
    const existing = byReceipt.get(canonical);
    if (existing) {
      existing.amount += amount;
      if (!existing.products.includes(productName)) existing.products.push(productName);
      existing.orderTotal = Math.max(existing.orderTotal, Number(order?.totalAmount ?? 0));
      continue;
    }

    byReceipt.set(canonical, {
      receiptNumber,
      sortAt: sortDate.toISOString(),
      dateIso: sortDate.toISOString().slice(0, 10),
      amount,
      orderTotal: Number(order?.totalAmount ?? 0),
      products: [productName],
    });
  }

  return byReceipt;
}

function splitMarketplaceCommissionBySales(args: {
  jumiaSales: number;
  kilimallSales: number;
  jumiaCommission: number;
  kilimallCommission: number;
  totalMarketplaceCommission: number;
}) {
  const explicitJumia = Number(args.jumiaCommission ?? 0);
  const explicitKilimall = Number(args.kilimallCommission ?? 0);
  if (explicitJumia > 0 || explicitKilimall > 0) {
    return { jumiaCommission: explicitJumia, kilimallCommission: explicitKilimall };
  }

  const totalSales = Math.max(0, args.jumiaSales) + Math.max(0, args.kilimallSales);
  const totalCommission = Math.max(0, Number(args.totalMarketplaceCommission ?? 0));
  if (totalSales <= 0 || totalCommission <= 0) {
    return { jumiaCommission: 0, kilimallCommission: 0 };
  }
  if (args.jumiaSales <= 0) {
    return { jumiaCommission: 0, kilimallCommission: Math.round(totalCommission) };
  }
  if (args.kilimallSales <= 0) {
    return { jumiaCommission: Math.round(totalCommission), kilimallCommission: 0 };
  }

  const jumiaCommission = Math.round((Math.max(0, args.jumiaSales) / totalSales) * totalCommission);
  return {
    jumiaCommission,
    kilimallCommission: Math.round(totalCommission) - jumiaCommission,
  };
}

async function getPerformanceSummaryLines(args: {
  userId: string;
  period: { key: string; label: string; start: Date; end: Date };
  attendantCategory?: string | null;
  payrollRow: Awaited<ReturnType<typeof buildPayrollRow>> | null;
  onlinePosSummary?: PosReceiptPeriodSummary | null;
}) {
  const directLine: PerformanceSummaryLine = {
    label: "POS direct sales",
    sales: Number(args.payrollRow?.totalSales ?? 0),
    commission: Number(args.payrollRow?.commissionDirect ?? 0),
    note: "POS receipts and direct-sales commission",
  };

  const isOnlineCategory =
    args.attendantCategory === "JUMIA_KILIMALL_OPS" || args.attendantCategory === "BETECH_OPS";
  if (!isOnlineCategory) {
    return directLine.sales > 0 || directLine.commission > 0 ? [directLine] : [];
  }

  if (args.onlinePosSummary) {
    directLine.sales = Number(args.onlinePosSummary.totalSales ?? 0);
    directLine.note = `${Number(args.onlinePosSummary.totalReceipts ?? 0)} POS receipts / ${Number(
      args.onlinePosSummary.totalItems ?? 0,
    )} POS items`;
  }

  const marketplaceWindow = getOnlineOpsWindowForTradingPeriod(args.period, new Date(), 4);
  const [onlineSummary, marketplaceSales] = await Promise.all([
    getOnlineEarningsSummary(args.userId, { period: args.period }),
    getAssignedMarketplaceSalesForPeriod(args.userId, {
      key: marketplaceWindow.key,
      label: marketplaceWindow.label,
      start: marketplaceWindow.start,
      end: marketplaceWindow.end,
    }),
  ]);

  const jumiaSales = Number(marketplaceSales.totals.jumiaSales ?? 0);
  const kilimallSales = Number(marketplaceSales.totals.kilimallSales ?? 0);
  const jumiaOrders = marketplaceSales.rows
    .filter((row) => row.platform === "JUMIA")
    .reduce((sum, row) => sum + Number(row.orders ?? 0), 0);
  const kilimallOrders = marketplaceSales.rows
    .filter((row) => row.platform === "KILIMALL")
    .reduce((sum, row) => sum + Number(row.orders ?? 0), 0);
  const split = splitMarketplaceCommissionBySales({
    jumiaSales,
    kilimallSales,
    jumiaCommission: Number(args.payrollRow?.commissionMarketplaceJumia ?? onlineSummary.commissionMarketplaceJumia ?? 0),
    kilimallCommission: Number(args.payrollRow?.commissionMarketplaceKilimall ?? onlineSummary.commissionMarketplaceKilimall ?? 0),
    totalMarketplaceCommission: Number(onlineSummary.marketplaceCommission ?? 0),
  });

  directLine.sales = Number(args.onlinePosSummary?.totalSales ?? onlineSummary.directSales ?? 0);
  directLine.commission = Number(args.payrollRow?.commissionDirect ?? onlineSummary.commissionDirect ?? 0);

  return [
    directLine,
    {
      label: "Jumia",
      sales: jumiaSales,
      commission: split.jumiaCommission,
      note: `${marketplaceWindow.label} / ${jumiaOrders} orders`,
    },
    {
      label: "Kilimall",
      sales: kilimallSales,
      commission: split.kilimallCommission,
      note: `${marketplaceWindow.label} / ${kilimallOrders} orders`,
    },
  ].filter((line) => line.sales > 0 || line.commission > 0);
}

function renderHtml(args: {
  attendantName: string;
  attendantEmail: string;
  letterheadDataUri: string | null;
  periodLabel: string;
  periodStartIso: string;
  periodEndIso: string;
  salesLabel?: string;
  receiptsLabel?: string;
  itemsLabel?: string;
  totalSales: number;
  totalReceipts: number;
  totalItems: number;
  commission: number;
  totalNewProducts: number;
  totalEditedProducts: number;
  totalCopiedProducts: number;
  walkInsServed: number;
  walkInsPurchased: number;
  summaryLines: PerformanceSummaryLine[];
  rows: Array<{
    dateIso: string;
    receiptNumber: string;
    amount: number;
    itemCount: number;
    commissionImpact: number;
    productCommission: number;
    paymentMethod: "MPESA" | "CASH";
    status: string;
  }>;
}) {
  const summaryRowsHtml = args.summaryLines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.label)}</td>
        <td style="text-align:right">${escapeHtml(formatKes(line.sales))}</td>
        <td style="text-align:right">${escapeHtml(formatKes(line.commission))}</td>
        <td>${escapeHtml(line.note)}</td>
      </tr>
    `,
    )
    .join("\n");

  const rowsHtml = args.rows
    .map((r) => {
      return `
      <tr>
        <td>${escapeHtml(r.dateIso)}</td>
        <td>${escapeHtml(r.receiptNumber)}</td>
        <td style="text-align:right">${escapeHtml(formatKes(r.amount))}</td>
        <td style="text-align:right">${escapeHtml(formatKes(r.commissionImpact))}</td>
        <td style="text-align:right">${escapeHtml(formatKes(r.productCommission))}</td>
        <td style="text-align:right">${escapeHtml(formatKes(r.commissionImpact + r.productCommission))}</td>
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
      ${
        args.letterheadDataUri
          ? `<div style="margin-bottom:12px;"><img src="${args.letterheadDataUri}" alt="Betech letterhead" style="width:100%; max-height:160px; object-fit:contain; object-position:left center;" /></div>`
          : ""
      }
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
          <div class="label">${escapeHtml(args.salesLabel ?? "Sales")}</div>
          <div class="value">${escapeHtml(formatKes(args.totalSales))}</div>
        </div>
        <div class="card">
          <div class="label">${escapeHtml(args.receiptsLabel ?? "Receipts")}</div>
          <div class="value">${escapeHtml(args.totalReceipts)}</div>
        </div>
        <div class="card">
          <div class="label">${escapeHtml(args.itemsLabel ?? "Items")}</div>
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

      ${
        args.summaryLines.length > 0
          ? `
      <h2 style="margin-top:16px;">Performance summary</h2>
      <table>
        <thead>
          <tr>
            <th>Area</th>
            <th style="text-align:right; width:140px;">Sales</th>
            <th style="text-align:right; width:140px;">Commission</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRowsHtml}
        </tbody>
      </table>
      `
          : ""
      }

      <h2 style="margin-top:16px;">Receipts list</h2>
      <table>
        <thead>
          <tr>
            <th style="width:110px;">Date</th>
            <th>Receipt #</th>
            <th style="text-align:right; width:130px;">Amount</th>
            <th style="text-align:right; width:105px;">Sales comm.</th>
            <th style="text-align:right; width:105px;">Product comm.</th>
            <th style="text-align:right; width:105px;">Total comm.</th>
            <th style="width:80px;">Method</th>
            <th style="width:110px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="8" class="muted">No receipts found in this period.</td></tr>`}
        </tbody>
      </table>

      <div class="note">
        ${
          args.attendantEmail.toLowerCase() === "justus@betech.co.ke"
            ? "Sales commission is 10% of each receipt's profit for this period. Product commission comes from POS management product commissions assigned to the receipt items."
            : "Sales commission is each receipt's marginal contribution to the period sales commission. Product commission comes from POS management product commissions assigned to the receipt items. This report intentionally excludes profit and buying price values."
        }
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

  const [user, earnings, reportAgg, letterheadDataUri] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
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
    resolveLetterheadDataUri(),
  ]);

  const attendantName = (user?.name ?? user?.email ?? userId).toString();
  const attendantEmail = user?.email ?? null;
  const isOnlineCategory =
    user?.attendantCategory === "JUMIA_KILIMALL_OPS" || user?.attendantCategory === "BETECH_OPS";
  const commissionConfig = await getUserCommissionConfigLike(userId);
  const usesPosProfit10 = commissionConfig.salesCommissionMode === "POS_PROFIT_10";
  const posOwnershipMode = resolveOnlinePosOwnershipMode(attendantEmail);
  const staffOwnerOr: Prisma.ReceiptWhereInput[] = [
    { order: { attendantId: userId } },
    { data: { path: ["attendantId"], equals: userId } },
  ];
  // Enforce strict staff-only ownership for receipt selection to ensure
  // commission attribution is scoped by `order.attendantId` or `data.attendantId`.
  const ownerOr = staffOwnerOr;

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
        ...(isOnlineCategory
          ? []
          : [
              {
                OR: [
                  { data: { path: ["podDelivery"], equals: Prisma.JsonNull } },
                  { NOT: { data: { path: ["podDelivery", "status"], equals: "pending" } } },
                ],
              },
            ]),
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
          items: {
            select: {
              quantity: true,
              sellingPrice: true,
              orderCosts: { select: { unitCost: true } },
              profitSnapshots: {
                orderBy: { computedAt: "desc" },
                take: 1,
                select: { profit: true, unitCost: true, qty: true },
              },
              product: { select: { lastBuyingPrice: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 1200,
  })) as PosReceiptRow[];

  const rows: PerformanceReceiptRow[] = [];
  const seen = new Set<string>();

  for (const row of receipts) {
    const canonical =
      normalizeReceiptNumber(row.receiptNumber) ||
      normalizeReceiptNumber(row.order?.orderNumber) ||
      row.id;
    const date = row.generatedAt ?? row.createdAt;
    const dateIso = new Date(date).toISOString().slice(0, 10);
    const receiptNumber = row.receiptNumber || row.order?.orderNumber || canonical;
    const amount = extractReceiptAmount(row);
    const profit = extractReceiptProfit(row, amount);
    const paymentMethod = normalizePaymentMethod(
      (row.data as any)?.paymentMethod ?? (row.totals as any)?.paymentMethod ?? "MPESA",
    );
    const itemCount = (row.order?.items ?? []).reduce(
      (sum, item) => sum + Math.max(1, Math.trunc(toNumber(item?.quantity) || 1)),
      0,
    );
    const dedupeKey = `${canonical}|${paymentMethod}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const status =
      (row.order?.paymentStatus || row.order?.status || "").toString().toUpperCase() || "UNKNOWN";

    rows.push({
      dateIso,
      sortAt: date.toISOString(),
      receiptNumber,
      amount,
      itemCount,
      profit,
      paymentMethod,
      status,
      commissionImpact: 0,
      productCommission: 0,
    });
  }

  if (usesPosProfit10 && rows.length === 0) {
    const fallbackReceipts = (await prisma.receipt.findMany({
      where: {
        AND: [
          {
            OR: [
              { generatedAt: { gte: period.start, lte: period.end } },
              { createdAt: { gte: period.start, lte: period.end } },
            ],
          },
          {
            OR: [
              { issuedById: userId },
              { order: { attendantId: userId } },
              { data: { path: ["attendantId"], equals: userId } },
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
            items: {
              select: {
                quantity: true,
                sellingPrice: true,
                orderCosts: { select: { unitCost: true } },
                profitSnapshots: {
                  orderBy: { computedAt: "desc" },
                  take: 1,
                  select: { profit: true, unitCost: true, qty: true },
                },
                product: { select: { lastBuyingPrice: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1200,
    })) as PosReceiptRow[];

    for (const row of fallbackReceipts) {
      const canonical =
        normalizeReceiptNumber(row.receiptNumber) ||
        normalizeReceiptNumber(row.order?.orderNumber) ||
        row.id;
      const paymentMethod = normalizePaymentMethod(
        (row.data as any)?.paymentMethod ?? (row.totals as any)?.paymentMethod ?? "MPESA",
      );
      const dedupeKey = `${canonical}|${paymentMethod}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const date = row.generatedAt ?? row.createdAt;
      rows.push({
        dateIso: new Date(date).toISOString().slice(0, 10),
        sortAt: date.toISOString(),
        receiptNumber: row.receiptNumber || row.order?.orderNumber || canonical,
        amount: extractReceiptAmount(row),
        itemCount: (row.order?.items ?? []).reduce(
          (sum, item) => sum + Math.max(1, Math.trunc(toNumber(item?.quantity) || 1)),
          0,
        ),
        profit: extractReceiptProfit(row, extractReceiptAmount(row)),
        paymentMethod,
        status: (row.order?.paymentStatus || row.order?.status || "").toString().toUpperCase() || "UNKNOWN",
        commissionImpact: 0,
        productCommission: 0,
      });
    }
  }

  // Include marketing/support ledger receipts for attendants whose authoritative
  // totals are sourced from those ledgers (e.g. Brendah).
  const includeLedgerRows =
    resolveDirectCommissionMode(attendantEmail) !== "PROFIT_10" &&
    commissionConfig.salesCommissionMode !== "POS_PROFIT_10";
  const [marketingRows, supportRows] = await Promise.all([
    includeLedgerRows
      ? (prisma.marketingReceipt.findMany({
          where: {
            createdAt: { gte: period.start, lte: period.end },
            dailyEntry: { submittedById: userId },
          },
          select: {
            id: true,
            createdAt: true,
            receiptNumber: true,
            receiptKey: true,
            sellingTotal: true,
            buyingTotal: true,
            paymentMethod: true,
            items: { select: { buyingPrice: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 1200,
        }) as unknown as Promise<LedgerReceiptRow[]>)
      : Promise.resolve([]),
    includeLedgerRows
      ? (prisma.supportReceipt.findMany({
          where: {
            createdAt: { gte: period.start, lte: period.end },
            dailyEntry: { submittedById: userId },
          },
          select: {
            id: true,
            createdAt: true,
            receiptNumber: true,
            receiptKey: true,
            sellingTotal: true,
            buyingTotal: true,
            paymentMethod: true,
            items: { select: { buyingPrice: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 1200,
        }) as unknown as Promise<LedgerReceiptRow[]>)
      : Promise.resolve([]),
  ]);

  const appendLedgerRows = (entries: LedgerReceiptRow[], status: string) => {
    for (const entry of entries) {
      const canonical =
        normalizeReceiptNumber(entry.receiptNumber) ||
        normalizeReceiptNumber(entry.receiptKey || "") ||
        entry.id;
      const method = normalizePaymentMethod(entry.paymentMethod ?? "MPESA");
      const dedupeKey = `${canonical}|${method}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      rows.push({
        dateIso: entry.createdAt.toISOString().slice(0, 10),
        sortAt: entry.createdAt.toISOString(),
        receiptNumber: entry.receiptNumber || entry.receiptKey || canonical,
        amount: Number(entry.sellingTotal ?? 0),
        itemCount: Array.isArray(entry.items) ? entry.items.length : 0,
        profit: resolveLedgerReceiptProfit(entry),
        paymentMethod: method,
        status,
        commissionImpact: 0,
        productCommission: 0,
      });
    }
  };

  appendLedgerRows(marketingRows, "MARKETING");
  appendLedgerRows(supportRows, "SUPPORT");

  if (rows.length > 0) {
    rows.sort((a, b) => (a.dateIso < b.dateIso ? 1 : -1));
  }

  if (rows.length === 0) {
    // Fallback for periods where data is only in daily-report sales rows.
    const salesRows = await prisma.dailySale.findMany({
      where: { dailyReport: { userId, date: { gte: period.start, lte: period.end } } },
      select: { receiptNumber: true, price: true, paymentMethod: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1200,
    });
    const perReceipt = new Map<
      string,
      { amount: number; items: number; method: "MPESA" | "CASH"; dateIso: string; sortAt: string }
    >();
    for (const sale of salesRows) {
      const key = normalizeReceiptNumber(sale.receiptNumber) || `sale-${sale.createdAt.toISOString()}`;
      const existing = perReceipt.get(key);
      const nextAmount = Number(sale.price ?? 0);
      if (existing) {
        existing.amount += nextAmount;
        existing.items += 1;
        continue;
      }
      perReceipt.set(key, {
        amount: nextAmount,
        items: 1,
        method: normalizePaymentMethod(sale.paymentMethod ?? "MPESA"),
        dateIso: sale.createdAt.toISOString().slice(0, 10),
        sortAt: sale.createdAt.toISOString(),
      });
    }
    for (const [receiptNumber, value] of perReceipt) {
      rows.push({
        dateIso: value.dateIso,
        sortAt: value.sortAt,
        receiptNumber,
        amount: value.amount,
        itemCount: value.items,
        profit: 0,
        paymentMethod: value.method,
        status: "SUBMITTED",
        commissionImpact: 0,
        productCommission: 0,
      });
    }
  }

  const profitFallbacks = await getReceiptProfitFallbacks({
    userId,
    start: period.start,
    end: period.end,
    receiptNumbers: rows.map((row) => row.receiptNumber),
  });
  for (const row of rows) {
    const canonical = normalizeReceiptNumber(row.receiptNumber);
    if (!canonical) continue;
    applyProfitFallback(row, profitFallbacks.get(canonical) ?? 0);
  }

  const [commissionPeriod, productCommissions, payrollRow, onlinePosSummary] = await Promise.all([
    getOrCreateCommissionPeriod(period.start),
    getPosProductCommissionsForPdf({ userId, start: period.start, end: period.end }),
    user
      ? buildPayrollRow(
          {
            id: user.id,
            name: user.name,
            email: user.email,
            attendantCategory: user.attendantCategory,
            isActive: user.isActive,
          },
          period,
        )
      : null,
    isOnlineCategory
        ? summarizePosReceiptsForPeriod({
          start: period.start,
          end: period.end,
          userId,
          ownershipMode: posOwnershipMode,
          supportPricingScope: "any",
          profitRecognitionMode: "salesDate",
          paymentScope: commissionConfig.salesCommissionMode === "POS_PROFIT_10" ? "all" : "paidOnly",
        })
      : Promise.resolve(null),
  ]);

  // Canonical commission summary for this attendant/period
  const attendantCanonical = await getAttendantCommissionSummary({ attendantId: userId, start: period.start, end: period.end });

  for (const productCommission of productCommissions.values()) {
    const canonical = normalizeReceiptNumber(productCommission.receiptNumber);
    if (!canonical) continue;
    const existing = rows.find((row) => normalizeReceiptNumber(row.receiptNumber) === canonical);
    if (existing) {
      existing.productCommission += productCommission.amount;
      if (existing.amount <= 0 && productCommission.orderTotal > 0) {
        existing.amount = productCommission.orderTotal;
      }
      continue;
    }

    rows.push({
      dateIso: productCommission.dateIso,
      sortAt: productCommission.sortAt,
      receiptNumber: productCommission.receiptNumber,
      amount: productCommission.orderTotal,
      itemCount: 0,
      profit: 0,
      paymentMethod: "MPESA",
      status: "PRODUCT COMMISSION",
      commissionImpact: 0,
      productCommission: productCommission.amount,
    });
  }

  const tiers = commissionPeriod.tiers.map((tier) => ({
    minSales: Number(tier.minSales),
    maxSales: tier.maxSales == null ? Number(tier.minSales) : Number(tier.maxSales),
    payoutFlat: Number(tier.payoutFlat),
  }));
  const summaryLines = await getPerformanceSummaryLines({
    userId,
    period,
    attendantCategory: user?.attendantCategory ?? null,
    payrollRow,
    onlinePosSummary,
  });
  const rowsWithCommission = attachReceiptCommissionImpact({
    rows,
    attendantEmail: user?.email ?? null,
    salesCommissionMode: commissionConfig.salesCommissionMode,
    tiers,
  }).sort((a, b) => (a.sortAt < b.sortAt ? 1 : -1));
  const renderedReceiptCommission = rowsWithCommission.reduce(
    (sum, row) => sum + Number(row.commissionImpact ?? 0) + Number(row.productCommission ?? 0),
    0,
  );
  const printedPosSales = rowsWithCommission.reduce((sum, row) => sum + Math.max(0, Number(row.amount ?? 0)), 0);
  const printedPosReceipts = rowsWithCommission.filter((row) => Math.max(0, Number(row.amount ?? 0)) > 0).length;
  const printedPosItems = rowsWithCommission.reduce((sum, row) => sum + Math.max(0, Number(row.itemCount ?? 0)), 0);
  const summaryLinesForRender = summaryLines.map((line) => {
    if (line.label !== "POS direct sales") return line;
    if (usesPosProfit10) {
      return {
        ...line,
        sales: printedPosSales,
        commission: rowsWithCommission.reduce((sum, row) => sum + Number(row.commissionImpact ?? 0), 0),
        note: `${printedPosReceipts} POS receipts / ${printedPosItems} POS items`,
      };
    }
    if (isOnlineCategory && (Number(onlinePosSummary?.totalReceipts ?? 0) <= 0 || Number(onlinePosSummary?.totalItems ?? 0) <= 0)) {
      return {
        ...line,
        note: `${printedPosReceipts} POS receipts / ${printedPosItems} POS items`,
      };
    }
    return line;
  });
  const onlineDirectSales = summaryLinesForRender.find((line) => line.label === "POS direct sales")?.sales ?? 0;

  const html = renderHtml({
    attendantName: user?.name ?? "Attendant",
    attendantEmail: user?.email ?? "",
    letterheadDataUri,
    periodLabel: period.label,
    periodStartIso: period.start.toISOString().slice(0, 10),
    periodEndIso: period.end.toISOString().slice(0, 10),
    salesLabel: isOnlineCategory ? "POS sales" : "Sales",
    receiptsLabel: isOnlineCategory ? "POS receipts" : "Receipts",
    itemsLabel: isOnlineCategory ? "POS items" : "Items",
    totalSales: isOnlineCategory
      ? Number(onlinePosSummary?.totalSales || onlineDirectSales || printedPosSales || 0)
      : Number(attendantCanonical.totalSales ?? payrollRow?.totalSales ?? earnings.totalSales ?? 0),
    totalReceipts: isOnlineCategory
      ? Number(onlinePosSummary?.totalReceipts || printedPosReceipts || 0)
      : Number(attendantCanonical.receiptsCount ?? payrollRow?.totalReceipts ?? earnings.totalReceipts ?? 0),
    totalItems: isOnlineCategory
      ? Number(onlinePosSummary?.totalItems || printedPosItems || 0)
      : Number(payrollRow?.totalItems ?? earnings.totalItems ?? 0),
    commission:
      commissionConfig.salesCommissionMode === "POS_PROFIT_10"
        ? renderedReceiptCommission
        : Number(attendantCanonical.totalCommission ?? payrollRow?.commissionTotal ?? (earnings as any).grossCommission ?? (earnings as any).commission ?? 0),
    totalNewProducts: Number(payrollRow?.newProducts ?? reportAgg._sum.newProducts ?? 0),
    totalEditedProducts: Number(payrollRow?.editedProducts ?? reportAgg._sum.productsEdited ?? 0),
    totalCopiedProducts: Number(payrollRow?.copiedProducts ?? reportAgg._sum.copiesUploaded ?? 0),
    walkInsServed: Number(reportAgg._sum.walkInServed ?? 0),
    walkInsPurchased: Number(reportAgg._sum.purchasesMade ?? 0),
    summaryLines: summaryLinesForRender,
    rows: rowsWithCommission,
    // Attach canonical breakdown for debugging/consistency
    // (not displayed directly but available via PDF rendering if needed)
    // commissionBreakdown: attendantCanonical.breakdown ?? undefined,
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
      try {
        browser = await puppeteer.launch({
          headless: "new",
          defaultViewport: { width: 1280, height: 900 },
        });
      } catch (puppeteerErr: any) {
        const msg = String(puppeteerErr?.message ?? puppeteerErr ?? "");
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
