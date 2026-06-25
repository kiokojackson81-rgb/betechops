import Link from "next/link";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Prisma } from "@prisma/client";
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
  UserRound,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import AutoRefresh from "@/app/_components/AutoRefresh";
import AdminPrivacyToggle from "@/app/admin/_components/AdminPrivacyToggle";
import { getAdminAgentSales } from "@/lib/agents/sales";
import {
  ensureQuoteRequestsSchema,
} from "@/lib/quoteRequests";
import {
  isCarriedForwardPendingItem,
  isOpenQuotationStatus,
  isOpenWorkItemStatus,
  isPendingPodStatus,
  isPendingWebOrderStatus,
  shouldShowPendingWorkItem,
  wasCreatedOrUpdatedInPeriod,
} from "@/lib/operationsWorkQueue";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import { payrollEligibleUserWhere } from "@/lib/payrollEligibility";
import { getUnpricedDailySalesForCurrentPeriod } from "@/lib/marketingUnpricedSales";
import { groupMarketingUnpricedSales } from "@/lib/unpricedReceiptGrouping";
import { buildStaffAttendantWhere } from "@/lib/staffUsers";

export const dynamic = "force-dynamic";

const AGENT_OPEN_STATUSES = [
  "pending_review",
  "awaiting_payment",
  "payment_confirmed",
  "processing",
  "dispatched",
  "delivered_pending_balance",
] as const;

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

type TrendPoint = {
  key: string;
  label: string;
  total: number;
  pos: number;
  desk: number;
  online: number;
  webOrders: number;
  agentOrders: number;
  quotations: number;
  marketplaceOrders: number;
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
      webOrders: 0,
      agentOrders: 0,
      quotations: 0,
      marketplaceOrders: 0,
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
  const summary = points.reduce(
    (acc, point) => {
      acc.pos += point.pos;
      acc.webOrders += point.webOrders;
      acc.agentOrders += point.agentOrders;
      acc.quotations += point.quotations;
      acc.marketplaceOrders += point.marketplaceOrders;
      return acc;
    },
    { pos: 0, webOrders: 0, agentOrders: 0, quotations: 0, marketplaceOrders: 0 },
  );

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

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">POS sales</div>
          <div className={`mt-1 text-lg font-semibold text-white ${sensitiveClass}`}>{formatCompactKES(summary.pos)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Web orders</div>
          <div className="mt-1 text-lg font-semibold text-white">{summary.webOrders}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Agent orders</div>
          <div className="mt-1 text-lg font-semibold text-white">{summary.agentOrders}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Quotations</div>
          <div className="mt-1 text-lg font-semibold text-white">{summary.quotations}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Marketplace orders</div>
          <div className="mt-1 text-lg font-semibold text-white">{summary.marketplaceOrders}</div>
        </div>
      </div>
    </div>
  );
}

