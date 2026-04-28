import Link from "next/link";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  Briefcase,
  Building2,
  ChartColumnBig,
  CircleAlert,
  ClipboardCheck,
  HeartHandshake,
  Package,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import AutoRefresh from "@/app/_components/AutoRefresh";
import AdminPrivacyToggle from "@/app/admin/_components/AdminPrivacyToggle";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";
import { groupMarketingUnpricedSales } from "@/lib/unpricedReceiptGrouping";

export const dynamic = "force-dynamic";

type ReceiptSnapshot = {
  generatedAt: Date;
  order: { totalAmount: number | null } | null;
  totals: unknown;
  data: unknown;
};

type DeskReceiptSnapshot = {
  createdAt: Date;
  sellingTotal: number;
  buyingTotal: number;
  paymentMethod?: string | null;
};

type MarketplaceSnapshot = {
  orderedAt: Date;
  platform: string;
  sellingPrice: unknown;
  profit: unknown;
  status: string;
};

type TrendPoint = {
  key: string;
  label: string;
  total: number;
  pos: number;
  desk: number;
  online: number;
};

type LinkItem = {
  href: string;
  label: string;
  meta: string;
};

type LinkGroup = {
  title: string;
  tone: string;
  items: LinkItem[];
};

const shellCard =
  "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,27,43,0.95),rgba(9,13,26,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.35)]";

const subtleCard =
  "rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,22,37,0.94),rgba(7,10,20,0.98))]";

const sectionPill =
  "rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-200";

const sensitiveClass = "admin-sensitive-value";

const formatKES = (value: number) =>
  `KES ${Math.round(value || 0).toLocaleString("en-KE")}`;

const formatCompactKES = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);

const toNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getReceiptTotals = (receipt: ReceiptSnapshot) => {
  const totals = (receipt.totals ?? {}) as Record<string, unknown>;
  const data = (receipt.data ?? {}) as Record<string, unknown>;
  const dataTotals = ((data.totals ?? {}) as Record<string, unknown>) || {};
  const selling =
    toNumber(receipt.order?.totalAmount) ||
    toNumber(totals.total) ||
    toNumber(totals.totalAmount) ||
    toNumber(dataTotals.total) ||
    toNumber(dataTotals.totalAmount);
  const buying =
    toNumber(totals.buyingTotal) ||
    toNumber(dataTotals.buyingTotal);
  const storedProfit = toNumber(totals.profit) || toNumber(dataTotals.profit);
  const profit = storedProfit || (selling > 0 && buying > 0 ? selling - buying : 0);
  return { selling, buying, profit };
};

const getDeskReceiptTotals = (receipt: DeskReceiptSnapshot) => {
  const selling = toNumber(receipt.sellingTotal);
  const buying = toNumber(receipt.buyingTotal);
  const profit = selling > 0 && buying > 0 ? selling - buying : 0;
  return { selling, buying, profit };
};

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function buildTrendSeed() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = subDays(today, 6 - index);
    return {
      key: dayKey(date),
      label: format(date, "EEE"),
      total: 0,
      pos: 0,
      desk: 0,
      online: 0,
    } satisfies TrendPoint;
  });
}

function scoreTone(value: number) {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-rose-300";
  return "text-slate-200";
}