function ControlCenterCard({
  title,
  count,
  amount,
  pending,
  href,
  note,
}: {
  title: string;
  count: number;
  amount?: number | null;
  pending?: number | null;
  href: string;
  note: string;
}) {
  return (
    <Link href={href} className={`${subtleCard} group block p-5 transition hover:border-emerald-400/40`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{title}</div>
          <div className="mt-3 text-3xl font-semibold text-white">{count}</div>
          <div className="mt-2 text-sm text-slate-400">{note}</div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-slate-500 transition group-hover:text-emerald-300" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Sales amount</div>
          <div className={`mt-1 text-lg font-semibold text-white ${sensitiveClass}`}>{formatCompactKES(amount ?? 0)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Pending</div>
          <div className="mt-1 text-lg font-semibold text-white">{pending ?? count}</div>
        </div>
      </div>
    </Link>
  );
}

function QueueRow({
  badge,
  title,
  note,
  amount,
  status,
  age,
  href,
  carriedForward = false,
}: {
  badge: string;
  title: string;
  note: string;
  amount?: number | null;
  status: string;
  age: string;
  href: string;
  carriedForward?: boolean;
}) {
  return (
    <Link
      href={href}
      className="grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] p-4 transition hover:border-emerald-400/30 lg:grid-cols-[120px_minmax(0,1.4fr)_180px_140px_120px]"
    >
      <div className="flex items-center">
        <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
          {badge}
        </span>
      </div>
      <div>
        <div className="font-semibold text-white">{title}</div>
        <div className="mt-1 text-sm text-slate-400">{note}</div>
        {carriedForward ? (
          <div className="mt-2">
            <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
              Carried forward
            </span>
          </div>
        ) : null}
      </div>
      <div>
        <div className={`text-sm font-semibold text-white ${sensitiveClass}`}>{amount != null ? formatKES(amount) : "Action needed"}</div>
      </div>
      <div className="text-sm capitalize text-slate-300">{status}</div>
      <div className="text-sm text-slate-400">{age}</div>
    </Link>
  );
}

function safeDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageLabel(value: string | Date | null | undefined) {
  const date = safeDate(value);
  if (!date) return "-";
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) {
    return `${Math.max(0, Math.floor(diffMs / (1000 * 60)))} min ago`;
  }
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function queueSort<T extends { createdAt?: string | Date | null; updatedAt?: string | Date | null; amount?: number | null }>(rows: T[]) {
  return rows.sort((left, right) => {
    const leftCreatedAt = safeDate(left.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightCreatedAt = safeDate(right.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

    const amountDelta = Number(right.amount ?? 0) - Number(left.amount ?? 0);
    if (amountDelta !== 0) return amountDelta;

    const leftUpdatedAt = safeDate(left.updatedAt)?.getTime() ?? 0;
    const rightUpdatedAt = safeDate(right.updatedAt)?.getTime() ?? 0;
    return rightUpdatedAt - leftUpdatedAt;
  });
}

type AdminQuoteRow = {
  id: string;
  quoteRef: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string | null;
  status: string;
  quoteTitle: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type AdminPodItem = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  total: number;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

async function safeLoad<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.warn("[admin.dashboard] optional block unavailable", error);
    return fallback;
  }
}

async function listAdminQuoteRequests() {
  await ensureQuoteRequestsSchema();
  return prisma.$queryRaw<AdminQuoteRow[]>(Prisma.sql`
    SELECT "id", "quoteRef", "customerName", "customerPhone", "customerLocation", "status", "quoteTitle", "createdAt", "updatedAt"
    FROM "QuoteRequest"
    ORDER BY "updatedAt" DESC
    LIMIT 120
  `);
}

async function listAdminPodFollowUp() {
  const receipts = await prisma.receipt.findMany({
    where: { data: { path: ["podDelivery"], not: Prisma.JsonNull } },
    orderBy: { generatedAt: "desc" },
    take: 80,
    select: {
      id: true,
      generatedAt: true,
      createdAt: true,
      totals: true,
      data: true,
      order: {
        select: {
          customerName: true,
          customerPhone: true,
          totalAmount: true,
        },
      },
    },
  });

  const items: AdminPodItem[] = [];
  for (const receipt of receipts) {
    const data =
      receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
        ? (receipt.data as Record<string, unknown>)
        : null;
    const podDelivery =
      data?.podDelivery && typeof data.podDelivery === "object" && !Array.isArray(data.podDelivery)
        ? (data.podDelivery as Record<string, unknown>)
        : null;
    const status = String(podDelivery?.status ?? "pending");
    if (!isPendingPodStatus(status)) continue;
    items.push({
      id: receipt.id,
      customerName: String(receipt.order?.customerName ?? data?.customerName ?? "POD customer"),
      customerPhone: receipt.order?.customerPhone ?? (typeof data?.customerPhone === "string" ? data.customerPhone : null),
      total:
        Number(
          ((receipt.totals as Record<string, unknown> | null)?.total ??
            receipt.order?.totalAmount ??
            (typeof data?.amount === "number" ? data.amount : 0)) as number,
        ) || 0,
      status,
      createdAt: receipt.generatedAt ?? receipt.createdAt,
      updatedAt:
        typeof podDelivery?.updatedAt === "string"
          ? new Date(podDelivery.updatedAt)
          : typeof podDelivery?.createdAt === "string"
            ? new Date(podDelivery.createdAt)
            : receipt.generatedAt ?? receipt.createdAt,
    });
  }

  return items;
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
  const periodBounds = { start: tradingPeriod.start, end: tradingPeriod.end };

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
    dailyReportsToday,
    websiteOrdersRecent,
    websiteOrdersToday,
    websiteOrdersPendingCount,
    websiteOrdersCompletedCount,
    quoteRows,
    podFollowUpRows,
    openAgentOrders,
    periodAgentOrders,
    lowStockItems,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.shop.count(),
    prisma.user.count({
      where: {
        AND: [buildStaffAttendantWhere(), { isActive: true }],
      },
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
      where: payrollEligibleUserWhere({ isActive: true }),
      orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
    }),
    prisma.dailyReport.count({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        user: { is: { AND: [buildStaffAttendantWhere(), { isActive: true }] } },
      },
    }),
    prisma.websiteOrder.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 120,
      select: {
        id: true,
        orderRef: true,
        customerName: true,
        customerPhone: true,
        total: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.websiteOrder.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.websiteOrder.count({
      where: { status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "RECEIPT_ISSUED", "DISPATCHED", "PAYMENT_CONFIRMED"] } },
    }),
    prisma.websiteOrder.count({
      where: { status: "DELIVERED" },
    }),
    safeLoad(() => listAdminQuoteRequests(), [] as AdminQuoteRow[]),
    safeLoad(() => listAdminPodFollowUp(), [] as AdminPodItem[]),
    safeLoad(() => getAdminAgentSales({ statuses: [...AGENT_OPEN_STATUSES] }), [] as Awaited<ReturnType<typeof getAdminAgentSales>>),
    safeLoad(
      () =>
        getAdminAgentSales({
          start: format(tradingPeriod.start, "yyyy-MM-dd"),
          end: format(tradingPeriod.end, "yyyy-MM-dd"),
        }),
      [] as Awaited<ReturnType<typeof getAdminAgentSales>>,
    ),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ stockQuantity: "asc" }],
      take: 8,
      select: { id: true, name: true, stockQuantity: true, minStockLevel: true },
    }),
  ]);

  const payrollRows = await Promise.all(
    payrollUsers.map(async (user) => applyCanonicalPayrollOverrides(await buildPayrollRow(user, tradingPeriod), tradingPeriod)),
  );
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
    point.marketplaceOrders += 1;
  }

  const pendingWebsiteOrders = websiteOrdersRecent.filter((order) =>
    isPendingWebOrderStatus(order.status) &&
    shouldShowPendingWorkItem({
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      periodStart: periodBounds.start,
      periodEnd: periodBounds.end,
    }),
  );
  const periodWebsiteOrders = pendingWebsiteOrders.filter((order) =>
    wasCreatedOrUpdatedInPeriod(order.createdAt, order.updatedAt, periodBounds),
  );
  const carriedWebsiteOrders = pendingWebsiteOrders.filter((order) =>
    isCarriedForwardPendingItem({
      status: order.status,
      createdAt: order.createdAt,
      periodStart: periodBounds.start,
    }) && !wasCreatedOrUpdatedInPeriod(order.createdAt, order.updatedAt, periodBounds),
  );
  const webOrderValue = periodWebsiteOrders.reduce((sum, order) => sum + toNumber(order.total), 0);
  const pendingWebOrderValue = pendingWebsiteOrders.reduce((sum, order) => sum + toNumber(order.total), 0);

  const openQuoteRows = quoteRows.filter((row) =>
    isOpenQuotationStatus(row.status) &&
    shouldShowPendingWorkItem({
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      periodStart: periodBounds.start,
      periodEnd: periodBounds.end,
    }),
  );
  const periodQuoteRows = openQuoteRows.filter((row) => wasCreatedOrUpdatedInPeriod(row.createdAt, row.updatedAt, periodBounds));
  const carriedQuoteRows = openQuoteRows.filter((row) =>
    isCarriedForwardPendingItem({
      status: row.status,
      createdAt: row.createdAt,
      periodStart: periodBounds.start,
    }) && !wasCreatedOrUpdatedInPeriod(row.createdAt, row.updatedAt, periodBounds),
  );
  const newQuoteRows = periodQuoteRows.filter((row) => String(row.status).toLowerCase() === "new");

  const pendingPodRows = podFollowUpRows.filter((row) =>
    isPendingPodStatus(row.status) &&
    shouldShowPendingWorkItem({
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      periodStart: periodBounds.start,
      periodEnd: periodBounds.end,
    }),
  );
  const periodPendingPodRows = pendingPodRows.filter((row) => wasCreatedOrUpdatedInPeriod(row.createdAt, row.updatedAt, periodBounds));
  const carriedPendingPodRows = pendingPodRows.filter((row) =>
    isCarriedForwardPendingItem({
      status: row.status,
      createdAt: row.createdAt,
      periodStart: periodBounds.start,
    }) && !wasCreatedOrUpdatedInPeriod(row.createdAt, row.updatedAt, periodBounds),
  );
  const pendingPodValue = pendingPodRows.reduce((sum, row) => sum + row.total, 0);

  const visibleOpenAgentOrders = openAgentOrders.filter((sale) =>
    isOpenWorkItemStatus(sale.status) &&
    shouldShowPendingWorkItem({
      status: sale.status,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      periodStart: periodBounds.start,
      periodEnd: periodBounds.end,
    }),
  );
  const periodOpenAgentOrders = visibleOpenAgentOrders.filter((sale) =>
    wasCreatedOrUpdatedInPeriod(sale.createdAt, sale.updatedAt, periodBounds),
  );
  const carriedOpenAgentOrders = visibleOpenAgentOrders.filter((sale) =>
    isCarriedForwardPendingItem({
      status: sale.status,
      createdAt: sale.createdAt,
      periodStart: periodBounds.start,
    }) && !wasCreatedOrUpdatedInPeriod(sale.createdAt, sale.updatedAt, periodBounds),
  );
  const periodAgentOrderValue = periodOpenAgentOrders.reduce((sum, sale) => sum + Number(sale.totalAmount ?? 0), 0);

  const agentPerformance = periodAgentOrders.reduce<
    Map<string, { agentName: string; orders: number; sales: number }>
  >((acc, sale) => {
    const key = sale.agentId;
    const current = acc.get(key) ?? { agentName: sale.agentName, orders: 0, sales: 0 };
    current.orders += 1;
    current.sales += Number(sale.totalAmount ?? 0);
    acc.set(key, current);
    return acc;
  }, new Map());
  const rankedAgents = Array.from(agentPerformance.values());
  const topAgentByOrders = rankedAgents.slice().sort((a, b) => b.orders - a.orders)[0] ?? null;
  const topAgentBySales = rankedAgents.slice().sort((a, b) => b.sales - a.sales)[0] ?? null;

  const recentAgentActivity = queueSort(
    visibleOpenAgentOrders.slice(0, 12).map((sale) => ({
      id: sale.id,
      agentName: sale.agentName,
      customerName: sale.customerName,
      amount: Number(sale.totalAmount ?? 0),
      status: sale.statusMeta.label,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      href: `/marketing/agent-orders?saleId=${encodeURIComponent(sale.id)}`,
      carriedForward: isCarriedForwardPendingItem({
        status: sale.status,
        createdAt: sale.createdAt,
        periodStart: periodBounds.start,
      }),
    })),
  ).slice(0, 6);

  const webRecentRows = queueSort(
    pendingWebsiteOrders.map((order) => ({
      id: order.id,
      customerName: order.customerName,
      phone: order.customerPhone,
      amount: toNumber(order.total),
      status: String(order.status).replace(/_/g, " ").toLowerCase(),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      href: `/marketing/receipts?tab=web-orders&orderId=${encodeURIComponent(order.id)}`,
      ref: order.orderRef,
      carriedForward: isCarriedForwardPendingItem({
        status: order.status,
        createdAt: order.createdAt,
        periodStart: periodBounds.start,
      }),
    })),
  ).slice(0, 6);

  for (const order of websiteOrdersRecent) {
    const key = dayKey(order.updatedAt);
    const point = trendMap.get(key);
    if (point && isPendingWebOrderStatus(order.status)) point.webOrders += 1;
  }
  for (const sale of periodAgentOrders) {
    const key = dayKey(sale.updatedAt);
    const point = trendMap.get(key);
    if (point) point.agentOrders += 1;
  }
  for (const quote of quoteRows) {
    const key = dayKey(new Date(quote.updatedAt));
    const point = trendMap.get(key);
    if (point && isOpenQuotationStatus(quote.status)) point.quotations += 1;
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
    periodStart: tradingPeriod.start,
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
    livePulse: {
      todaySales,
      currentPeriodSales: combinedPeriodSales,
      currentPeriodProfit: combinedPeriodProfit,
      posReceipts: posReceiptsPeriod.length + marketingReceiptsPeriod.length + supportReceiptsPeriod.length,
      webOrders: pendingWebsiteOrders.length,
      agentOrders: visibleOpenAgentOrders.length,
      quotations: openQuoteRows.length,
      podPending: pendingPodRows.length,
      jumiaPending: pendingJumiaOrders,
      lowStockItems: lowStockCount,
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
    salesActivity: {
      pos: {
        count: posReceiptsPeriod.length,
        sales: posPeriod.sales,
        pending: pendingPodRows.length,
      },
      web: {
        count: pendingWebsiteOrders.length,
        sales: webOrderValue,
        pending: pendingWebsiteOrders.length,
      },
      agent: {
        count: visibleOpenAgentOrders.length,
        sales: periodAgentOrderValue,
        pending: visibleOpenAgentOrders.length,
      },
      quotations: {
        count: openQuoteRows.length,
        sales: 0,
        pending: newQuoteRows.length,
      },
      pod: {
        count: pendingPodRows.length,
        sales: pendingPodValue,
        pending: pendingPodRows.length,
      },
      marketplace: {
        count: marketplaceOrdersPeriod.length,
        sales: marketplacePeriod.totalSales,
        pending: pendingJumiaOrders,
      },
    },
    agents: {
      activeAgents: rankedAgents.length,
      pendingOrders: visibleOpenAgentOrders.length,
      orderValue: periodAgentOrderValue,
      topByOrders: topAgentByOrders,
      topBySales: topAgentBySales,
      recentActivity: recentAgentActivity,
    },
    web: {
      newOrders: websiteOrdersToday,
      pendingOrders: pendingWebsiteOrders.length,
      completedOrders: websiteOrdersCompletedCount,
      orderValue: webOrderValue,
      pendingOrderValue: pendingWebOrderValue,
      recentOrders: webRecentRows,
      quoteRequests: openQuoteRows.slice(0, 6).map((quote) => ({
        ...quote,
        carriedForward: isCarriedForwardPendingItem({
          status: quote.status,
          createdAt: quote.createdAt,
          periodStart: periodBounds.start,
        }),
      })),
    },
    staffSnapshot: {
      topSalesPerformer: topSalesRow,
      topCommissionPerformer: topCommissionRow,
      activeStaffToday: activeStaffCount,
      submittedDailyReports: dailyReportsToday,
      missingDailyReports: Math.max(0, activeStaffCount - dailyReportsToday),
      payrollDue: payrollTotals.net,
    },
    lowStockItems,
    queues: {
      websiteOrders: pendingWebsiteOrders,
      quotations: openQuoteRows.map((quote) => ({
        ...quote,
        carriedForward: isCarriedForwardPendingItem({
          status: quote.status,
          createdAt: quote.createdAt,
          periodStart: periodBounds.start,
        }),
      })),
      pod: pendingPodRows,
    },
    pendingBreakdown: {
      web: { current: periodWebsiteOrders.length, carried: carriedWebsiteOrders.length },
      agent: { current: periodOpenAgentOrders.length, carried: carriedOpenAgentOrders.length },
      quotations: { current: periodQuoteRows.length, carried: carriedQuoteRows.length },
      pod: { current: periodPendingPodRows.length, carried: carriedPendingPodRows.length },
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
        { href: "/admin/communications/voice", label: "Voice calls", meta: "Live incoming calls, agent availability, and missed-call follow-up" },
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
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-emerald-300">Business Control Center</div>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                One control center for live business activity, staff performance, money flow, and urgent work.
              </h1>
              <p className="max-w-3xl text-base text-slate-400">
                Watch POS, web orders, agent activity, quotations, POD follow-up, marketplace movement, and payroll from one screen. The layout is grouped so management can scan live work and jump into the right operating page quickly.
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

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Live business pulse"
          title="Today, current period, and pending workload"
          description="This strip is the first management scan: what sold today, what the current period looks like, and where the active workload is building up."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-10">
          <StatCard title="Today sales" value={formatKES(dashboard.livePulse.todaySales)} sub="Clearly labeled today-only total" icon={Wallet} />
          <StatCard title="Current period sales" value={formatKES(dashboard.livePulse.currentPeriodSales)} sub={dashboard.periodLabel} icon={TrendingUp} accent="from-cyan-500/20 via-emerald-500/10 to-transparent" />
          <StatCard title="Current period profit" value={formatKES(dashboard.livePulse.currentPeriodProfit)} sub="Recorded margin across major channels" icon={ChartColumnBig} accent="from-sky-500/20 via-cyan-500/10 to-transparent" />
          <StatCard title="POS receipts" value={`${dashboard.livePulse.posReceipts}`} sub="POS, marketing, and support receipts" icon={Receipt} accent="from-indigo-500/20 via-cyan-500/10 to-transparent" />
          <StatCard title="Web orders" value={`${dashboard.livePulse.webOrders}`} sub={`Current period ${dashboard.pendingBreakdown.web.current} · Carried forward ${dashboard.pendingBreakdown.web.carried}`} icon={ShoppingBag} accent="from-emerald-500/20 via-teal-500/10 to-transparent" />
          <StatCard title="Agent orders" value={`${dashboard.livePulse.agentOrders}`} sub={`Current period ${dashboard.pendingBreakdown.agent.current} · Carried forward ${dashboard.pendingBreakdown.agent.carried}`} icon={Users} accent="from-violet-500/20 via-fuchsia-500/10 to-transparent" />
          <StatCard title="Quotations" value={`${dashboard.livePulse.quotations}`} sub={`Current period ${dashboard.pendingBreakdown.quotations.current} · Carried forward ${dashboard.pendingBreakdown.quotations.carried}`} icon={ClipboardCheck} accent="from-cyan-500/20 via-sky-500/10 to-transparent" />
          <StatCard title="POD pending" value={`${dashboard.livePulse.podPending}`} sub={`Current period ${dashboard.pendingBreakdown.pod.current} · Carried forward ${dashboard.pendingBreakdown.pod.carried}`} icon={Truck} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
          <StatCard title="Jumia pending" value={`${dashboard.livePulse.jumiaPending}`} sub="Marketplace pending order backlog" icon={Store} accent="from-amber-500/20 via-yellow-500/10 to-transparent" />
          <StatCard title="Low stock items" value={`${dashboard.livePulse.lowStockItems}`} sub="Items at or below minimum stock" icon={Boxes} accent="from-rose-500/20 via-orange-500/10 to-transparent" />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Unified queue"
          title="Urgent action queue"
          description="Closed, delivered, cancelled, settled, and completed work is excluded. This is the live queue that still needs attention."
        />
        <div className="grid gap-3">
          {queueSort([
            ...dashboard.queues.websiteOrders.map((order) => ({
              id: `web-${order.id}`,
              badge: "WEB ORDER",
              title: `${order.customerName} · ${order.orderRef}`,
              note: order.customerPhone || "No phone captured",
              amount: toNumber(order.total),
              status: String(order.status).replace(/_/g, " ").toLowerCase(),
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              href: `/marketing/receipts?tab=web-orders&orderId=${encodeURIComponent(order.id)}`,
              carriedForward: isCarriedForwardPendingItem({
                status: order.status,
                createdAt: order.createdAt,
                periodStart: dashboard.periodStart,
              }),
            })),
            ...dashboard.agents.recentActivity.map((row) => ({
              id: `agent-${row.id}`,
              badge: "AGENT ORDER",
              title: `${row.agentName} · ${row.customerName}`,
              note: "Pending customer order",
              amount: row.amount,
              status: row.status,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              href: row.href,
            })),
            ...dashboard.queues.quotations.map((quote) => ({
              id: `quote-${quote.id}`,
              badge: "QUOTATION",
              title: `${quote.customerName} · ${quote.quoteRef}`,
              note: quote.customerPhone || "No phone captured",
              amount: null,
              status: String(quote.status).replace(/_/g, " ").toLowerCase(),
              createdAt: quote.createdAt,
              updatedAt: quote.updatedAt,
              href: `/marketing/receipts?tab=quotations&quoteId=${encodeURIComponent(quote.id)}`,
              carriedForward: Boolean((quote as { carriedForward?: boolean }).carriedForward),
            })),
            ...dashboard.queues.pod.map((row) => ({
              id: `pod-${row.id}`,
              badge: "POD",
              title: row.customerName,
              note: row.customerPhone || "No phone captured",
              amount: row.total,
              status: row.status.replace(/_/g, " ").toLowerCase(),
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              href: `/marketing/receipts?tab=pos&podStatus=pending&receiptId=${encodeURIComponent(row.id)}`,
              carriedForward: isCarriedForwardPendingItem({
                status: row.status,
                createdAt: row.createdAt,
                periodStart: dashboard.periodStart,
              }),
            })),
            {
              id: "pricing-queue",
              badge: "PRICING",
              title: "Missing pricing queue",
              note: `${dashboard.pricingQueue.items} items still need buying prices`,
              amount: null,
              status: `${dashboard.pricingQueue.receipts} receipts`,
              createdAt: null,
              updatedAt: null,
              href: "/admin/pending-pricing",
            },
            {
              id: "low-stock",
              badge: "STOCK",
              title: "Low stock risk",
              note: dashboard.lowStockItems.slice(0, 3).map((item) => item.name).join(" · ") || "Inventory threshold alert",
              amount: null,
              status: `${dashboard.counts.lowStock} items`,
              createdAt: null,
              updatedAt: null,
              href: "/admin/pos-management",
            },
            {
              id: "returns",
              badge: "RETURNS",
              title: "Returns waiting resolution",
              note: "Open return cases that still need handling",
              amount: null,
              status: `${dashboard.counts.returns} open`,
              createdAt: null,
              updatedAt: null,
              href: "/admin/returns",
            },
            {
              id: "jumia-pending",
              badge: "JUMIA",
              title: "Jumia pending orders",
              note: "Marketplace queue still pending in vendor sync tables",
              amount: null,
              status: `${dashboard.counts.pendingJumiaOrders} pending`,
              createdAt: null,
              updatedAt: null,
              href: "/admin/online/summary",
            },
          ]).slice(0, 14).map((item) => (
            <QueueRow
              key={item.id}
              badge={item.badge}
              title={item.title}
              note={item.note}
              amount={item.amount}
              status={item.status}
              age={ageLabel(item.createdAt)}
              href={item.href}
              carriedForward={Boolean((item as { carriedForward?: boolean }).carriedForward)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Sales activity center"
          title="Channel control boards"
          description="Each revenue lane shows its live volume, value, pending pressure, and direct entry point into the operating page."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          <ControlCenterCard title="POS / Direct Sales" count={dashboard.salesActivity.pos.count} amount={dashboard.salesActivity.pos.sales} pending={dashboard.salesActivity.pos.pending} href="/admin/receipts" note="Direct POS receipts and desk-recorded sales." />
          <ControlCenterCard title="Web Orders" count={dashboard.salesActivity.web.count} amount={dashboard.salesActivity.web.sales} pending={dashboard.salesActivity.web.pending} href="/marketing/receipts?tab=web-orders" note={`Current period ${dashboard.pendingBreakdown.web.current} · Carried forward ${dashboard.pendingBreakdown.web.carried}`} />
          <ControlCenterCard title="Agent Orders" count={dashboard.salesActivity.agent.count} amount={dashboard.salesActivity.agent.sales} pending={dashboard.salesActivity.agent.pending} href="/marketing/agent-orders" note={`Current period ${dashboard.pendingBreakdown.agent.current} · Carried forward ${dashboard.pendingBreakdown.agent.carried}`} />
          <ControlCenterCard title="Quotations" count={dashboard.salesActivity.quotations.count} amount={dashboard.salesActivity.quotations.sales} pending={dashboard.salesActivity.quotations.pending} href="/marketing/receipts?tab=quotations" note={`Current period ${dashboard.pendingBreakdown.quotations.current} · Carried forward ${dashboard.pendingBreakdown.quotations.carried}`} />
          <ControlCenterCard title="POD Follow-up" count={dashboard.salesActivity.pod.count} amount={dashboard.salesActivity.pod.sales} pending={dashboard.salesActivity.pod.pending} href="/marketing/receipts?tab=pos&podStatus=pending" note={`Current period ${dashboard.pendingBreakdown.pod.current} · Carried forward ${dashboard.pendingBreakdown.pod.carried}`} />
          <ControlCenterCard title="Marketplace Orders" count={dashboard.salesActivity.marketplace.count} amount={dashboard.salesActivity.marketplace.sales} pending={dashboard.salesActivity.marketplace.pending} href="/admin/online/summary" note="Jumia and Kilimall order movement." />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Agent activity"
            title="Affiliate and agent movement"
            description="Track active agents, pending order value, top performers, and the most recent agent activity without leaving the home page."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Active agents" value={`${dashboard.agents.activeAgents}`} sub="Agents with period activity" icon={Users} accent="from-cyan-500/20 via-slate-500/10 to-transparent" />
            <StatCard title="Pending agent orders" value={`${dashboard.agents.pendingOrders}`} sub="Open agent order workload" icon={ShoppingBag} accent="from-violet-500/20 via-fuchsia-500/10 to-transparent" />
            <StatCard title="Agent order value" value={formatKES(dashboard.agents.orderValue)} sub="Current open order amount" icon={BadgeDollarSign} accent="from-emerald-500/20 via-lime-500/10 to-transparent" />
            <StatCard title="Top agent by sales" value={dashboard.agents.topBySales?.agentName || "No data"} sub={dashboard.agents.topBySales ? formatKES(dashboard.agents.topBySales.sales) : "Waiting for period activity"} icon={UserRound} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Top agent by orders</div>
                <div className="mt-2 text-xl font-semibold text-white">{dashboard.agents.topByOrders?.agentName || "No data"}</div>
                <div className="mt-1 text-sm text-slate-400">{dashboard.agents.topByOrders ? `${dashboard.agents.topByOrders.orders} orders this period` : "Waiting for period activity."}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Recent agent activity</div>
                <div className="mt-2 text-xl font-semibold text-white">{dashboard.agents.recentActivity.length}</div>
                <div className="mt-1 text-sm text-slate-400">Latest open agent-order movements in the current period.</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {dashboard.agents.recentActivity.length ? dashboard.agents.recentActivity.map((row) => (
                <QueueRow
                  key={row.id}
                  badge="AGENT"
                  title={`${row.agentName} · ${row.customerName}`}
                  note="Customer / order activity"
                  amount={row.amount}
                  status={row.status}
                  age={ageLabel(row.updatedAt)}
                  href={row.href}
                  carriedForward={Boolean((row as { carriedForward?: boolean }).carriedForward)}
                />
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No recent open agent activity right now.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeader
            eyebrow="Web activity"
            title="Website orders and quote requests"
            description="Monitor website order flow, pending order value, and website-origin quotations from one panel."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="New web orders" value={`${dashboard.web.newOrders}`} sub="Created today" icon={ShoppingBag} accent="from-cyan-500/20 via-sky-500/10 to-transparent" />
            <StatCard title="Pending web orders" value={`${dashboard.web.pendingOrders}`} sub={`Current period ${dashboard.pendingBreakdown.web.current} · Carried forward ${dashboard.pendingBreakdown.web.carried}`} icon={CircleAlert} accent="from-emerald-500/20 via-teal-500/10 to-transparent" />
            <StatCard title="Completed web orders" value={`${dashboard.web.completedOrders}`} sub="Delivered web orders in view" icon={ClipboardCheck} accent="from-indigo-500/20 via-cyan-500/10 to-transparent" />
            <StatCard title="Web order value" value={formatKES(dashboard.web.orderValue)} sub={`Pending value ${formatCompactKES(dashboard.web.pendingOrderValue)}`} icon={Wallet} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Recent web customers and orders</div>
                <div className="mt-1 text-sm text-slate-400">Most recent website orders plus website quote activity for the active statistics period.</div>
              </div>
              <Link href="/marketing/receipts?tab=web-orders" className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">Open web orders</Link>
            </div>
            <div className="mt-4 grid gap-3">
              {dashboard.web.recentOrders.map((row) => (
                <QueueRow
                  key={row.id}
                  badge="WEB"
                  title={`${row.customerName} · ${row.ref}`}
                  note={row.phone || "No phone captured"}
                  amount={row.amount}
                  status={row.status}
                  age={ageLabel(row.updatedAt)}
                  href={row.href}
                  carriedForward={Boolean((row as { carriedForward?: boolean }).carriedForward)}
                />
              ))}
              {dashboard.web.quoteRequests.map((quote) => (
                <QueueRow
                  key={quote.id}
                  badge="QUOTE"
                  title={`${quote.customerName} · ${quote.quoteRef}`}
                  note={quote.customerLocation || quote.customerPhone}
                  amount={null}
                  status={String(quote.status).replace(/_/g, " ").toLowerCase()}
                  age={ageLabel(quote.updatedAt)}
                  href={`/marketing/receipts?tab=quotations&quoteId=${encodeURIComponent(quote.id)}`}
                  carriedForward={Boolean((quote as { carriedForward?: boolean }).carriedForward)}
                />
              ))}
              {!dashboard.web.recentOrders.length && !dashboard.web.quoteRequests.length ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No open website order or quotation activity right now.</div>
              ) : null}
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Top sales performer" value={dashboard.staffSnapshot.topSalesPerformer?.name || "No data"} sub={dashboard.staffSnapshot.topSalesPerformer ? formatKES(Number(dashboard.staffSnapshot.topSalesPerformer.totalSales ?? 0)) : "Waiting for linked sales"} icon={TrendingUp} accent="from-cyan-500/20 via-sky-500/10 to-transparent" />
          <StatCard title="Top commission" value={dashboard.staffSnapshot.topCommissionPerformer?.name || "No data"} sub={dashboard.staffSnapshot.topCommissionPerformer ? formatKES(Number(dashboard.staffSnapshot.topCommissionPerformer.commissionTotal ?? 0)) : "Waiting for commission summary"} icon={BadgeDollarSign} accent="from-emerald-500/20 via-lime-500/10 to-transparent" />
          <StatCard title="Active staff today" value={`${dashboard.staffSnapshot.activeStaffToday}`} sub="Filtered to real attendants/staff only" icon={Users} accent="from-fuchsia-500/20 via-violet-500/10 to-transparent" />
          <StatCard title="Submitted daily reports" value={`${dashboard.staffSnapshot.submittedDailyReports}`} sub="Daily reports received today" icon={ClipboardCheck} accent="from-emerald-500/20 via-teal-500/10 to-transparent" />
          <StatCard title="Missing daily reports" value={`${dashboard.staffSnapshot.missingDailyReports}`} sub="Expected staff still missing a report today" icon={TriangleAlert} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
          <StatCard title="Payroll due" value={formatKES(dashboard.staffSnapshot.payrollDue)} sub="Current net payroll exposure" icon={Briefcase} accent="from-indigo-500/20 via-sky-500/10 to-transparent" />
        </div>

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