function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  action,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div id={id} className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-emerald-300/90">{eyebrow}</div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="max-w-3xl text-sm text-slate-400">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  accent = "from-emerald-500/20 via-cyan-500/10 to-transparent",
}: {
  title: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/80 p-5`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{title}</div>
          <div className={`text-2xl font-semibold text-white ${sensitiveClass}`}>{value}</div>
          <div className="text-sm text-slate-400">{sub}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-emerald-200">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ChannelCard({
  title,
  sales,
  profit,
  volume,
  note,
  href,
}: {
  title: string;
  sales: number;
  profit: number;
  volume: string;
  note: string;
  href: string;
}) {
  return (
    <Link href={href} className={`${subtleCard} group block p-5 transition hover:border-emerald-400/40`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-slate-400">{note}</div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-slate-500 transition group-hover:text-emerald-300" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Sales</div>
          <div className={`mt-1 text-xl font-semibold text-white ${sensitiveClass}`}>{formatCompactKES(sales)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Profit</div>
          <div className={`mt-1 text-xl font-semibold ${scoreTone(profit)} ${sensitiveClass}`}>{formatCompactKES(profit)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Volume</div>
          <div className={`mt-1 text-xl font-semibold text-white ${sensitiveClass}`}>{volume}</div>
        </div>
      </div>
    </Link>
  );
}

function ActionItem({
  title,
  value,
  note,
  href,
  icon: Icon,
  danger = false,
}: {
  title: string;
  value: string;
  note: string;
  href: string;
  icon: LucideIcon;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-4 rounded-2xl border px-4 py-4 transition ${
        danger
          ? "border-amber-500/25 bg-amber-500/10 hover:border-amber-400/50"
          : "border-white/10 bg-white/[0.03] hover:border-emerald-400/40"
      }`}
    >
      <div className={`rounded-2xl p-3 ${danger ? "bg-amber-500/15 text-amber-200" : "bg-emerald-500/10 text-emerald-200"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className={`text-lg font-semibold text-white ${sensitiveClass}`}>{value}</div>
        </div>
        <div className="mt-1 text-sm text-slate-400">{note}</div>
      </div>
    </Link>
  );
}

function TrendCard({ points }: { points: TrendPoint[] }) {
  const maxValue = Math.max(...points.map((point) => point.total), 1);

  return (
    <div className={`${subtleCard} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-white">7-day sales movement</div>
          <div className="mt-1 text-sm text-slate-400">Combined recorded sales from POS, desk receipts, and marketplace channels.</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-400">
          Last 7 days
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-3">
        {points.map((point) => {
          const height = Math.max(14, Math.round((point.total / maxValue) * 180));
          return (
            <div key={point.key} className="flex flex-col items-center gap-3">
              <div className="flex h-52 w-full items-end justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-2 py-3">
                <div className="w-full max-w-[52px] rounded-2xl bg-gradient-to-t from-emerald-500 via-cyan-400 to-sky-300" style={{ height }} />
              </div>
              <div className="text-center">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{point.label}</div>
                <div className={`mt-1 text-sm font-semibold text-white ${sensitiveClass}`}>{formatCompactKES(point.total)}</div>
                <div className={`mt-1 text-[11px] text-slate-500 ${sensitiveClass}`}>
                  POS {formatCompactKES(point.pos)} · Desk {formatCompactKES(point.desk)} · Online {formatCompactKES(point.online)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LinkGroupCard({ title, tone, items }: LinkGroup) {
  return (
    <div className={`${subtleCard} p-5`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{tone}</div>
      <div className="mt-2 text-xl font-semibold text-white">{title}</div>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-emerald-400/40"
          >
            <div>
              <div className="font-medium text-white">{item.label}</div>
              <div className="text-sm text-slate-400">{item.meta}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:text-emerald-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}

async function getDashboardData() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tradingPeriod = getTradingPeriodFor(now);
  const trendStart = startOfDay(subDays(now, 6));

  const [
    productsCount,
    shopsCount,
    activeStaffCount,
    returnsCount,
    lowStockCount,
    pendingJumiaOrders,
    pendingLeaveCount,
    pendingCashAdvanceCount,
    pendingPosCommissionCandidates,
    posReceiptsPeriod,
    posReceiptsToday,
    posTrendReceipts,
    marketingReceiptsPeriod,
    marketingReceiptsToday,
    marketingTrendReceipts,
    supportReceiptsPeriod,
    supportReceiptsToday,
    supportTrendReceipts,
    marketplaceOrdersPeriod,
    marketplaceOrdersToday,
    marketplaceTrendOrders,
    payrollUsers,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.shop.count(),
    prisma.user.count({
      where: { role: { in: ["ATTENDANT", "SUPERVISOR", "ADMIN"] }, isActive: true },
    }),
    prisma.returnCase.count(),
    prisma.product
      .findMany({
        where: { isActive: true },
        select: { stockQuantity: true, minStockLevel: true },
      })
      .then((rows) => rows.filter((row) => Number(row.stockQuantity ?? 0) <= Number(row.minStockLevel ?? 0)).length),
    prisma.jumiaOrder.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.cashAdvance.count({ where: { status: "PENDING" } }),
    prisma.commissionEarning.findMany({
      where: { status: { in: ["PENDING", "PENDING_APPROVAL"] } },
      select: { id: true, basis: true, calcDetail: true },
    }),
    prisma.receipt.findMany({
      where: { generatedAt: { gte: tradingPeriod.start, lte: tradingPeriod.end } },
      select: {
        generatedAt: true,
        totals: true,
        data: true,
        order: { select: { totalAmount: true } },
      },
    }),
    prisma.receipt.findMany({
      where: { generatedAt: { gte: todayStart, lte: todayEnd } },
      select: {
        generatedAt: true,
        totals: true,
        data: true,
        order: { select: { totalAmount: true } },
      },
    }),
    prisma.receipt.findMany({
      where: { generatedAt: { gte: trendStart, lte: todayEnd } },
      select: {
        generatedAt: true,
        totals: true,
        data: true,
        order: { select: { totalAmount: true } },
      },
    }),
    prisma.marketingReceipt.findMany({
      where: { createdAt: { gte: tradingPeriod.start, lte: tradingPeriod.end } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.marketingReceipt.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.marketingReceipt.findMany({
      where: { createdAt: { gte: trendStart, lte: todayEnd } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.supportReceipt.findMany({
      where: { createdAt: { gte: tradingPeriod.start, lte: tradingPeriod.end } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.supportReceipt.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.supportReceipt.findMany({
      where: { createdAt: { gte: trendStart, lte: todayEnd } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.marketplaceOrder.findMany({
      where: { orderedAt: { gte: tradingPeriod.start, lte: tradingPeriod.end } },
      select: { orderedAt: true, platform: true, sellingPrice: true, profit: true, status: true },
    }),
    prisma.marketplaceOrder.findMany({
      where: { orderedAt: { gte: todayStart, lte: todayEnd } },
      select: { orderedAt: true, platform: true, sellingPrice: true, profit: true, status: true },
    }),
    prisma.marketplaceOrder.findMany({
      where: { orderedAt: { gte: trendStart, lte: todayEnd } },
      select: { orderedAt: true, platform: true, sellingPrice: true, profit: true, status: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ATTENDANT", "SUPERVISOR"] }, isActive: true },
      orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
    }),
  ]);

  const payrollRows = await Promise.all(payrollUsers.map((user) => buildPayrollRow(user, tradingPeriod)));
  const payrollTotals = payrollRows.reduce(
    (acc, row) => {
      acc.base += Number(row.baseSalary ?? 0) + Number(row.transportAllowance ?? 0);
      acc.commission += Number(row.commissionTotal ?? 0);
      acc.net += Number(row.netPay ?? 0);
      acc.deductions += Number(row.totalDeductions ?? 0);
      acc.sales += Number(row.totalSales ?? 0);
      return acc;
    },
    { base: 0, commission: 0, net: 0, deductions: 0, sales: 0 },
  );

  const topSalesRow = [...payrollRows].sort((left, right) => Number(right.totalSales ?? 0) - Number(left.totalSales ?? 0))[0] ?? null;
  const topCommissionRow = [...payrollRows].sort((left, right) => Number(right.commissionTotal ?? 0) - Number(left.commissionTotal ?? 0))[0] ?? null;
  const topNetRow = [...payrollRows].sort((left, right) => Number(right.netPay ?? 0) - Number(left.netPay ?? 0))[0] ?? null;

  const posPeriod = posReceiptsPeriod.reduce(
    (acc, receipt) => {
      const totals = getReceiptTotals(receipt);
      acc.sales += totals.selling;
      acc.buying += totals.buying;
      acc.profit += totals.profit;
      return acc;
    },
    { sales: 0, buying: 0, profit: 0 },
  );
  const posToday = posReceiptsToday.reduce((acc, receipt) => acc + getReceiptTotals(receipt).selling, 0);

  const marketingPeriod = marketingReceiptsPeriod.reduce(
    (acc, receipt) => {
      const totals = getDeskReceiptTotals(receipt);
      acc.sales += totals.selling;
      acc.profit += totals.profit;
      return acc;
    },
    { sales: 0, profit: 0 },
  );
  const marketingToday = marketingReceiptsToday.reduce((acc, receipt) => acc + getDeskReceiptTotals(receipt).selling, 0);

  const supportPeriod = supportReceiptsPeriod.reduce(
    (acc, receipt) => {
      const totals = getDeskReceiptTotals(receipt);
      acc.sales += totals.selling;
      acc.profit += totals.profit;
      return acc;
    },
    { sales: 0, profit: 0 },
  );
  const supportToday = supportReceiptsToday.reduce((acc, receipt) => acc + getDeskReceiptTotals(receipt).selling, 0);

  const marketplacePeriod = marketplaceOrdersPeriod.reduce(
    (acc, row) => {
      const sales = toNumber(row.sellingPrice);
      const profit = toNumber(row.profit);
      acc.totalSales += sales;
      acc.totalProfit += profit;
      if (String(row.platform).toUpperCase() === "JUMIA") {
        acc.jumiaSales += sales;
        acc.jumiaProfit += profit;
      }
      if (String(row.platform).toUpperCase() === "KILIMALL") {
        acc.kilimallSales += sales;
        acc.kilimallProfit += profit;
      }
      return acc;
    },
    { totalSales: 0, totalProfit: 0, jumiaSales: 0, jumiaProfit: 0, kilimallSales: 0, kilimallProfit: 0 },
  );
  const marketplaceToday = marketplaceOrdersToday.reduce((acc, row) => acc + toNumber(row.sellingPrice), 0);

  const combinedPeriodSales =
    posPeriod.sales +
    marketingPeriod.sales +
    supportPeriod.sales +
    marketplacePeriod.totalSales;
  const combinedPeriodProfit =
    posPeriod.profit +
    marketingPeriod.profit +
    supportPeriod.profit +
    marketplacePeriod.totalProfit;
  const todaySales =
    posToday +
    marketingToday +
    supportToday +
    marketplaceToday;

  const trendMap = new Map(buildTrendSeed().map((point) => [point.key, point]));
  for (const receipt of posTrendReceipts) {
    const key = dayKey(receipt.generatedAt);
    const point = trendMap.get(key);
    if (!point) continue;
    const totals = getReceiptTotals(receipt);
    point.pos += totals.selling;
    point.total += totals.selling;
  }
  for (const receipt of marketingTrendReceipts) {
    const key = dayKey(receipt.createdAt);
    const point = trendMap.get(key);
    if (!point) continue;
    const totals = getDeskReceiptTotals(receipt);
    point.desk += totals.selling;
    point.total += totals.selling;
  }
  for (const receipt of supportTrendReceipts) {
    const key = dayKey(receipt.createdAt);
    const point = trendMap.get(key);
    if (!point) continue;
    const totals = getDeskReceiptTotals(receipt);
    point.desk += totals.selling;
    point.total += totals.selling;
  }
  for (const row of marketplaceTrendOrders) {
    const key = dayKey(row.orderedAt);
    const point = trendMap.get(key);
    if (!point) continue;
    const sales = toNumber(row.sellingPrice);
    point.online += sales;
    point.total += sales;
  }

  const unpricedSales = await getUnpricedDailySalesForCurrentPeriod();
  const groupedUnpriced = groupMarketingUnpricedSales(unpricedSales);
  const pricingQueue = groupedUnpriced.reduce(
    (acc, sale) => {
      acc.receipts += 1;
      if (sale.source === "support") {
        acc.support += 1;
        acc.items += Number(sale.receiptItems?.length ?? sale.itemsPending ?? 0) || 1;
      } else {
        acc.items += Number(sale.receiptItems?.length ?? sale.groupedSaleIds?.length ?? sale.itemsPending ?? 0) || 1;
      }
      return acc;
    },
    { receipts: 0, items: 0, support: 0 },
  );

  const pendingPosCommissionCount = pendingPosCommissionCandidates.filter((item) => {
    const detail = item.calcDetail as Record<string, unknown> | null;
    return item.basis === "product_flat" || detail?.reason === "pos_product_commission";
  }).length;

  return {
    periodLabel: tradingPeriod.label,
    todaySales,
    combinedPeriodSales,
    combinedPeriodProfit,
    counts: {
      products: productsCount,
      shops: shopsCount,
      activeStaff: activeStaffCount,
      returns: returnsCount,
      lowStock: lowStockCount,
      pendingJumiaOrders,
      pendingLeave: pendingLeaveCount,
      pendingCashAdvance: pendingCashAdvanceCount,
      pendingPosCommission: pendingPosCommissionCount,
    },
    pos: {
      sales: posPeriod.sales,
      profit: posPeriod.profit,
      receipts: posReceiptsPeriod.length,
    },
    marketing: {
      sales: marketingPeriod.sales,
      profit: marketingPeriod.profit,
      receipts: marketingReceiptsPeriod.length,
    },
    support: {
      sales: supportPeriod.sales,
      profit: supportPeriod.profit,
      receipts: supportReceiptsPeriod.length,
    },
    marketplace: {
      sales: marketplacePeriod.totalSales,
      profit: marketplacePeriod.totalProfit,
      orders: marketplaceOrdersPeriod.length,
      jumiaSales: marketplacePeriod.jumiaSales,
      kilimallSales: marketplacePeriod.kilimallSales,
    },
    payroll: {
      base: payrollTotals.base,
      commission: payrollTotals.commission,
      net: payrollTotals.net,
      deductions: payrollTotals.deductions,
      staff: payrollRows.length,
      topSalesRow,
      topCommissionRow,
      topNetRow,
    },
    pricingQueue,
    trends: Array.from(trendMap.values()),
  };
}

export default async function AdminOverviewPage() {
  const dashboard = await getDashboardData();

  const quickLinks: LinkGroup[] = [
    {
      title: "Core operations",
      tone: "Run the floor",
      items: [
        { href: "/admin/orders", label: "Orders", meta: "Dispatch, pack, payment, and order status flow" },
        { href: "/admin/receipts", label: "Receipts", meta: "POS receipts, PDFs, downloads, and direct-sale history" },
        { href: "/admin/pending-pricing", label: "Pending pricing", meta: "Clear missing buying prices and unblock profits" },
        { href: "/admin/returns", label: "Returns", meta: "Pickup, receive, approve, and resolve return cases" },
      ],
    },
    {
      title: "Sales and growth",
      tone: "Grow revenue",
      items: [
        { href: "/admin/marketing-report", label: "Marketing report", meta: "Daily desk sales, profitability, and manual pricing queue" },
        { href: "/admin/online/summary", label: "Online summary", meta: "Marketplace performance, accounts, and divided views" },
        { href: "/admin/online/performance", label: "Online performance", meta: "Capture week profit and monitor channel outcomes" },
        { href: "/admin/support-report", label: "Support report", meta: "Support desk sales, receipts, and battery work" },
      ],
    },
    {
      title: "People and payroll",
      tone: "Run the team",
      items: [
        { href: "/admin/attendants", label: "Attendants", meta: "Edit staff, comp plans, payroll pages, and profiles" },
        { href: "/admin/payroll", label: "Payroll", meta: "Current trading-period pay, deductions, and payouts" },
        { href: "/admin/wellness", label: "Wellness", meta: "Leave, cash advances, and deduction follow-up" },
        { href: "/admin/users", label: "Users", meta: "User accounts, roles, passwords, and access control" },
      ],
    },
    {
      title: "Inventory and control",
      tone: "Keep systems clean",
      items: [
        { href: "/admin/pos-management", label: "POS management", meta: "Catalogue, commissions, warranties, and product cleanup" },
        { href: "/admin/shops", label: "Shops", meta: "Branches, assignments, credentials, and ownership" },
        { href: "/admin/settings", label: "Settings", meta: "System controls, API credentials, and config" },
        { href: "/admin/health-checks", label: "Health checks", meta: "Service health, database readiness, and diagnostics" },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <AutoRefresh intervalMs={60_000} />

      <section className={`${shellCard} overflow-hidden p-6 md:p-8`}>
        <div className="absolute" />
        <div className="grid gap-8 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <a href="#executive" className={sectionPill}>Executive</a>
              <a href="#sales" className={sectionPill}>Sales</a>
              <a href="#operations" className={sectionPill}>Operations</a>
              <a href="#people" className={sectionPill}>People</a>
              <a href="#resources" className={sectionPill}>Resources</a>
            </div>

            <div className="space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-emerald-300">Unified Admin Dashboard</div>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                One home page for company money, operations, people, and control links.
              </h1>
              <p className="max-w-3xl text-base text-slate-400">
                Watch POS, marketing, support, Jumia, and payroll from one screen. The layout is grouped so you can scan cash, pending work, staff impact, and the main company pages without hunting through menus.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">Trading period</div>
                <div className="mt-2 text-2xl font-semibold text-white">{dashboard.periodLabel}</div>
                <div className="mt-2 text-sm text-emerald-100/80">Auto-refreshing control view for the live business day.</div>
              </div>
              <div className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/10 p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">Today recorded sales</div>
                <div className={`mt-2 text-2xl font-semibold text-white ${sensitiveClass}`}>{formatKES(dashboard.todaySales)}</div>
                <div className="mt-2 text-sm text-cyan-100/80">Across POS, support, marketing desk, and marketplace channels.</div>
              </div>
              <div className="rounded-[24px] border border-fuchsia-500/20 bg-fuchsia-500/10 p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-200">Net payroll due</div>
                <div className={`mt-2 text-2xl font-semibold text-white ${sensitiveClass}`}>{formatKES(dashboard.payroll.net)}</div>
                <div className="mt-2 text-sm text-fuchsia-100/80">Current period pay after deductions, commission, and top-ups.</div>
              </div>
            </div>
          </div>

          <div className={`${subtleCard} p-6`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Control pulse</div>
                <div className="mt-2 text-2xl font-semibold text-white">What needs action now</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                live
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <ActionItem
                title="Manual pricing queue"
                value={`${dashboard.pricingQueue.receipts}`}
                note={`${dashboard.pricingQueue.items} items still need buying price attention.`}
                href="/admin/marketing-report"
                icon={CircleAlert}
                danger={dashboard.pricingQueue.receipts > 0}
              />
              <ActionItem
                title="POS commission approvals"
                value={`${dashboard.counts.pendingPosCommission}`}
                note="Release or reject staff commission requests from POS catalogue sales."
                href="/admin/pos-management"
                icon={BadgeDollarSign}
                danger={dashboard.counts.pendingPosCommission > 0}
              />
              <ActionItem
                title="Wellness approvals"
                value={`${dashboard.counts.pendingLeave + dashboard.counts.pendingCashAdvance}`}
                note={`${dashboard.counts.pendingLeave} leave requests and ${dashboard.counts.pendingCashAdvance} cash advances pending.`}
                href="/admin/wellness"
                icon={HeartHandshake}
                danger={dashboard.counts.pendingLeave + dashboard.counts.pendingCashAdvance > 0}
              />
              <ActionItem
                title="Low stock risk"
                value={`${dashboard.counts.lowStock}`}
                note="Products at or below minimum stock level need attention."
                href="/admin/pos-management"
                icon={Package}
                danger={dashboard.counts.lowStock > 0}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="executive" className="space-y-4">
        <SectionHeader
          eyebrow="Executive strip"
          title="Money and company movement"
          description="These top cards answer the first admin questions: how much came in, how much is left as profit, what Jumia is doing, how strong POS is, and what payroll is carrying."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Trading period sales" value={formatKES(dashboard.combinedPeriodSales)} sub="Recorded sales across all major channels" icon={Wallet} />
          <StatCard title="Trading period profit" value={formatKES(dashboard.combinedPeriodProfit)} sub="Net recorded profit across available buying totals" icon={TrendingUp} accent="from-cyan-500/20 via-emerald-500/10 to-transparent" />
          <StatCard title="Jumia sales" value={formatKES(dashboard.marketplace.jumiaSales)} sub={`${dashboard.counts.pendingJumiaOrders} Jumia orders still pending`} icon={Store} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
          <StatCard title="POS direct sales" value={formatKES(dashboard.pos.sales)} sub={`${dashboard.pos.receipts} receipts in the current period`} icon={Receipt} accent="from-sky-500/20 via-cyan-500/10 to-transparent" />
          <StatCard title="Payroll due" value={formatKES(dashboard.payroll.net)} sub={`${dashboard.payroll.staff} active staff on the payroll sheet`} icon={Users} accent="from-fuchsia-500/20 via-violet-500/10 to-transparent" />
          <StatCard title="Commission due" value={formatKES(dashboard.payroll.commission)} sub="Period commission across direct, marketplace, and POS work" icon={BadgeDollarSign} accent="from-emerald-500/20 via-lime-500/10 to-transparent" />
        </div>
      </section>

      <section id="sales" className="space-y-4">
        <SectionHeader
          eyebrow="Sales channels"
          title="Channel performance block"
          description="Keep every major revenue stream visible separately so leadership can see where money is coming from instead of relying on one blended total."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <ChannelCard
            title="POS / direct sales"
            sales={dashboard.pos.sales}
            profit={dashboard.pos.profit}
            volume={`${dashboard.pos.receipts} receipts`}
            note="Receipts and direct customer walk-in / delivery activity."
            href="/admin/receipts"
          />
          <ChannelCard
            title="Marketplace online"
            sales={dashboard.marketplace.sales}
            profit={dashboard.marketplace.profit}
            volume={`${dashboard.marketplace.orders} orders`}
            note={`Jumia ${formatCompactKES(dashboard.marketplace.jumiaSales)} · Kilimall ${formatCompactKES(dashboard.marketplace.kilimallSales)}`}
            href="/admin/online/summary"
          />
          <ChannelCard
            title="Marketing desk"
            sales={dashboard.marketing.sales}
            profit={dashboard.marketing.profit}
            volume={`${dashboard.marketing.receipts} receipts`}
            note="Marketing-report receipts and manually captured desk conversions."
            href="/admin/marketing-report"
          />
          <ChannelCard
            title="Support desk"
            sales={dashboard.support.sales}
            profit={dashboard.support.profit}
            volume={`${dashboard.support.receipts} receipts`}
            note="Support-side receipts, battery work, and direct service sales."
            href="/admin/support-report"
          />
        </div>
      </section>

      <section id="operations" className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Operations center"
            title="Pending work and risk area"
            description="This section is for action, not passive reading. Anything here should lead to a decision or a click into a real working page."
          />
          <div className={`${subtleCard} grid gap-4 p-5 sm:grid-cols-2`}>
            <ActionItem
              title="Pending pricing"
              value={`${dashboard.pricingQueue.receipts}`}
              note={`${dashboard.pricingQueue.items} items still need buying prices before the books are clean.`}
              href="/admin/marketing-report"
              icon={RefreshCcw}
              danger={dashboard.pricingQueue.receipts > 0}
            />
            <ActionItem
              title="Returns queue"
              value={`${dashboard.counts.returns}`}
              note="Open return cases still visible in the returns workspace."
              href="/admin/returns"
              icon={Truck}
              danger={dashboard.counts.returns > 0}
            />
            <ActionItem
              title="Jumia pending orders"
              value={`${dashboard.counts.pendingJumiaOrders}`}
              note="Live pending order backlog from the Jumia sync tables."
              href="/admin/orders"
              icon={ShoppingBag}
              danger={dashboard.counts.pendingJumiaOrders > 0}
            />
            <ActionItem
              title="Low stock products"
              value={`${dashboard.counts.lowStock}`}
              note="Items already at or below the minimum stock threshold."
              href="/admin/pos-management"
              icon={Boxes}
              danger={dashboard.counts.lowStock > 0}
            />
          </div>
        </div>

        <TrendCard points={dashboard.trends} />
      </section>

      <section id="people" className="space-y-4">
        <SectionHeader
          eyebrow="People and payroll"
          title="Staff cost, payouts, and performance"
          description="Put salaries, commissions, deductions, and staff leaders in one lane so admin can connect sales movement to real payroll impact."
        />
        <div className="grid gap-4 lg:grid-cols-4">
          <StatCard title="Base salary + transport" value={formatKES(dashboard.payroll.base)} sub="Fixed cost for the active payroll sheet" icon={Briefcase} accent="from-indigo-500/20 via-sky-500/10 to-transparent" />
          <StatCard title="Commissions" value={formatKES(dashboard.payroll.commission)} sub="Direct, marketplace, and POS product commission totals" icon={BadgeDollarSign} accent="from-emerald-500/20 via-teal-500/10 to-transparent" />
          <StatCard title="Deductions" value={formatKES(dashboard.payroll.deductions)} sub="Chama, lateness, discipline, cash advance, and other deductions" icon={TriangleAlert} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
          <StatCard title="Active company staff" value={`${dashboard.counts.activeStaff}`} sub={`${dashboard.counts.shops} shops and ${dashboard.counts.products} catalogued products in system`} icon={Building2} accent="from-cyan-500/20 via-slate-500/10 to-transparent" />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className={`${subtleCard} p-5`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">Top sales performer</div>
            <div className="mt-3 text-2xl font-semibold text-white">{dashboard.payroll.topSalesRow?.name || "No data"}</div>
            <div className="mt-2 text-sm text-slate-400">
              {dashboard.payroll.topSalesRow ? (
                <span className={sensitiveClass}>{`${formatKES(Number(dashboard.payroll.topSalesRow.totalSales ?? 0))} sales this period`}</span>
              ) : (
                "Waiting for payroll-linked sales data."
              )}
            </div>
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">Top commission</div>
            <div className="mt-3 text-2xl font-semibold text-white">{dashboard.payroll.topCommissionRow?.name || "No data"}</div>
            <div className="mt-2 text-sm text-slate-400">
              {dashboard.payroll.topCommissionRow ? (
                <span className={sensitiveClass}>{`${formatKES(Number(dashboard.payroll.topCommissionRow.commissionTotal ?? 0))} commission due`}</span>
              ) : (
                "Waiting for commission summary."
              )}
            </div>
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">Best net pay</div>
            <div className="mt-3 text-2xl font-semibold text-white">{dashboard.payroll.topNetRow?.name || "No data"}</div>
            <div className="mt-2 text-sm text-slate-400">
              {dashboard.payroll.topNetRow ? (
                <span className={sensitiveClass}>{`${formatKES(Number(dashboard.payroll.topNetRow.netPay ?? 0))} projected net pay`}</span>
              ) : (
                "Waiting for payroll projection."
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="resources" className="space-y-4">
        <SectionHeader
          eyebrow="Company links"
          title="Quick access boards for the whole company"
          description="These grouped links make the homepage a real control room. Money, people, operations, and system controls each get their own board."
          action={<AdminPrivacyToggle />}
        />
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          {quickLinks.map((group) => (
            <LinkGroupCard key={group.title} {...group} />
          ))}
        </div>
      </section>

      <section className={`${subtleCard} grid gap-4 p-5 xl:grid-cols-4`}>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-200"><ClipboardCheck className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-semibold text-white">Pending pricing</div>
              <div className="text-sm text-slate-400">{dashboard.pricingQueue.support} support receipts still in queue</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-200"><ChartColumnBig className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-semibold text-white">Marketplace split</div>
              <div className={`text-sm text-slate-400 ${sensitiveClass}`}>Jumia {formatCompactKES(dashboard.marketplace.jumiaSales)} · Kilimall {formatCompactKES(dashboard.marketplace.kilimallSales)}</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-fuchsia-500/10 p-3 text-fuchsia-200"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-semibold text-white">Wellness approvals</div>
              <div className={`text-sm text-slate-400 ${sensitiveClass}`}>{dashboard.counts.pendingLeave} leave · {dashboard.counts.pendingCashAdvance} cash advance</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-200"><Activity className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-semibold text-white">System safety</div>
              <div className="text-sm text-slate-400">Use the health-checks and settings pages for platform diagnostics and credentials.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
